// src/features/academicCalendar/domain/messageBuilder.ts
import { formatWibDateTime } from "./calendarNormalizer.js";
import type { AcademicEventCategory } from "./types.js";

export interface AcademicMessagePayload {
  subject: string;
  courseName?: string | null;
  classCode?: string | null;
  deliveryMode?: string | null;
  sessionNumber?: number | null;
  activityLabel?: string | null;
  category: AcademicEventCategory;
  startUtc: Date;
  endUtc: Date;
  referenceTimeUtc: Date;
  activityUrl?: string | null;
  webLink?: string | null;
  ruleLabel: string;
}

const CATEGORY_HEADER: Record<AcademicEventCategory, { icon: string; title: string; timeLabel: string }> = {
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
export function buildAcademicReminderMessage(payload: AcademicMessagePayload): string {
  const meta = CATEGORY_HEADER[payload.category] || CATEGORY_HEADER.OTHER;
  const titleLine = `${meta.icon} *${meta.title} (${payload.ruleLabel})*`;
  const courseLine = `📌 *${payload.courseName || payload.subject}*`;

  const lines: string[] = [titleLine, "", courseLine];

  if (payload.activityLabel) {
    lines.push(`🔖 ${payload.activityLabel}`);
  } else {
    lines.push(`🔖 ${payload.subject}`);
  }

  const detailParts: string[] = [];
  if (payload.classCode) detailParts.push(`Kelas ${payload.classCode}`);
  if (payload.sessionNumber !== null && payload.sessionNumber !== undefined) {
    detailParts.push(`Sesi ${payload.sessionNumber}`);
  }
  if (payload.deliveryMode) detailParts.push(payload.deliveryMode);

  if (detailParts.length > 0) {
    lines.push(`🏫 ${detailParts.join(" • ")}`);
  }

  lines.push(`⏰ ${meta.timeLabel}: *${formatWibDateTime(payload.referenceTimeUtc)}*`);

  if (payload.activityUrl) {
    lines.push("", "🔗 *Buka Aktivitas BINUSMAYA:*", payload.activityUrl);
  } else if (payload.webLink) {
    lines.push("", "🔗 *Buka di Outlook Calendar:*", payload.webLink);
  }

  return lines.join("\n");
}
