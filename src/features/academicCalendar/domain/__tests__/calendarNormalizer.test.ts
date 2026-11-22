// src/features/academicCalendar/domain/__tests__/calendarNormalizer.test.ts
import { describe, expect, it } from "vitest";
import {
  classifyAcademicEvent,
  deduplicateRawRows,
  extractBodyMetadata,
  extractCourseName,
  formatWibDateTime,
  normalizeEventRow,
  parseExcelUtcDate,
} from "../calendarNormalizer.js";
import type { RawExcelEventRow } from "../types.js";

const ACTUAL_ROW_1: RawExcelEventRow = {
  rowNumber: 2,
  EventId:
    "AAMkADJkYmQxODQ5LWM5NmItNGNiYS1hNDQ4LWIyYzJhMzNjOWE1MQBGAAAAAAC669y5yGhPSqq2LtfMISOJBwAEj67QdKXtT6QrUe5L6-BWAAA7HSz0AAAEj67QdKXtT6QrUe5L6-BWAAA7HZ1ZAAA=",
  Subject: "Online: LEC - Data Warehouse",
  StartUtc: "2026-11-15T17:00:00+00:00",
  EndUtc: "2026-11-22T16:59:00+00:00",
  LastModifiedUtc: "2026-11-19T14:36:35.2271016+00:00",
  BodyHtml:
    '<html><body><div>Class TCGA<br>Delivery mode: OL<br>Session: 2<br><br><a href="https://newbinusmaya.binus.ac.id/lms/course/0a0ec895-9293-456f-a37d-13126311fccc/session/83e0ae94-7f69-4dba-a4de-9a9d975942db?resource=">OPEN ACTIVITY</a></div></body></html>',
  WebLink:
    "https://outlook.office365.com/owa/?itemid=AAMkADJkYmQxODQ5&exvsurl=1&path=/calendar/item",
};

const ACTUAL_ROW_2: RawExcelEventRow = {
  rowNumber: 3,
  EventId:
    "AAMkADJkYmQxODQ5LWM5NmItNGNiYS1hNDQ4LWIyYzJhMzNjOWE1MQBGAAAAAAC669y5yGhPSqq2LtfMISOJBwAEj67QdKXtT6QrUe5L6-BWAAA7HSz0AAAEj67QdKXtT6QrUe5L6-BWAAA7HZ1DAAA=",
  Subject: "Assignment: LEC - Decision Support Systems",
  StartUtc: "2026-11-15T17:00:00+00:00",
  EndUtc: "2026-11-30T05:00:00+00:00",
  LastModifiedUtc: "2026-11-19T14:36:23.0335524+00:00",
  BodyHtml:
    '<html><body><div>Class TFGA<br>Delivery mode: Online - OL<br>Session: 3<br>PAS: Personal Assignment 1<br><br><a href="https://newbinusmaya.binus.ac.id/lms/course/2a8dcaed-9f2b-4aa5-bfb7-cbfcae5f1da3/session/5ee8bd21-897b-4117-b23c-97cef99ca78f?resource=4b2b2b0f-8b99-4edc-b503-44cf6b4389ab">OPEN ACTIVITY</a></div></body></html>',
  WebLink:
    "https://outlook.office365.com/owa/?itemid=AAMkADJkYmQxODQ5-2&exvsurl=1&path=/calendar/item",
};

