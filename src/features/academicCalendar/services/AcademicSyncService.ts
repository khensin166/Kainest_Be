// src/features/academicCalendar/services/AcademicSyncService.ts
import { logger } from "../../../infrastructure/logger/logger.js";
import { AcademicCalendarRepository } from "../data/AcademicCalendarRepository.js";
import {
  deduplicateRawRows,
  normalizeEventRow,
} from "../domain/calendarNormalizer.js";
import { normalizeWhatsAppRecipient } from "../domain/reminderCalculator.js";
import type {
  CalendarSyncStatus,
  NormalizedCalendarEvent,
  RowValidationError,
  SyncRunReport,
} from "../domain/types.js";
import { downloadCalendarExcelToStaging } from "../infrastructure/calendarDownloader.js";
import {
  computeFileSha256,
  readEventsTableFromExcel,
} from "../infrastructure/excelCalendarReader.js";
import { HousekeepingService } from "../infrastructure/housekeepingService.js";

const DEFAULT_BATCH_SIZE = 30;
const STAGING_FILENAME = "binus-lms-events.xlsx";

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export interface AcademicSyncOptions {
  /** Paksa proses ulang meskipun checksum SHA-256 sama dengan sync sukses sebelumnya */
  force?: boolean;
  /** Override URL download (default dari env ACADEMIC_EXCEL_DOWNLOAD_URL) */
  downloadUrl?: string;
}

export class AcademicSyncService {
  private isRunning = false;

  constructor(
    private readonly repo = new AcademicCalendarRepository(),
    private readonly housekeeping = new HousekeepingService()
  ) {}

  private getBatchSize(): number {
    const parsed = Number.parseInt(
      process.env.ACADEMIC_SYNC_BATCH_SIZE || String(DEFAULT_BATCH_SIZE),
      10
    );
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : DEFAULT_BATCH_SIZE;
  }

  private getTargetRecipient(): string {
    const raw =
      process.env.ACADEMIC_REMINDER_TARGET_PHONE ||
      process.env.ACADEMIC_REMINDER_TARGET_JID ||
      "";
    return normalizeWhatsAppRecipient(raw);
  }

  private isWeeklyLectureMuted(): boolean {
    return process.env.ACADEMIC_MUTE_WEEKLY_LECTURE !== "false";
  }

