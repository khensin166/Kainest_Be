// src/features/academicCalendar/domain/calendarNormalizer.ts
import type {
  AcademicEventCategory,
  NormalizedCalendarEvent,
  ParsedBodyMetadata,
  RawExcelEventRow,
  RowValidationError,
} from "./types.js";

const EXCEL_EPOCH_OFFSET_DAYS = 25569; // Days between 1899-12-30 and 1970-01-01
const MS_PER_DAY = 86_400_000;

/**
 * Decode entitas HTML umum pada atribut href (mis. &amp; -> &).
 */
function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

/**
 * Normalisasi angka/string/Date dari sel Excel ke Date UTC valid.
 * Mendukung:
 * 1. ISO string dengan 7-digit fractional seconds (.2271016+00:00) dari Power Automate/Graph API
 * 2. Objek JS Date dari exceljs
 * 3. Excel serial date number (mis. 46341.708333)
 */
export function parseExcelUtcDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return excelSerialToDate(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Jika string berupa angka serial Excel (contoh "46341.70833")
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const serial = Number(trimmed);
      if (Number.isFinite(serial)) {
        return excelSerialToDate(serial);
      }
    }

    // Potong fractional seconds > 3 digit (mis. .2271016+00:00 -> .227+00:00)
    let normalized = trimmed.replace(/(\.\d{3})\d+/, "$1");

    // Jika belum ada penanda timezone (Z atau ±HH:MM / ±HHMM), perlakukan sebagai UTC
    if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(normalized)) {
      // Ubah spasi pemisah tanggal-waktu menjadi 'T' jika perlu
      normalized = normalized.replace(" ", "T") + "Z";
    }

    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  // ExcelJS rich-text atau formula result object
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("result" in obj) {
      return parseExcelUtcDate(obj.result);
    }
    if ("text" in obj) {
      return parseExcelUtcDate(obj.text);
    }
  }

  return null;
}

function excelSerialToDate(serial: number): Date | null {
  // Validasi rentang wajar (tahun 2000 ~ 36526 hingga tahun 2100 ~ 73050)
  if (serial < 25569 || serial > 80000) {
    return null;
  }
  const utcMs = Math.round((serial - EXCEL_EPOCH_OFFSET_DAYS) * MS_PER_DAY);
  const date = new Date(utcMs);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Ekstrak string bersih dari sel Excel (termasuk objek hyperlink/richText exceljs).
 */
export function extractCellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.hyperlink === "string" && obj.hyperlink.trim()) {
      return obj.hyperlink.trim();
    }
    if (typeof obj.text === "string") {
      return obj.text.trim();
    }
    if (Array.isArray(obj.richText)) {
      return obj.richText
        .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
        .join("")
        .trim();
    }
    if ("result" in obj) {
      return extractCellText(obj.result);
    }
  }
  return "";
}

/**
 * Ekstrak metadata akademik dan link OPEN ACTIVITY dari BodyHtml BINUS LMS.
 */
export function extractBodyMetadata(bodyHtml: string | null | undefined): ParsedBodyMetadata {
  if (!bodyHtml) {
    return {
      classCode: null,
      deliveryMode: null,
      sessionNumber: null,
      activityLabel: null,
      activityUrl: null,
    };
  }

  const classMatch = bodyHtml.match(/Class\s+([A-Z0-9_-]+)/i);
  const deliveryMatch = bodyHtml.match(/Delivery\s*mode\s*:\s*([^<\r\n]+)/i);
  const sessionMatch = bodyHtml.match(/Session\s*:\s*(\d+)/i);
  const labelMatch = bodyHtml.match(/((?:PAS|TAS|QIZ)\s*:\s*[^<\r\n]+)/i);
  const hrefMatch = bodyHtml.match(/<a\s+[^>]*href\s*=\s*["']([^"']+)["']/i);

  const sessionNumber = sessionMatch ? Number.parseInt(sessionMatch[1], 10) : null;

  return {
    classCode: classMatch ? classMatch[1].trim().toUpperCase() : null,
    deliveryMode: deliveryMatch ? deliveryMatch[1].trim() : null,
    sessionNumber: sessionNumber !== null && !Number.isNaN(sessionNumber) ? sessionNumber : null,
    activityLabel: labelMatch ? labelMatch[1].replace(/\s+/g, " ").trim() : null,
    activityUrl: hrefMatch ? decodeHtmlEntities(hrefMatch[1].trim()) : null,
  };
}

