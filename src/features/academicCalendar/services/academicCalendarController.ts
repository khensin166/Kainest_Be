// src/features/academicCalendar/services/academicCalendarController.ts
import type { Context } from "hono";
import { logger } from "../../../infrastructure/logger/logger.js";
import { AcademicCalendarRepository } from "../data/AcademicCalendarRepository.js";
import { formatWibDateTime } from "../domain/calendarNormalizer.js";
import type { AcademicEventCategory } from "../domain/types.js";
import { academicReminderDispatcher } from "./AcademicReminderDispatcher.js";
import { academicSyncService } from "./AcademicSyncService.js";

const repo = new AcademicCalendarRepository();
const VALID_CATEGORIES = new Set<AcademicEventCategory>([
  "ASSIGNMENT",
  "GROUP_ASSIGNMENT",
  "QUIZ",
  "VIRTUAL_CONFERENCE",
  "LECTURE_WEEKLY",
  "OTHER",
]);

export const listAcademicEventsController = async (c: Context) => {
  try {
    const categoryParam = c.req.query("category")?.toUpperCase() as AcademicEventCategory | undefined;
    const includeMuted = c.req.query("includeMuted") === "true";
    const fromParam = c.req.query("from");
    const toParam = c.req.query("to");
    const limitParam = Number.parseInt(c.req.query("limit") || "50", 10);

    const category =
      categoryParam && VALID_CATEGORIES.has(categoryParam) ? categoryParam : undefined;
    const from = fromParam ? new Date(fromParam) : undefined;
    const to = toParam ? new Date(toParam) : undefined;

    const events = await repo.listEvents({
      category,
      includeMuted,
      from: from && !Number.isNaN(from.getTime()) ? from : undefined,
      to: to && !Number.isNaN(to.getTime()) ? to : undefined,
      limit: Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50,
    });

    const data = events.map((ev) => ({
      ...ev,
      startWib: formatWibDateTime(ev.startUtc),
      endWib: formatWibDateTime(ev.endUtc),
      referenceTimeWib: formatWibDateTime(ev.referenceTimeUtc),
      scheduledReminders: ev.scheduledReminders.map((rem) => ({
        ...rem,
        scheduledAtWib: formatWibDateTime(rem.scheduledAt),
      })),
    }));

    return c.json({ success: true, total: data.length, data });
  } catch (err: any) {
    logger.error("[AcademicCalendarController] listEvents error", { error: err?.message });
    return c.json({ success: false, message: "Gagal mengambil daftar event kuliah" }, 500);
  }
};

export const triggerAcademicSyncController = async (c: Context) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const force = body?.force === true || c.req.query("force") === "true";
    const report = await academicSyncService.runSync({ force });
    return c.json({ success: true, data: report });
  } catch (err: any) {
    logger.error("[AcademicCalendarController] triggerSync error", { error: err?.message });
    return c.json(
      { success: false, message: err?.message || "Sinkronisasi kalender gagal" },
      500
    );
  }
};

export const listSyncLogsController = async (c: Context) => {
  try {
    const limit = Number.parseInt(c.req.query("limit") || "20", 10);
    const logs = await repo.listSyncLogs(
      Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20
    );
    return c.json({ success: true, total: logs.length, data: logs });
  } catch (err: any) {
    logger.error("[AcademicCalendarController] listSyncLogs error", { error: err?.message });
    return c.json({ success: false, message: "Gagal mengambil sync logs" }, 500);
  }
};

export const listReminderRulesController = async (c: Context) => {
  try {
    await repo.ensureDefaultRules();
    const rules = await repo.getAllRules();
    return c.json({ success: true, total: rules.length, data: rules });
  } catch (err: any) {
    logger.error("[AcademicCalendarController] listRules error", { error: err?.message });
    return c.json({ success: false, message: "Gagal mengambil reminder rules" }, 500);
  }
};

export const updateReminderRuleController = async (c: Context) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return c.json({ success: false, message: "Payload JSON tidak valid" }, 400);
    }

    const updateData: { isActive?: boolean; targetRecipient?: string | null; label?: string } = {};
    if (typeof body.isActive === "boolean") updateData.isActive = body.isActive;
    if (body.targetRecipient === null || typeof body.targetRecipient === "string") {
      updateData.targetRecipient = body.targetRecipient;
    }
    if (typeof body.label === "string" && body.label.trim()) {
      updateData.label = body.label.trim();
    }

    const updated = await repo.updateRule(id, updateData);
    return c.json({ success: true, data: updated });
  } catch (err: any) {
    logger.error("[AcademicCalendarController] updateRule error", { error: err?.message });
    return c.json({ success: false, message: "Gagal memperbarui reminder rule" }, 500);
  }
};

export const dispatchRemindersNowController = async (c: Context) => {
  try {
    const recovered = await repo.recoverStaleProcessingReminders(10, 3);
    const summary = await academicReminderDispatcher.dispatchDueReminders();
    return c.json({ success: true, data: { recovered, ...summary } });
  } catch (err: any) {
    logger.error("[AcademicCalendarController] dispatchNow error", { error: err?.message });
    return c.json({ success: false, message: "Gagal menjalankan dispatcher" }, 500);
  }
};
