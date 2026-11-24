// src/features/academicCalendar/services/AcademicCalendarCron.ts
import * as schedule from "node-schedule";
import { logger } from "../../../infrastructure/logger/logger.js";
import { AcademicCalendarRepository } from "../data/AcademicCalendarRepository.js";
import { academicReminderDispatcher } from "./AcademicReminderDispatcher.js";
import { academicSyncService } from "./AcademicSyncService.js";

const ENABLE_SCHEDULER = process.env.ENABLE_SCHEDULER === "true";
const DEFAULT_SYNC_CRON = "0 */6 * * *"; // Setiap 6 jam
const DEFAULT_DISPATCH_CRON = "*/5 * * * *"; // Setiap 5 menit

/**
 * Mengaktifkan scheduler BINUS LMS Academic Calendar (hanya jika ENABLE_SCHEDULER=true):
 * 1. Startup recovery: seed aturan default (termasuk H-7) & pulihkan job PROCESSING yang menggantung.
 * 2. Cron Sync + Housekeeping berkala (default setiap 6 jam).
 * 3. Cron DB-backed Dispatcher setiap 5 menit (tahan container restart).
 */
export function startAcademicCalendarScheduler(): void {
  if (!ENABLE_SCHEDULER) {
    logger.info(
      "[AcademicCalendarCron] ENABLE_SCHEDULER=false. Cron pengingat kuliah tidak dijalankan."
    );
    return;
  }

  const repo = new AcademicCalendarRepository();
  const rawSyncCron = (process.env.ACADEMIC_SYNC_CRON || "").trim();
  const syncCronExpr =
    rawSyncCron.split(/\s+/).length >= 5 ? rawSyncCron : DEFAULT_SYNC_CRON;
  const rawDispatchCron = (process.env.ACADEMIC_DISPATCH_CRON || "").trim();
  const dispatchCronExpr =
    rawDispatchCron.split(/\s+/).length >= 5 ? rawDispatchCron : DEFAULT_DISPATCH_CRON;

  // Startup initialization & crash recovery
  void (async () => {
    try {
      await repo.ensureDefaultRules();
      await repo.recoverStaleProcessingReminders(10, 3);

      // Jika URL download sudah dikonfigurasi, langsung cek sync saat startup agar data segar
      if (process.env.ACADEMIC_EXCEL_DOWNLOAD_URL) {
        await academicSyncService.runSync().catch((err) =>
          logger.error("[AcademicCalendarCron] Sync startup gagal", {
            error: err?.message || String(err),
          })
        );
      }

      // Langsung cek apakah ada reminder jatuh tempo yang tertunda saat restart
      await academicReminderDispatcher.dispatchDueReminders();
    } catch (err: any) {
      logger.error("[AcademicCalendarCron] Gagal inisialisasi startup", {
        error: err?.message || String(err),
      });
    }
  })();

  // Cron 1: Auto-Download Excel + Upsert + Housekeeping
  schedule.scheduleJob("academic-calendar-sync", syncCronExpr, async () => {
    if (!process.env.ACADEMIC_EXCEL_DOWNLOAD_URL) {
      return;
    }
    try {
      await academicSyncService.runSync();
    } catch (err: any) {
      logger.error("[AcademicCalendarCron] Sync terjadwal gagal", {
        error: err?.message || String(err),
      });
    }
  });

  // Cron 2: DB-backed Reminder Dispatcher
  schedule.scheduleJob("academic-calendar-dispatch", dispatchCronExpr, async () => {
    try {
      await repo.recoverStaleProcessingReminders(10, 3);
      await academicReminderDispatcher.dispatchDueReminders();
    } catch (err: any) {
      logger.error("[AcademicCalendarCron] Dispatch terjadwal gagal", {
        error: err?.message || String(err),
      });
    }
  });

  logger.info("[AcademicCalendarCron] ✅ Scheduler pengingat kuliah aktif", {
    syncCronExpr,
    dispatchCronExpr,
  });
}