/**
 * Ekstrak nama mata kuliah dari Subject BINUS LMS.
 * Contoh: "Assignment: LEC - Decision Support Systems" -> "Decision Support Systems"
 */
export function extractCourseName(subject: string): string | null {
  const trimmed = subject.trim();
  if (!trimmed) return null;
  const sepIndex = trimmed.indexOf(" - ");
  if (sepIndex !== -1) {
    const course = trimmed.slice(sepIndex + 3).trim();
    return course || trimmed;
  }
  return trimmed;
}

/**
 * Klasifikasi kategori aktivitas sesuai aturan bisnis BINUS LMS:
 * 1. PAS: di BodyHtml -> ASSIGNMENT
 * 2. TAS: di BodyHtml -> GROUP_ASSIGNMENT
 * 3. Quiz: di Subject atau QIZ: di BodyHtml -> QUIZ
 * 4. Virtual Class: di Subject -> VIRTUAL_CONFERENCE
 * 5. Online: LEC di Subject -> LECTURE_WEEKLY
 */
export function classifyAcademicEvent(
  subject: string,
  bodyHtml: string | null | undefined
): AcademicEventCategory {
  const body = bodyHtml || "";
  const subj = subject.trim();

  if (/\bPAS\s*:/i.test(body)) {
    return "ASSIGNMENT";
  }
  if (/\bTAS\s*:/i.test(body)) {
    return "GROUP_ASSIGNMENT";
  }
  if (/^\s*Quiz\s*:/i.test(subj) || /\bQIZ\s*:/i.test(body)) {
    return "QUIZ";
  }
  if (/^\s*Virtual\s+Class\s*:/i.test(subj)) {
    return "VIRTUAL_CONFERENCE";
  }
  if (/^\s*Online\s*:\s*LEC\b/i.test(subj)) {
    return "LECTURE_WEEKLY";
  }
  if (/^\s*Assignment\s*:/i.test(subj)) {
    return "ASSIGNMENT";
  }
  return "OTHER";
}

/**
 * Menentukan waktu acuan pengingat:
 * - ASSIGNMENT, GROUP_ASSIGNMENT, QUIZ -> EndUtc (deadline)
 * - VIRTUAL_CONFERENCE, LECTURE_WEEKLY, OTHER -> StartUtc (waktu mulai)
 */
export function getReferenceTimeUtc(
  category: AcademicEventCategory,
  startUtc: Date,
  endUtc: Date
): Date {
  if (category === "ASSIGNMENT" || category === "GROUP_ASSIGNMENT" || category === "QUIZ") {
    return endUtc;
  }
  return startUtc;
}

/**
 * Format Date UTC ke string tampilan Asia/Jakarta (WIB).
 */
export function formatWibDateTime(dateUtc: Date): string {
  const formatted = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(dateUtc);

  return `${formatted.replace(/\./g, ":")} WIB`;
}

export interface DeduplicateResult {
  dedupedRows: RawExcelEventRow[];
  duplicatesRemoved: number;
  invalidRows: RowValidationError[];
}

/**
 * Deduplikasi baris mentah dalam 1 file Excel berdasarkan EventId.
 * Karena Power Automate menggunakan "Add a row into a table" (append-only),
 * EventId yang sama dapat muncul berkali-kali. Kita pilih versi dengan
 * LastModifiedUtc paling baru (tie-breaker: baris yang muncul paling akhir).
 */
