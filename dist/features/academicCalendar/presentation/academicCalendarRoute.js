// src/features/academicCalendar/presentation/academicCalendarRoute.ts
import { Hono } from "hono";
import { requireAdmin } from "../../../core/middlewares/role.middleware.js";
import { dispatchRemindersNowController, listAcademicEventsController, listReminderRulesController, listSyncLogsController, triggerAcademicSyncController, updateReminderRuleController, } from "../services/academicCalendarController.js";
/**
 * Mengizinkan akses melalui:
 * 1. API Key (`x-api-key` atau `Authorization: Bearer <WA_BOT_API_KEY>`) untuk otomatisasi/CLI, ATAU
 * 2. Session Administrator (Better Auth `role === "admin"`).
 */
const requireAdminOrApiKey = async (c, next) => {
    const apiKey = c.req.header("x-api-key") || c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
    const validApiKey = process.env.WA_BOT_API_KEY;
    if (validApiKey && apiKey && apiKey === validApiKey) {
        await next();
        return;
    }
    return requireAdmin(c, next);
};
export const academicCalendarRoute = new Hono();
academicCalendarRoute.use("*", requireAdminOrApiKey);
academicCalendarRoute.get("/events", listAcademicEventsController);
academicCalendarRoute.post("/sync", triggerAcademicSyncController);
academicCalendarRoute.get("/sync-logs", listSyncLogsController);
academicCalendarRoute.get("/rules", listReminderRulesController);
academicCalendarRoute.patch("/rules/:id", updateReminderRuleController);
academicCalendarRoute.post("/dispatch-now", dispatchRemindersNowController);
