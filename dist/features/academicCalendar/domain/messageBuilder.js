// src/features/academicCalendar/domain/messageBuilder.ts
import { formatWibDateTime } from "./calendarNormalizer.js";
const CATEGORY_HEADER = {
    ASSIGNMENT: {
        icon: "📝",
        title: "PENGINGAT TUGAS PERSONAL",
        timeLabel: "Deadline",
    },
    GROUP_ASSIGNMENT: {
        icon: "👥",
        title: "PENGINGAT TUGAS KELOMPOK",
        timeLabel: "Deadline",
    },
    QUIZ: {
        icon: "⚡",
        title: "PENGINGAT QUIZ KULIAH",
        timeLabel: "Deadline",
    },
    VIRTUAL_CONFERENCE: {
        icon: "🎥",
        title: "PENGINGAT VIRTUAL CLASS",
        timeLabel: "Mulai",
    },
    LECTURE_WEEKLY: {
        icon: "📚",
        title: "PENGINGAT SESI KULIAH ONLINE",
        timeLabel: "Mulai",
    },
    OTHER: {
        icon: "📅",
        title: "PENGINGAT JADWAL KULIAH",
        timeLabel: "Waktu",
    },
};
/**
 * Membangun pesan pengingat WhatsApp yang ringkas, informatif, dan dalam timezone Asia/Jakarta (WIB).
 */
export function buildAcademicReminderMessage(payload) {
    const meta = CATEGORY_HEADER[payload.category] || CATEGORY_HEADER.OTHER;
    const titleLine = `${meta.icon} *${meta.title} (${payload.ruleLabel})*`;
    const courseLine = `📌 *${payload.courseName || payload.subject}*`;
    const lines = [titleLine, "", courseLine];
    if (payload.activityLabel) {
        lines.push(`🔖 ${payload.activityLabel}`);
    }
    else {
        lines.push(`🔖 ${payload.subject}`);
    }
    const detailParts = [];
    if (payload.classCode)
        detailParts.push(`Kelas ${payload.classCode}`);
    if (payload.sessionNumber !== null && payload.sessionNumber !== undefined) {
        detailParts.push(`Sesi ${payload.sessionNumber}`);
    }
    if (payload.deliveryMode)
        detailParts.push(payload.deliveryMode);
    if (detailParts.length > 0) {
        lines.push(`🏫 ${detailParts.join(" • ")}`);
    }
    lines.push(`⏰ ${meta.timeLabel}: *${formatWibDateTime(payload.referenceTimeUtc)}*`);
    if (payload.activityUrl) {
        lines.push("", "🔗 *Buka Aktivitas BINUSMAYA:*", payload.activityUrl);
    }
    else if (payload.webLink) {
        lines.push("", "🔗 *Buka di Outlook Calendar:*", payload.webLink);
    }
    return lines.join("\n");
}
