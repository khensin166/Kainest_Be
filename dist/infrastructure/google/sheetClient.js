// src/infrastructure/google/sheetClient.ts
// Membaca data jadwal shift dari Google Spreadsheet
import { google } from "googleapis";
import { logger } from "../logger/logger.js";
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY_SPREADSHEET;
const sheets = google.sheets({
    version: "v4",
    auth: GOOGLE_API_KEY,
});
/**
 * Membaca data jadwal dari Google Spreadsheet untuk bulan yang berjalan.
 * Struktur sheet: Baris 3 = header statis (Nama, PN...),
 *                 Baris 4 = header tanggal (1, 2, 3...),
 *                 Baris 5 = nama hari (Fungsi, Sab, Min...),
 *                 Baris 6+ = data user
 */
export const fetchShiftDataFromSheet = async () => {
    if (!SPREADSHEET_ID || !GOOGLE_API_KEY) {
        throw new Error("SPREADSHEET_ID atau GOOGLE_API_KEY_SPREADSHEET tidak diset di .env");
    }
    const now = new Date();
    const timeZone = "Asia/Jakarta";
    const monthName = now
        .toLocaleString("id-ID", { month: "long", timeZone })
        .toUpperCase();
    const shortYear = now.toLocaleString("id-ID", { year: "2-digit", timeZone });
    const currentYear = now.getFullYear();
    const currentTabName = `${monthName}'${shortYear}`;
    const range = `${currentTabName}!A3:AZ100`;
    logger.info(`[SheetClient] Membaca dari tab: ${currentTabName}`);
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range,
        });
        const rows = response.data.values;
        if (!rows || rows.length < 4) {
            logger.warn("[SheetClient] Data sheet tidak cukup (kurang dari 4 baris).");
            return [];
        }
        const staticHeaderRow = rows[0]; // Sheet Row 3: "Nama", "PN"...
        const dateHeaderRow = rows[1]; // Sheet Row 4: "1", "2", "3"...
        // rows[2] = Sheet Row 5 = nama hari (diabaikan)
        const userDataRows = rows.slice(3); // Sheet Row 6+
        const nameColIndex = staticHeaderRow.findIndex((h) => String(h).trim().toLowerCase() === "nama");
        if (nameColIndex === -1) {
            throw new Error(`Header 'Nama' tidak ditemukan di tab '${currentTabName}'`);
        }
        const dateStartIndex = dateHeaderRow.findIndex((h) => String(h).trim() === "1");
        if (dateStartIndex === -1) {
            throw new Error(`Header tanggal '1' tidak ditemukan di tab '${currentTabName}'`);
        }
        const allShifts = [];
        for (const row of userDataRows) {
            const userName = row[nameColIndex];
            if (!userName || userName.trim() === "")
                continue;
            for (let colIndex = dateStartIndex; colIndex < dateHeaderRow.length; colIndex++) {
                const day = dateHeaderRow[colIndex];
                const shiftType = row[colIndex];
                if (day && !isNaN(parseInt(day)) && shiftType && shiftType.trim() !== "") {
                    // Buat tanggal lengkap dalam format YYYY-MM-DD
                    const dateStr = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(parseInt(day)).padStart(2, "0")}`;
                    allShifts.push({
                        name: userName.trim(),
                        date: dateStr,
                        shift_type: shiftType.trim(),
                    });
                }
            }
        }
        logger.info(`[SheetClient] Berhasil membaca ${allShifts.length} data shift.`);
        return allShifts;
    }
    catch (error) {
        logger.error("[SheetClient] Gagal membaca Spreadsheet", { error: error.message });
        throw error;
    }
};