export function deduplicateRawRows(rows: RawExcelEventRow[]): DeduplicateResult {
  const byEventId = new Map<string, { row: RawExcelEventRow; modifiedMs: number }>();
  const invalidRows: RowValidationError[] = [];
  let duplicatesRemoved = 0;

  for (const row of rows) {
    const eventId = extractCellText(row.EventId);
    const subject = extractCellText(row.Subject);

    // Abaikan baris yang benar-benar kosong di akhir tabel Excel
    if (!eventId && !subject && !row.StartUtc && !row.EndUtc) {
      continue;
    }

    if (!eventId) {
      invalidRows.push({
        rowNumber: row.rowNumber,
        reason: "EventId kosong atau tidak valid",
      });
      continue;
    }

    const modifiedDate = parseExcelUtcDate(row.LastModifiedUtc);
    const modifiedMs = modifiedDate ? modifiedDate.getTime() : 0;

    const existing = byEventId.get(eventId);
    if (!existing) {
      byEventId.set(eventId, { row, modifiedMs });
    } else {
      duplicatesRemoved++;
      // Pertahankan versi terbaru (jika timestamp sama, baris terbawah menang)
      if (modifiedMs >= existing.modifiedMs) {
        byEventId.set(eventId, { row, modifiedMs });
      }
    }
  }

  return {
    dedupedRows: Array.from(byEventId.values()).map((entry) => entry.row),
    duplicatesRemoved,
    invalidRows,
  };
}

export interface NormalizeOptions {
  muteWeeklyLecture?: boolean;
}

/**
 * Normalisasi 1 baris mentah Excel menjadi objek NormalizedCalendarEvent tervalidasi.
 */
export function normalizeEventRow(
  row: RawExcelEventRow,
  options: NormalizeOptions = {}
): { event?: NormalizedCalendarEvent; error?: RowValidationError } {
  const muteWeeklyLecture = options.muteWeeklyLecture ?? true;

  const eventId = extractCellText(row.EventId);
  if (!eventId) {
    return { error: { rowNumber: row.rowNumber, reason: "EventId kosong" } };
  }

  const subject = extractCellText(row.Subject);
  if (!subject) {
    return { error: { rowNumber: row.rowNumber, eventId, reason: "Subject kosong" } };
  }

  const startUtc = parseExcelUtcDate(row.StartUtc);
  if (!startUtc) {
    return {
      error: {
        rowNumber: row.rowNumber,
        eventId,
        reason: `StartUtc tidak valid: ${String(row.StartUtc)}`,
      },
    };
  }

  const endUtc = parseExcelUtcDate(row.EndUtc);
  if (!endUtc) {
    return {
      error: {
        rowNumber: row.rowNumber,
        eventId,
        reason: `EndUtc tidak valid: ${String(row.EndUtc)}`,
      },
    };
  }

  const lastModifiedUtc = parseExcelUtcDate(row.LastModifiedUtc) ?? startUtc;
  const bodyHtml = extractCellText(row.BodyHtml) || null;
  const webLink = extractCellText(row.WebLink) || null;

  const category = classifyAcademicEvent(subject, bodyHtml);
  const metadata = extractBodyMetadata(bodyHtml);
  const referenceTimeUtc = getReferenceTimeUtc(category, startUtc, endUtc);
  const isMuted = category === "LECTURE_WEEKLY" && muteWeeklyLecture;

  return {
    event: {
      eventId,
      subject,
      courseName: extractCourseName(subject),
      classCode: metadata.classCode,
      deliveryMode: metadata.deliveryMode,
      sessionNumber: metadata.sessionNumber,
      activityLabel: metadata.activityLabel,
      category,
      startUtc,
      endUtc,
      referenceTimeUtc,
      lastModifiedUtc,
      bodyHtml,
      activityUrl: metadata.activityUrl,
      webLink,
      isMuted,
    },
  };
}
