// src/features/academicCalendar/infrastructure/__tests__/housekeeping.test.ts
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import ExcelJS from "exceljs";
import { afterEach, describe, expect, it } from "vitest";
import { buildDownloadCandidateUrls, isValidXlsxBuffer, } from "../calendarDownloader.js";
import { computeFileSha256, readEventsTableFromExcel, } from "../excelCalendarReader.js";
import { HousekeepingService } from "../housekeepingService.js";
const tempDirs = [];
async function makeTempDir() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kainest-academic-test-"));
    tempDirs.push(dir);
    return dir;
}
afterEach(async () => {
    while (tempDirs.length > 0) {
        const dir = tempDirs.pop();
        await fs.rm(dir, { recursive: true, force: true }).catch(() => { });
    }
});
describe("HousekeepingService, ExcelCalendarReader & CalendarDownloader helpers", () => {
    it("archives staging file to archive/YYYY-MM/ and prunes archives older than retentionDays", async () => {
        const tmpRoot = await makeTempDir();
        const hk = new HousekeepingService({ dataDir: tmpRoot, retentionDays: 30 });
        await hk.ensureDirectories();
        const stagingFile = hk.getStagingFilePath("binus-lms-events.xlsx");
        await fs.writeFile(stagingFile, "dummy-xlsx-content");
        const now = new Date("2026-11-21T16:00:00.000Z"); // 23:00 WIB -> 2026-11
        const archivedPath = await hk.archiveStagingFile(stagingFile, now);
        // Staging file harus sudah pindah
        await expect(fs.access(stagingFile)).rejects.toThrow();
        await expect(fs.access(archivedPath)).resolves.toBeUndefined();
        expect(archivedPath).toContain(path.join("archive", "2026-11"));
        // Buat file arsip lama (45 hari lalu) di folder 2026-10
        const oldMonthDir = path.join(hk.getArchiveRootDir(), "2026-10");
        await fs.mkdir(oldMonthDir, { recursive: true });
        const oldFile = path.join(oldMonthDir, "20261001_000000_binus-lms-events.xlsx");
        await fs.writeFile(oldFile, "old-content");
        const oldDate = new Date(now.getTime() - 45 * 86400000);
        await fs.utimes(oldFile, oldDate, oldDate);
        const pruneResult = await hk.pruneOldArchives(now);
        expect(pruneResult.deletedCount).toBe(1);
        expect(pruneResult.deletedFiles).toContain(oldFile);
        await expect(fs.access(oldFile)).rejects.toThrow();
        // Arsip baru tetap aman
        await expect(fs.access(archivedPath)).resolves.toBeUndefined();
    });
    it("reads EventsTable rows accurately from an actual .xlsx workbook and computes SHA-256", async () => {
        const tmpRoot = await makeTempDir();
        const xlsxPath = path.join(tmpRoot, "binus-lms-events.xlsx");
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Events");
        ws.addTable({
            name: "EventsTable",
            ref: "A1",
            headerRow: true,
            columns: [
                { name: "EventId" },
                { name: "Subject" },
                { name: "StartUtc" },
                { name: "EndUtc" },
                { name: "LastModifiedUtc" },
                { name: "BodyHtml" },
                { name: "WebLink" },
            ],
            rows: [
                [
                    "EVT-1",
                    "Assignment: LEC - Decision Support Systems",
                    "2026-11-15T17:00:00+00:00",
                    "2026-11-30T05:00:00+00:00",
                    "2026-11-19T14:36:23.0335524+00:00",
                    '<html><body><div>Class TFGA<br>PAS: Personal Assignment 1<br><a href="https://newbinusmaya.binus.ac.id/lms/1">OPEN</a></div></body></html>',
                    "https://outlook.office365.com/owa/?itemid=EVT-1",
                ],
            ],
        });
        await wb.xlsx.writeFile(xlsxPath);
        const buf = await fs.readFile(xlsxPath);
        expect(isValidXlsxBuffer(buf)).toBe(true);
        expect(isValidXlsxBuffer(Buffer.from("<html><body>Sign in</body></html>"))).toBe(false);
        const hash = await computeFileSha256(xlsxPath);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
        const rows = await readEventsTableFromExcel(xlsxPath);
        expect(rows).toHaveLength(1);
        expect(rows[0].EventId).toBe("EVT-1");
        expect(rows[0].Subject).toBe("Assignment: LEC - Decision Support Systems");
    });
    it("builds SharePoint direct download candidate URL from guestaccess.aspx sharing link", () => {
        const shareUrl = "https://binusianorg-my.sharepoint.com/personal/user/_layouts/15/guestaccess.aspx?share=ABC123&e=xyz";
        const candidates = buildDownloadCandidateUrls(shareUrl);
        expect(candidates[0]).toBe("https://binusianorg-my.sharepoint.com/personal/user/_layouts/15/download.aspx?share=ABC123&e=xyz");
        expect(candidates[1]).toContain("download=1");
        expect(candidates[2]).toBe(shareUrl);
    });
});
