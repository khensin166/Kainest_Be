-- ============================================================================
-- BINUS LMS Academic Calendar & Reminder — Supplemental PostgreSQL Setup
-- Schema tabel asli: kainest (PascalCase + camelCase, konsisten dengan seluruh tabel Kainest)
-- Schema view akses: public (untuk kompatibilitas PostgREST / Aplikasi)
-- ============================================================================

-- 1. Partial Unique Index anti-dobel kirim pada AcademicNotificationLog
CREATE UNIQUE INDEX IF NOT EXISTS uq_academic_notification_log_sent_once
  ON kainest."AcademicNotificationLog" ("scheduledReminderId")
  WHERE "deliveryStatus" = 'SENT';

-- 2. Public Views agar seluruh tabel dapat diakses dari schema public
CREATE OR REPLACE VIEW public."CalendarEvent" AS
  SELECT * FROM kainest."CalendarEvent";

CREATE OR REPLACE VIEW public."ReminderRule" AS
  SELECT * FROM kainest."ReminderRule";

CREATE OR REPLACE VIEW public."ScheduledReminder" AS
  SELECT * FROM kainest."ScheduledReminder";

CREATE OR REPLACE VIEW public."AcademicNotificationLog" AS
  SELECT * FROM kainest."AcademicNotificationLog";

CREATE OR REPLACE VIEW public."CalendarSyncLog" AS
  SELECT * FROM kainest."CalendarSyncLog";
