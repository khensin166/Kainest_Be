// src/features/academicCalendar/domain/types.ts

export type AcademicEventCategory =
  | "ASSIGNMENT"
  | "GROUP_ASSIGNMENT"
  | "QUIZ"
  | "VIRTUAL_CONFERENCE"
  | "LECTURE_WEEKLY"
  | "OTHER";

export type ReminderChannel = "WHATSAPP" | "APP_NOTIFICATION" | "EMAIL";

export type ScheduledReminderStatus =
  | "PENDING"
  | "PROCESSING"
  | "SENT"
  | "FAILED"
  | "CANCELLED"
  | "SKIPPED";

export type CalendarSyncStatus =
  | "RUNNING"
  | "SUCCESS"
  | "PARTIAL_SUCCESS"
  | "SKIPPED_UNCHANGED"
  | "FAILED";

export interface RawExcelEventRow {
  rowNumber: number;
  EventId?: unknown;
  Subject?: unknown;
  StartUtc?: unknown;
  EndUtc?: unknown;
  LastModifiedUtc?: unknown;
  BodyHtml?: unknown;
  WebLink?: unknown;
}

export interface ParsedBodyMetadata {
  classCode: string | null;
  deliveryMode: string | null;
  sessionNumber: number | null;
  activityLabel: string | null;
  activityUrl: string | null;
}

export interface NormalizedCalendarEvent {
  eventId: string;
  subject: string;
  courseName: string | null;
  classCode: string | null;
  deliveryMode: string | null;
  sessionNumber: number | null;
  activityLabel: string | null;
  category: AcademicEventCategory;
  startUtc: Date;
  endUtc: Date;
  referenceTimeUtc: Date;
  lastModifiedUtc: Date;
  bodyHtml: string | null;
  activityUrl: string | null;
  webLink: string | null;
  isMuted: boolean;
}

export interface RowValidationError {
  rowNumber: number;
  eventId?: string;
  reason: string;
}

export interface ReminderRuleSpec {
  id?: string;
  category: AcademicEventCategory;
  offsetMinutes: number;
  label: string;
  channel: ReminderChannel;
  isActive: boolean;
  targetRecipient?: string | null;
}

export interface ScheduledReminderCandidate {
  ruleId: string;
  channel: ReminderChannel;
  recipient: string;
  scheduledAt: Date;
  eventVersionUtc: Date;
}

export interface SyncRunReport {
  syncLogId: string;
  status: CalendarSyncStatus;
  sourceFile: string;
  fileChecksum: string | null;
  totalRowsRead: number;
  rowsDedupedInFile: number;
  eventsInserted: number;
  eventsUpdated: number;
  eventsSkipped: number;
  eventsFailed: number;
  remindersCreated: number;
  remindersRescheduled: number;
  archivedPath: string | null;
  errors: RowValidationError[];
}