describe("calendarNormalizer", () => {
  it("normalizes actual Row 1 (Online: LEC) and mutes weekly lecture by default", () => {
    const { event, error } = normalizeEventRow(ACTUAL_ROW_1);
    expect(error).toBeUndefined();
    expect(event).toBeDefined();

    expect(event!.category).toBe("LECTURE_WEEKLY");
    expect(event!.isMuted).toBe(true);
    expect(event!.courseName).toBe("Data Warehouse");
    expect(event!.classCode).toBe("TCGA");
    expect(event!.deliveryMode).toBe("OL");
    expect(event!.sessionNumber).toBe(2);
    expect(event!.activityLabel).toBeNull();
    expect(event!.activityUrl).toBe(
      "https://newbinusmaya.binus.ac.id/lms/course/0a0ec895-9293-456f-a37d-13126311fccc/session/83e0ae94-7f69-4dba-a4de-9a9d975942db?resource="
    );
    // LECTURE_WEEKLY mengacu pada StartUtc
    expect(event!.referenceTimeUtc.toISOString()).toBe("2026-11-15T17:00:00.000Z");
  });

  it("normalizes actual Row 2 (PAS Assignment) with EndUtc as deadline (05:00 UTC = 12:00 WIB)", () => {
    const { event, error } = normalizeEventRow(ACTUAL_ROW_2);
    expect(error).toBeUndefined();
    expect(event).toBeDefined();

    expect(event!.category).toBe("ASSIGNMENT");
    expect(event!.isMuted).toBe(false);
    expect(event!.courseName).toBe("Decision Support Systems");
    expect(event!.classCode).toBe("TFGA");
    expect(event!.deliveryMode).toBe("Online - OL");
    expect(event!.sessionNumber).toBe(3);
    expect(event!.activityLabel).toBe("PAS: Personal Assignment 1");
    expect(event!.activityUrl).toBe(
      "https://newbinusmaya.binus.ac.id/lms/course/2a8dcaed-9f2b-4aa5-bfb7-cbfcae5f1da3/session/5ee8bd21-897b-4117-b23c-97cef99ca78f?resource=4b2b2b0f-8b99-4edc-b503-44cf6b4389ab"
    );
    expect(event!.referenceTimeUtc.toISOString()).toBe("2026-11-30T05:00:00.000Z");

    const wibFormatted = formatWibDateTime(event!.referenceTimeUtc);
    expect(wibFormatted).toContain("30 November 2026");
    expect(wibFormatted).toContain("12:00 WIB");
  });

  it("classifies TAS, Quiz/QIZ, and Virtual Class correctly", () => {
    expect(
      classifyAcademicEvent(
        "Assignment: LEC - Data Mining",
        "<div>Class TFGA<br>TAS: Team Assignment 1</div>"
      )
    ).toBe("GROUP_ASSIGNMENT");

    expect(
      classifyAcademicEvent(
        "Quiz: LEC - Data Warehouse",
        "<div>Class TCGA<br>QIZ: Quiz 1</div>"
      )
    ).toBe("QUIZ");

    expect(
      classifyAcademicEvent(
        "Virtual Class: LEC - Information Systems Analysis and Design",
        "<div>Class TFGA<br>Session: 4</div>"
      )
    ).toBe("VIRTUAL_CONFERENCE");
  });

  it("parses .NET 7-digit ISO timestamps, JS Date objects, and Excel serial numbers", () => {
    const iso = parseExcelUtcDate("2026-11-19T14:36:35.2271016+00:00");
    expect(iso?.toISOString()).toBe("2026-11-19T14:36:35.227Z");

    const jsDate = parseExcelUtcDate(new Date("2026-11-30T05:00:00.000Z"));
    expect(jsDate?.toISOString()).toBe("2026-11-30T05:00:00.000Z");

    // 2026-11-30T12:00:00Z = 46356.5 dalam serial number Excel (epoch 1899-12-30)
    const serialDate = parseExcelUtcDate(46356.5);
    expect(serialDate?.toISOString()).toBe("2026-11-30T12:00:00.000Z");
  });

  it("deduplicates appended rows in Excel by keeping the newest LastModifiedUtc", () => {
    const olderDuplicate: RawExcelEventRow = {
      ...ACTUAL_ROW_2,
      rowNumber: 2,
      EndUtc: "2026-11-28T05:00:00+00:00",
      LastModifiedUtc: "2026-11-18T10:00:00+00:00",
    };
    const newerDuplicate: RawExcelEventRow = {
      ...ACTUAL_ROW_2,
      rowNumber: 5,
      EndUtc: "2026-11-30T05:00:00+00:00",
      LastModifiedUtc: "2026-11-20T10:00:00+00:00",
    };

    const result = deduplicateRawRows([olderDuplicate, ACTUAL_ROW_1, newerDuplicate]);
    expect(result.duplicatesRemoved).toBe(1);
    expect(result.invalidRows).toHaveLength(0);
    expect(result.dedupedRows).toHaveLength(2);

    const keptRow2 = result.dedupedRows.find((r) => r.EventId === ACTUAL_ROW_2.EventId);
    expect(keptRow2?.EndUtc).toBe("2026-11-30T05:00:00+00:00");
  });

  it("extracts HTML entities cleanly and extracts course name", () => {
    const meta = extractBodyMetadata(
      '<a href="https://newbinusmaya.binus.ac.id/lms?a=1&amp;b=2">OPEN</a>'
    );
    expect(meta.activityUrl).toBe("https://newbinusmaya.binus.ac.id/lms?a=1&b=2");
    expect(extractCourseName("Virtual Class: LEC - Information Systems Analysis and Design")).toBe(
      "Information Systems Analysis and Design"
    );
  });
});
