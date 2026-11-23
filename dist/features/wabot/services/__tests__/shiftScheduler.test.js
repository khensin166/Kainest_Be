import { describe, it, expect } from "vitest";
import { parseIndonesianDateText, parseShiftSheetValues, } from "../../../../infrastructure/google/sheetClient.js";
import { buildReminderMessage, resolveActivityShiftType, } from "../ShiftSchedulerService.js";
describe("Google Sheet ALTO Hybrid Parser & Reminder Builder", () => {
    it("parses Indonesian holiday dates accurately", () => {
        expect(parseIndonesianDateText("25 DESEMBER 2026")).toBe("2026-12-25");
        expect(parseIndonesianDateText("1 JANUARI 2027")).toBe("2027-01-01");
        expect(parseIndonesianDateText("5 JANUARI 2027")).toBe("2027-01-05");
        expect(parseIndonesianDateText("invalid")).toBeNull();
    });
    it("parses ALTO sheet Row 5 user data and bottom national holiday table", () => {
        const sampleRows = [
            ["JADWAL KERJA HYBRID - DESEMBER 2026 (ALTO)", "", "", "", "", "DESEMBER 2026"],
            ["INFO", "Kenan Tomfie Bukit", "70002496", "ALTO - IT Ops", "09:00 - 18:00 WIB"],
            ["No", "Nama", "PN", "Jabatan", "Penempatan", "Sel", "Rab", "Kam", "Jum", "Rekap"],
            ["", "", "", "", "", "1", "2", "10", "25", "Total WFO"],
            ["1", "Kenan Tomfie Bukit", "70002496", "SRE Associate", "ALTO", "LS", "1", "WFO", "LS", "10"],
            [],
            ["KETERANGAN & KETENTUAN KERJA"],
            ["Jam Kerja Reguler", "", "09:00 - 18:00 WIB"],
            [],
            ["DAFTAR HARI LIBUR NASIONAL & CUTI BERSAMA - DESEMBER 2026"],
            ["No", "Tanggal", "Hari", "Keterangan Libur"],
            ["1", "25 DESEMBER 2026", "Jumat", "Hari Raya Natal [Libur Nasional]"],
        ];
        const parsed = parseShiftSheetValues(sampleRows, 2026, 12);
        expect(parsed.shifts).toEqual([
            { name: "Kenan Tomfie Bukit", date: "2026-12-01", shift_type: "LS" },
            { name: "Kenan Tomfie Bukit", date: "2026-12-02", shift_type: "1" },
            { name: "Kenan Tomfie Bukit", date: "2026-12-10", shift_type: "WFO" },
            { name: "Kenan Tomfie Bukit", date: "2026-12-25", shift_type: "LS" },
        ]);
        expect(parsed.holidays).toEqual([
            { date: "2026-12-25", name: "Hari Raya Natal [Libur Nasional]" },
        ]);
    });
    it("resolves day-specific activity types for Thursday WFO, Friday WFH, Saturday/Sunday/Holiday LS", () => {
        expect(resolveActivityShiftType("WFO", 1)).toBe("WFO"); // Senin
        expect(resolveActivityShiftType("WFO", 4)).toBe("WFO_THURSDAY"); // Kamis -> Doa Kamis
        expect(resolveActivityShiftType("WFH", 2)).toBe("WFH"); // Selasa
        expect(resolveActivityShiftType("WFH", 5)).toBe("WFH_FRIDAY"); // Jumat -> Olahraga
        expect(resolveActivityShiftType("LS", 6)).toBe("LS_SATURDAY"); // Sabtu -> Youth
        expect(resolveActivityShiftType("LS", 0)).toBe("LS_SUNDAY"); // Minggu -> 3 sesi ibadah
        expect(resolveActivityShiftType("LS", 5)).toBe("LS_HOLIDAY"); // Jumat Libur Nasional
        expect(resolveActivityShiftType("1", 3)).toBe("1"); // Masa transisi shift lama
    });
    it("formats H-1 national holiday me-time advice and WFO/WFH headers cleanly", () => {
        const msgBeforeChristmas = buildReminderMessage("Kenan", { activity_name: "Persiapan tidur malam", time_start: "22:30", note: "Tidur cukup" }, "WFO", "LS", { holidayTomorrowName: "Hari Raya Natal [Libur Nasional]" });
        expect(msgBeforeChristmas).toContain("🏢 WFO ALTO • 09:00–18:00");
        expect(msgBeforeChristmas).toContain("Hari Raya Natal [Libur Nasional]");
        expect(msgBeforeChristmas).toContain("tidur lebih lama");
        const msgHolidayMorning = buildReminderMessage("Kenan", { activity_name: "Selamat Hari Libur Nasional! Sarapan santai 🎉", time_start: "08:30" }, "LS", "LS", { holidayTodayName: "Hari Raya Natal [Libur Nasional]" });
        expect(msgHolidayMorning).toContain("🎉 Libur Nasional: Hari Raya Natal [Libur Nasional]");
        expect(msgHolidayMorning).toContain("me-time");
    });
});
