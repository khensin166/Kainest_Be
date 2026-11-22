// src/features/academicCalendar/domain/__tests__/reminderCalculator.test.ts
import { describe, expect, it } from "vitest";
import { buildAcademicReminderMessage } from "../messageBuilder.js";
import {
  calculateReminderCandidates,
  DEFAULT_REMINDER_RULES,
  normalizeWhatsAppRecipient,
} from "../reminderCalculator.js";

const MOCK_RULES = DEFAULT_REMINDER_RULES.map((rule, idx) => ({
  ...rule,
  id: `rule-${idx + 1}`,
}));

describe("reminderCalculator & messageBuilder", () => {
  it("generates H-7, H-3, H-1, and H-3 Jam reminders for ASSIGNMENT when deadline is 10 days away", () => {
    const now = new Date("2026-11-20T00:00:00.000Z");
    const deadlineUtc = new Date("2026-11-30T05:00:00.000Z");

    const candidates = calculateReminderCandidates(
      {
        category: "ASSIGNMENT",
        referenceTimeUtc: deadlineUtc,
        lastModifiedUtc: now,
        isMuted: false,
      },
      MOCK_RULES,
      "0812-3456-7890",
      now
    );

    expect(candidates).toHaveLength(4);
    expect(candidates.map((c) => c.recipient)).toEqual([
      "6281234567890",
      "6281234567890",
      "6281234567890",
      "6281234567890",
    ]);

    const isoTimes = candidates.map((c) => c.scheduledAt.toISOString());
    // H-7: 23 Nov 05:00Z, H-3: 27 Nov 05:00Z, H-1: 29 Nov 05:00Z, H-3h: 30 Nov 02:00Z
    expect(isoTimes).toEqual([
      "2026-11-23T05:00:00.000Z",
      "2026-11-27T05:00:00.000Z",
      "2026-11-29T05:00:00.000Z",
      "2026-11-30T02:00:00.000Z",
    ]);
  });

  it("generates H-7, H-1, and H-3 Jam reminders for QUIZ", () => {
    const now = new Date("2026-11-20T00:00:00.000Z");
    const deadlineUtc = new Date("2026-11-30T05:00:00.000Z");

    const candidates = calculateReminderCandidates(
      {
        category: "QUIZ",
        referenceTimeUtc: deadlineUtc,
        lastModifiedUtc: now,
        isMuted: false,
      },
      MOCK_RULES,
      "6281234567890",
      now
    );

    expect(candidates).toHaveLength(3);
    expect(candidates[0].scheduledAt.toISOString()).toBe("2026-11-23T05:00:00.000Z");
  });

  it("skips past H-7 and H-3 offsets when event is imported 2 days before deadline", () => {
    const now = new Date("2026-11-28T05:00:00.000Z");
    const deadlineUtc = new Date("2026-11-30T05:00:00.000Z");

    const candidates = calculateReminderCandidates(
      {
        category: "ASSIGNMENT",
        referenceTimeUtc: deadlineUtc,
        lastModifiedUtc: now,
        isMuted: false,
      },
      MOCK_RULES,
      "6281234567890",
      now
    );

    // Hanya H-1 (29 Nov) dan H-3 Jam (30 Nov 02:00Z) yang terjadwal
    expect(candidates).toHaveLength(2);
    expect(candidates.map((c) => c.scheduledAt.toISOString())).toEqual([
      "2026-11-29T05:00:00.000Z",
      "2026-11-30T02:00:00.000Z",
    ]);
  });

  it("does not schedule reminders for muted LECTURE_WEEKLY events", () => {
    const now = new Date("2026-11-10T00:00:00.000Z");
    const startUtc = new Date("2026-11-15T17:00:00.000Z");

    const candidates = calculateReminderCandidates(
      {
        category: "LECTURE_WEEKLY",
        referenceTimeUtc: startUtc,
        lastModifiedUtc: now,
        isMuted: true,
      },
      MOCK_RULES,
      "6281234567890",
      now
    );

    expect(candidates).toHaveLength(0);
  });

  it("normalizes personal WhatsApp numbers properly", () => {
    expect(normalizeWhatsAppRecipient("0812-3456-7890")).toBe("6281234567890");
    expect(normalizeWhatsAppRecipient("+62 812 3456 7890")).toBe("6281234567890");
    expect(normalizeWhatsAppRecipient("6281234567890@s.whatsapp.net")).toBe(
      "6281234567890@s.whatsapp.net"
    );
  });

  it("formats WhatsApp reminder message in WIB with BINUSMAYA link", () => {
    const msg = buildAcademicReminderMessage({
      subject: "Assignment: LEC - Decision Support Systems",
      courseName: "Decision Support Systems",
      classCode: "TFGA",
      deliveryMode: "Online - OL",
      sessionNumber: 3,
      activityLabel: "PAS: Personal Assignment 1",
      category: "ASSIGNMENT",
      startUtc: new Date("2026-11-15T17:00:00.000Z"),
      endUtc: new Date("2026-11-30T05:00:00.000Z"),
      referenceTimeUtc: new Date("2026-11-30T05:00:00.000Z"),
      activityUrl: "https://newbinusmaya.binus.ac.id/lms/course/2a8dcaed",
      ruleLabel: "H-7",
    });

    expect(msg).toContain("PENGINGAT TUGAS PERSONAL (H-7)");
    expect(msg).toContain("Decision Support Systems");
    expect(msg).toContain("PAS: Personal Assignment 1");
    expect(msg).toContain("Kelas TFGA • Sesi 3 • Online - OL");
    expect(msg).toContain("12:00 WIB");
    expect(msg).toContain("https://newbinusmaya.binus.ac.id/lms/course/2a8dcaed");
  });
});
