import { prisma } from "../../../infrastructure/database/prisma.js";
import { logger } from "../../../infrastructure/logger/logger.js";
import { calculateReminderCandidates, DEFAULT_REMINDER_RULES, } from "../domain/reminderCalculator.js";
export class AcademicCalendarRepository {
    /**
     * Seed idempoten aturan reminder default (termasuk H-7).
     * Tidak menimpa perubahan isActive/targetRecipient yang sudah diubah admin.
     */
    async ensureDefaultRules() {
        for (const rule of DEFAULT_REMINDER_RULES) {
            await prisma.reminderRule.upsert({
                where: {
                    category_offsetMinutes_channel: {
                        category: rule.category,
                        offsetMinutes: rule.offsetMinutes,
                        channel: rule.channel,
                    },
                },
                update: {},
                create: {
                    category: rule.category,
                    offsetMinutes: rule.offsetMinutes,
                    label: rule.label,
                    channel: rule.channel,
                    isActive: rule.isActive,
                    targetRecipient: rule.targetRecipient ?? null,
                },
            });
        }
    }
    async getAllRules() {
        return prisma.reminderRule.findMany({
            orderBy: [{ category: "asc" }, { offsetMinutes: "asc" }],
        });
    }
    async updateRule(id, data) {
        return prisma.reminderRule.update({
            where: { id },
            data,
        });
    }
    async createSyncLog(sourceFile) {
        return prisma.calendarSyncLog.create({
            data: {
                sourceFile,
                status: "RUNNING",
            },
        });
    }
    async finalizeSyncLog(id, data) {
        return prisma.calendarSyncLog.update({
            where: { id },
            data: {
                status: data.status,
                fileChecksum: data.fileChecksum ?? undefined,
                totalRowsRead: data.totalRowsRead,
                rowsDedupedInFile: data.rowsDedupedInFile,
                eventsInserted: data.eventsInserted,
                eventsUpdated: data.eventsUpdated,
                eventsSkipped: data.eventsSkipped,
                eventsFailed: data.eventsFailed,
                remindersCreated: data.remindersCreated,
                remindersRescheduled: data.remindersRescheduled,
                archivedPath: data.archivedPath ?? undefined,
                errorSummary: data.errorSummary !== undefined
                    ? data.errorSummary
                    : undefined,
                finishedAt: new Date(),
            },
        });
    }
    async hasSuccessfulSyncWithChecksum(fileChecksum) {
        const existing = await prisma.calendarSyncLog.findFirst({
            where: {
                fileChecksum,
                status: { in: ["SUCCESS", "PARTIAL_SUCCESS"] },
            },
            select: { id: true },
        });
        return Boolean(existing);
    }
    /**
     * Upsert idempoten satu batch event (maks 30 item) ke PostgreSQL + penjadwalan/reschedule reminder.
     * Hanya memperbarui event & pending reminder jika lastModifiedUtc berubah (lebih baru).
     */
    async upsertEventsBatch(events, rules, defaultRecipient, now = new Date()) {
        const summary = {
            eventsInserted: 0,
            eventsUpdated: 0,
            eventsSkipped: 0,
            remindersCreated: 0,
            remindersRescheduled: 0,
        };
        if (events.length === 0) {
            return summary;
        }
        const eventIds = events.map((e) => e.eventId);
        const existingRows = await prisma.calendarEvent.findMany({
            where: { eventId: { in: eventIds } },
            include: { scheduledReminders: true },
        });
        const existingMap = new Map(existingRows.map((row) => [row.eventId, row]));
        await prisma.$transaction(async (tx) => {
            for (const incoming of events) {
                const existing = existingMap.get(incoming.eventId);
                if (!existing) {
                    const createdEvent = await tx.calendarEvent.create({
                        data: {
                            eventId: incoming.eventId,
                            subject: incoming.subject,
                            courseName: incoming.courseName,
                            classCode: incoming.classCode,
                            deliveryMode: incoming.deliveryMode,
                            sessionNumber: incoming.sessionNumber,
                            activityLabel: incoming.activityLabel,
                            category: incoming.category,
                            startUtc: incoming.startUtc,
                            endUtc: incoming.endUtc,
                            referenceTimeUtc: incoming.referenceTimeUtc,
                            lastModifiedUtc: incoming.lastModifiedUtc,
                            bodyHtml: incoming.bodyHtml,
                            activityUrl: incoming.activityUrl,
                            webLink: incoming.webLink,
                            isMuted: incoming.isMuted,
                        },
                    });
                    summary.eventsInserted++;
                    const candidates = calculateReminderCandidates(incoming, rules, defaultRecipient, now);
                    if (candidates.length > 0) {
                        const result = await tx.scheduledReminder.createMany({
                            data: candidates.map((c) => ({
                                calendarEventId: createdEvent.id,
                                ruleId: c.ruleId,
                                eventVersionUtc: c.eventVersionUtc,
                                scheduledAt: c.scheduledAt,
                                channel: c.channel,
                                recipient: c.recipient,
                                status: "PENDING",
                            })),
                            skipDuplicates: true,
                        });
                        summary.remindersCreated += result.count;
                    }
                    continue;
                }
                // Bandingkan LastModifiedUtc: skip jika tidak lebih baru
                if (incoming.lastModifiedUtc.getTime() <= existing.lastModifiedUtc.getTime()) {
                    summary.eventsSkipped++;
                    continue;
                }
                // Event berubah -> update data event & reschedule PENDING reminders
                await tx.calendarEvent.update({
                    where: { id: existing.id },
                    data: {
                        subject: incoming.subject,
                        courseName: incoming.courseName,
                        classCode: incoming.classCode,
                        deliveryMode: incoming.deliveryMode,
                        sessionNumber: incoming.sessionNumber,
                        activityLabel: incoming.activityLabel,
                        category: incoming.category,
                        startUtc: incoming.startUtc,
                        endUtc: incoming.endUtc,
                        referenceTimeUtc: incoming.referenceTimeUtc,
                        lastModifiedUtc: incoming.lastModifiedUtc,
                        bodyHtml: incoming.bodyHtml,
                        activityUrl: incoming.activityUrl,
                        webLink: incoming.webLink,
                        isMuted: incoming.isMuted,
                    },
                });
                summary.eventsUpdated++;
                const candidates = calculateReminderCandidates(incoming, rules, defaultRecipient, now);
                const candidateKeySet = new Set(candidates.map((c) => `${c.ruleId}:${c.channel}`));
                const existingReminderMap = new Map(existing.scheduledReminders.map((r) => [`${r.ruleId}:${r.channel}`, r]));
                // 1. Batalkan reminder PENDING yang tidak lagi relevan (mis. event di-mute atau waktu sudah lewat)
                for (const rem of existing.scheduledReminders) {
                    if (rem.status === "PENDING" && !candidateKeySet.has(`${rem.ruleId}:${rem.channel}`)) {
                        await tx.scheduledReminder.update({
                            where: { id: rem.id },
                            data: { status: "CANCELLED" },
                        });
                    }
                }
                // 2. Buat baru atau reschedule PENDING reminder sesuai waktu baru
                for (const candidate of candidates) {
                    const key = `${candidate.ruleId}:${candidate.channel}`;
                    const existingRem = existingReminderMap.get(key);
                    if (!existingRem) {
                        await tx.scheduledReminder.create({
                            data: {
                                calendarEventId: existing.id,
                                ruleId: candidate.ruleId,
                                eventVersionUtc: candidate.eventVersionUtc,
                                scheduledAt: candidate.scheduledAt,
                                channel: candidate.channel,
                                recipient: candidate.recipient,
                                status: "PENDING",
                            },
                        });
                        summary.remindersCreated++;
                    }
                    else if (existingRem.status === "PENDING" &&
                        (existingRem.scheduledAt.getTime() !== candidate.scheduledAt.getTime() ||
                            existingRem.recipient !== candidate.recipient)) {
                        await tx.scheduledReminder.update({
                            where: { id: existingRem.id },
                            data: {
                                scheduledAt: candidate.scheduledAt,
                                eventVersionUtc: candidate.eventVersionUtc,
                                recipient: candidate.recipient,
                            },
                        });
                        summary.remindersRescheduled++;
                    }
                    // Jika status === "SENT", sengaja TIDAK dikirim ulang (idempoten)
                }
            }
        }, { timeout: 20000 });
        return summary;
    }
    /**
     * Startup & periodic recovery: mengembalikan job yang tersangkut di status PROCESSING
     * (misal karena container crash/restart di tengah kirim WA) kembali ke PENDING.
     */
    async recoverStaleProcessingReminders(staleMinutes = 10, maxRetries = 3) {
        const cutoff = new Date(Date.now() - staleMinutes * 60000);
        const stale = await prisma.scheduledReminder.findMany({
            where: {
                status: "PROCESSING",
                lockedAt: { lt: cutoff },
            },
            select: { id: true, retryCount: true },
        });
        if (stale.length === 0)
            return 0;
        let recovered = 0;
        for (const item of stale) {
            const nextRetry = item.retryCount + 1;
            if (nextRetry < maxRetries) {
                await prisma.scheduledReminder.update({
                    where: { id: item.id },
                    data: {
                        status: "PENDING",
                        lockedAt: null,
                        retryCount: nextRetry,
                        lastError: "Recovered from stale PROCESSING lock after restart",
                    },
                });
                recovered++;
            }
            else {
                await prisma.scheduledReminder.update({
                    where: { id: item.id },
                    data: {
                        status: "FAILED",
                        lockedAt: null,
                        retryCount: nextRetry,
                        lastError: "Exceeded max retries after stale PROCESSING lock",
                    },
                });
            }
        }
        if (recovered > 0) {
            logger.warn("[AcademicRepo] Memulihkan stale PROCESSING reminders", { recovered });
        }
        return recovered;
    }
    /**
     * Atomic claim menggunakan PostgreSQL FOR UPDATE SKIP LOCKED agar tidak ada double-send
     * meskipun dua tick cron overlap atau ada lebih dari satu instance.
     */
    async claimDueReminders(limit = 20) {
        const claimed = await prisma.$queryRaw `
      WITH due AS (
        SELECT "id"
        FROM kainest."ScheduledReminder"
        WHERE "status" = 'PENDING'::kainest."ScheduledReminderStatus"
          AND "scheduledAt" <= NOW()
        ORDER BY "scheduledAt" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE kainest."ScheduledReminder" sr
      SET "status" = 'PROCESSING'::kainest."ScheduledReminderStatus",
          "lockedAt" = NOW(),
          "updatedAt" = NOW()
      FROM due
      WHERE sr."id" = due."id"
      RETURNING sr."id"
    `;
        if (claimed.length === 0) {
            return [];
        }
        const ids = claimed.map((row) => row.id);
        return prisma.scheduledReminder.findMany({
            where: { id: { in: ids } },
            include: {
                calendarEvent: true,
                rule: true,
            },
            orderBy: { scheduledAt: "asc" },
        });
    }
    async markReminderSent(params) {
        const now = new Date();
        await prisma.$transaction([
            prisma.scheduledReminder.update({
                where: { id: params.scheduledReminderId },
                data: {
                    status: "SENT",
                    sentAt: now,
                    lockedAt: null,
                    lastError: null,
                },
            }),
            prisma.academicNotificationLog.create({
                data: {
                    scheduledReminderId: params.scheduledReminderId,
                    calendarEventId: params.calendarEventId,
                    channel: params.channel,
                    recipient: params.recipient,
                    attemptNumber: params.attemptNumber,
                    deliveryStatus: "SENT",
                    payloadPreview: params.payloadPreview,
                    providerResponse: params.providerResponse ?? null,
                    sentAt: now,
                },
            }),
        ]);
    }
    async markReminderSkipped(scheduledReminderId, reason) {
        await prisma.scheduledReminder.update({
            where: { id: scheduledReminderId },
            data: {
                status: "SKIPPED",
                lockedAt: null,
                lastError: reason,
            },
        });
    }
    async markReminderFailedOrRetry(params) {
        const maxRetries = params.maxRetries ?? 3;
        const retryDelayMinutes = params.retryDelayMinutes ?? 10;
        const attemptNumber = params.currentRetryCount + 1;
        const willRetry = attemptNumber < maxRetries;
        await prisma.$transaction([
            prisma.scheduledReminder.update({
                where: { id: params.scheduledReminderId },
                data: {
                    status: willRetry ? "PENDING" : "FAILED",
                    retryCount: attemptNumber,
                    lockedAt: null,
                    lastError: params.errorMessage,
                    ...(willRetry
                        ? { scheduledAt: new Date(Date.now() + retryDelayMinutes * 60000) }
                        : {}),
                },
            }),
            prisma.academicNotificationLog.create({
                data: {
                    scheduledReminderId: params.scheduledReminderId,
                    calendarEventId: params.calendarEventId,
                    channel: params.channel,
                    recipient: params.recipient,
                    attemptNumber,
                    deliveryStatus: "FAILED",
                    payloadPreview: params.payloadPreview,
                    errorMessage: params.errorMessage,
                },
            }),
        ]);
    }
    async listEvents(filters) {
        return prisma.calendarEvent.findMany({
            where: {
                ...(filters.category ? { category: filters.category } : {}),
                ...(filters.includeMuted ? {} : { isMuted: false }),
                ...(filters.from || filters.to
                    ? {
                        referenceTimeUtc: {
                            ...(filters.from ? { gte: filters.from } : {}),
                            ...(filters.to ? { lte: filters.to } : {}),
                        },
                    }
                    : {}),
            },
            include: {
                scheduledReminders: {
                    orderBy: { scheduledAt: "asc" },
                    include: {
                        rule: { select: { label: true, offsetMinutes: true } },
                    },
                },
            },
            orderBy: { referenceTimeUtc: "asc" },
            take: filters.limit ?? 50,
        });
    }
    async listSyncLogs(limit = 20) {
        return prisma.calendarSyncLog.findMany({
            orderBy: { startedAt: "desc" },
            take: limit,
        });
    }
}