  /**
   * Menjalankan siklus lengkap:
   * Auto-Download ke staging -> SHA-256 check -> Parse & Dedup -> Normalize ->
   * Batch Upsert (maks 30) -> Schedule/Reschedule Reminders -> SyncLog -> Archive & Prune.
   */
  async runSync(options: AcademicSyncOptions = {}): Promise<SyncRunReport> {
    if (this.isRunning) {
      throw new Error("Proses sinkronisasi kalender akademik sedang berjalan.");
    }

    this.isRunning = true;
    await this.housekeeping.ensureDirectories();
    await this.housekeeping.cleanupStaleStagingTempFiles();

    const downloadUrl = options.downloadUrl || process.env.ACADEMIC_EXCEL_DOWNLOAD_URL || "";
    const stagingPath = this.housekeeping.getStagingFilePath(STAGING_FILENAME);
    const syncLog = await this.repo.createSyncLog(STAGING_FILENAME);

    let fileChecksum: string | null = null;
    let totalRowsRead = 0;
    let rowsDedupedInFile = 0;
    let eventsInserted = 0;
    let eventsUpdated = 0;
    let eventsSkipped = 0;
    let eventsFailed = 0;
    let remindersCreated = 0;
    let remindersRescheduled = 0;
    let archivedPath: string | null = null;
    const errors: RowValidationError[] = [];

    try {
      // 1. Pastikan aturan reminder default (termasuk H-7) tersedia
      await this.repo.ensureDefaultRules();

      // 2. Auto-download file terbaru dari ACADEMIC_EXCEL_DOWNLOAD_URL ke folder staging
      await downloadCalendarExcelToStaging(downloadUrl, stagingPath);

      // 3. Hitung checksum SHA-256 & cek apakah file identik dengan sync sukses terakhir
      fileChecksum = await computeFileSha256(stagingPath);
      if (!options.force && (await this.repo.hasSuccessfulSyncWithChecksum(fileChecksum))) {
        archivedPath = await this.housekeeping.archiveStagingFile(stagingPath);
        await this.housekeeping.pruneOldArchives();

        await this.repo.finalizeSyncLog(syncLog.id, {
          status: "SKIPPED_UNCHANGED",
          fileChecksum,
          archivedPath,
        });

        logger.info("[AcademicSync] File identik dengan sync sukses sebelumnya (SKIPPED_UNCHANGED)", {
          fileChecksum,
          archivedPath,
        });

        return {
          syncLogId: syncLog.id,
          status: "SKIPPED_UNCHANGED",
          sourceFile: STAGING_FILENAME,
          fileChecksum,
          totalRowsRead: 0,
          rowsDedupedInFile: 0,
          eventsInserted: 0,
          eventsUpdated: 0,
          eventsSkipped: 0,
          eventsFailed: 0,
          remindersCreated: 0,
          remindersRescheduled: 0,
          archivedPath,
          errors: [],
        };
      }

      // 4. Baca EventsTable dari Excel
      const rawRows = await readEventsTableFromExcel(stagingPath);
      totalRowsRead = rawRows.length;

      // 5. Deduplikasi in-file (menangani append-only Power Automate)
      const dedup = deduplicateRawRows(rawRows);
      rowsDedupedInFile = dedup.duplicatesRemoved;
      errors.push(...dedup.invalidRows);

      // 6. Normalisasi & validasi per baris
      const normalizedEvents: NormalizedCalendarEvent[] = [];
      const muteWeeklyLecture = this.isWeeklyLectureMuted();

      for (const row of dedup.dedupedRows) {
        const res = normalizeEventRow(row, { muteWeeklyLecture });
        if (res.error) {
          errors.push(res.error);
        } else if (res.event) {
          normalizedEvents.push(res.event);
        }
      }
      eventsFailed = errors.length;

      // 7. Ambil rules & target WA pribadi
      const rules = await this.repo.getAllRules();
      const targetRecipient = this.getTargetRecipient();
      if (!targetRecipient) {
        logger.warn(
          "[AcademicSync] ACADEMIC_REMINDER_TARGET_PHONE belum diisi. Event tetap disimpan, namun scheduled_reminders baru tidak akan dibuat."
        );
      }

      // 8. Batch upsert ke PostgreSQL (maks 30 baris per batch agar event loop & RAM 256MB aman)
      const batchSize = this.getBatchSize();
      const batches = chunkArray(normalizedEvents, batchSize);
      const now = new Date();

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        try {
          const batchSummary = await this.repo.upsertEventsBatch(
            batch,
            rules,
            targetRecipient,
            now
          );
          eventsInserted += batchSummary.eventsInserted;
          eventsUpdated += batchSummary.eventsUpdated;
          eventsSkipped += batchSummary.eventsSkipped;
          remindersCreated += batchSummary.remindersCreated;
          remindersRescheduled += batchSummary.remindersRescheduled;
        } catch (batchErr: any) {
          logger.error(`[AcademicSync] Batch #${i + 1} gagal, mencoba isolasi per-event...`, {
            error: batchErr?.message || String(batchErr),
          });
          // Fallback partial isolation agar 1 event bermasalah tidak membatalkan seluruh batch
          for (const singleEvent of batch) {
            try {
              const singleSummary = await this.repo.upsertEventsBatch(
                [singleEvent],
                rules,
                targetRecipient,
                now
              );
              eventsInserted += singleSummary.eventsInserted;
              eventsUpdated += singleSummary.eventsUpdated;
              eventsSkipped += singleSummary.eventsSkipped;
              remindersCreated += singleSummary.remindersCreated;
              remindersRescheduled += singleSummary.remindersRescheduled;
            } catch (singleErr: any) {
              eventsFailed++;
              errors.push({
                rowNumber: -1,
                eventId: singleEvent.eventId,
                reason: `DB upsert gagal: ${singleErr?.message || String(singleErr)}`,
              });
            }
          }
        }
      }

      // 9. Housekeeping setelah DB commit selesai: arsipkan staging & bersihkan arsip lama (> 2 hari)
      archivedPath = await this.housekeeping.archiveStagingFile(stagingPath, now);
      await this.housekeeping.pruneOldArchives(now);

      const finalStatus: CalendarSyncStatus =
        eventsFailed > 0 ? "PARTIAL_SUCCESS" : "SUCCESS";

      await this.repo.finalizeSyncLog(syncLog.id, {
        status: finalStatus,
        fileChecksum,
        totalRowsRead,
        rowsDedupedInFile,
        eventsInserted,
        eventsUpdated,
        eventsSkipped,
        eventsFailed,
        remindersCreated,
        remindersRescheduled,
        archivedPath,
        errorSummary: errors.length > 0 ? errors.slice(0, 50) : null,
      });

      logger.info("[AcademicSync] Sinkronisasi kalender selesai", {
        status: finalStatus,
        totalRowsRead,
        rowsDedupedInFile,
        eventsInserted,
        eventsUpdated,
        eventsSkipped,
        eventsFailed,
        remindersCreated,
        remindersRescheduled,
      });

      return {
        syncLogId: syncLog.id,
        status: finalStatus,
        sourceFile: STAGING_FILENAME,
        fileChecksum,
        totalRowsRead,
        rowsDedupedInFile,
        eventsInserted,
        eventsUpdated,
        eventsSkipped,
        eventsFailed,
        remindersCreated,
        remindersRescheduled,
        archivedPath,
        errors,
      };
    } catch (err: any) {
      const errorMessage = err?.message || String(err);
      logger.error("[AcademicSync] Sinkronisasi kalender gagal", { error: errorMessage });

      await this.repo.finalizeSyncLog(syncLog.id, {
        status: "FAILED",
        fileChecksum,
        totalRowsRead,
        rowsDedupedInFile,
        eventsInserted,
        eventsUpdated,
        eventsSkipped,
        eventsFailed,
        remindersCreated,
        remindersRescheduled,
        archivedPath,
        errorSummary: { message: errorMessage },
      });

      throw err;
    } finally {
      this.isRunning = false;
    }
  }
}

export const academicSyncService = new AcademicSyncService();
