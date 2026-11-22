// src/features/academicCalendar/services/AcademicReminderDispatcher.ts
import { logger } from "../../../infrastructure/logger/logger.js";
import { sendTextViaGowaWithResult } from "../../../utils/gowaService.js";
import { AcademicCalendarRepository } from "../data/AcademicCalendarRepository.js";
import { buildAcademicReminderMessage } from "../domain/messageBuilder.js";
import { normalizeWhatsAppRecipient } from "../domain/reminderCalculator.js";

const SEND_DELAY_MS = 1_500;
const MAX_BATCH_DISPATCH = 20;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface DispatchSummary {
  claimed: number;
  sent: number;
  skipped: number;
  failed: number;
}

export class AcademicReminderDispatcher {
  private isDispatching = false;

  constructor(private readonly repo = new AcademicCalendarRepository()) {}

  private isAllowedInCurrentEnv(recipient: string): boolean {
    const envMode = process.env.BOT_ENV_MODE || "production";
    if (envMode === "production") {
      return true;
    }

    const allowedList = (process.env.STAGING_ALLOWED_NUMBERS || "")
      .split(",")
      .map((item) => normalizeWhatsAppRecipient(item))
      .filter(Boolean);

    const normalizedRecipient = normalizeWhatsAppRecipient(recipient);
    const bareRecipient = normalizedRecipient.split("@")[0];

    return allowedList.some(
      (allowed) => allowed === normalizedRecipient || allowed.split("@")[0] === bareRecipient
    );
  }

  /**
   * Mengambil reminder jatuh tempo (atomic claim FOR UPDATE SKIP LOCKED) dan mengirimnya ke WA pribadi via GOWA.
   */
  async dispatchDueReminders(limit: number = MAX_BATCH_DISPATCH): Promise<DispatchSummary> {
    if (this.isDispatching) {
      return { claimed: 0, sent: 0, skipped: 0, failed: 0 };
    }

    this.isDispatching = true;
    const summary: DispatchSummary = { claimed: 0, sent: 0, skipped: 0, failed: 0 };

    try {
      const dueItems = await this.repo.claimDueReminders(limit);
      summary.claimed = dueItems.length;

      if (dueItems.length === 0) {
        return summary;
      }

      const now = new Date();

      for (let i = 0; i < dueItems.length; i++) {
        const item = dueItems[i];
        const event = item.calendarEvent;
        const rule = item.rule;

        // 1. Jika event sudah di-mute atau aturan dimatikan -> SKIPPED
        if (event.isMuted || !rule.isActive) {
          await this.repo.markReminderSkipped(
            item.id,
            event.isMuted ? "Event di-mute" : "Aturan reminder nonaktif"
          );
          summary.skipped++;
          continue;
        }

        // 2. Jika waktu acuan (deadline / waktu mulai kelas) sendiri sudah lewat -> SKIPPED (anti reminder basi)
        if (event.referenceTimeUtc.getTime() <= now.getTime()) {
          await this.repo.markReminderSkipped(
            item.id,
            "Waktu deadline/mulai event sudah terlewat sebelum pengingat dikirim"
          );
          summary.skipped++;
          continue;
        }

        // 3. Staging safety guard
        if (!this.isAllowedInCurrentEnv(item.recipient)) {
          logger.info("[AcademicDispatcher] Melewati kirim WA (staging restricted)", {
            reminderId: item.id,
            recipient: item.recipient,
          });
          await this.repo.markReminderSkipped(
            item.id,
            `Staging mode restricted untuk recipient ${item.recipient}`
          );
          summary.skipped++;
          continue;
        }

        const message = buildAcademicReminderMessage({
          subject: event.subject,
          courseName: event.courseName,
          classCode: event.classCode,
          deliveryMode: event.deliveryMode,
          sessionNumber: event.sessionNumber,
          activityLabel: event.activityLabel,
          category: event.category,
          startUtc: event.startUtc,
          endUtc: event.endUtc,
          referenceTimeUtc: event.referenceTimeUtc,
          activityUrl: event.activityUrl,
          webLink: event.webLink,
          ruleLabel: rule.label,
        });

        const attemptNumber = item.retryCount + 1;
        const result = await sendTextViaGowaWithResult(item.recipient, message);

        if (result.ok) {
          await this.repo.markReminderSent({
            scheduledReminderId: item.id,
            calendarEventId: event.id,
            channel: item.channel,
            recipient: item.recipient,
            attemptNumber,
            payloadPreview: message.slice(0, 500),
            providerResponse: result.body?.slice(0, 500) ?? null,
          });
          summary.sent++;
          logger.info("[AcademicDispatcher] ✅ Pengingat kuliah terkirim", {
            reminderId: item.id,
            subject: event.subject,
            rule: rule.label,
            recipient: item.recipient,
          });
        } else {
          await this.repo.markReminderFailedOrRetry({
            scheduledReminderId: item.id,
            calendarEventId: event.id,
            channel: item.channel,
            recipient: item.recipient,
            currentRetryCount: item.retryCount,
            payloadPreview: message.slice(0, 500),
            errorMessage: result.error || "Unknown GOWA error",
          });
          summary.failed++;
        }

        // Jeda 1.5 detik antar pesan untuk menjaga kestabilan sesi GOWA
        if (i < dueItems.length - 1) {
          await sleep(SEND_DELAY_MS);
        }
      }

      return summary;
    } catch (err: any) {
      logger.error("[AcademicDispatcher] Error saat memproses pengingat kuliah", {
        error: err?.message || String(err),
      });
      return summary;
    } finally {
      this.isDispatching = false;
    }
  }
}

export const academicReminderDispatcher = new AcademicReminderDispatcher();
