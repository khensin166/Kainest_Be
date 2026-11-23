// src/infrastructure/google/sheetClient.ts
// Membaca data jadwal shift & hybrid (ALTO) serta daftar Hari Libur Nasional dari Google Spreadsheet
import { google } from "googleapis";
import { logger } from "../logger/logger.js";

export interface ShiftRow {
    name: string;
    date: string; // Format YYYY-MM-DD
    shift_type: string;
}

export interface HolidayRow {
    date: string; // Format YYYY-MM-DD
    name: string;
}

export interface ShiftSheetResult {
    tabName: string;
    shifts: ShiftRow[];
    holidays: HolidayRow[];
}

const INDONESIAN_MONTHS: Record<string, number> = {
    JANUARI: 1,
    FEBRUARI: 2,
    MARET: 3,
    APRIL: 4,
    MEI: 5,
    JUNI: 6,
    JULI: 7,
    AGUSTUS: 8,
    SEPTEMBER: 9,
    OKTOBER: 10,
    NOVEMBER: 11,
    DESEMBER: 12,
};

const DAY_LABELS = new Set(["sen", "sel", "rab", "kam", "jum", "sab", "min", "fungsi"]);

/**
 * Mengonversi tanggal teks Indonesia dari tabel libur spreadsheet
 * (misal: "25 DESEMBER 2026", "1 JANUARI 2027") ke format YYYY-MM-DD.
 */
export function parseIndonesianDateText(raw: string): string | null {
    const cleaned = String(raw || "").trim().toUpperCase().replace(/\s+/g, " ");
    const match = cleaned.match(/^(\d{1,2})\s+([A-Z]+)\s+(\d{4})$/);
    if (!match) return null;

    const day = Number.parseInt(match[1], 10);
    const month = INDONESIAN_MONTHS[match[2]];
    const year = Number.parseInt(match[3], 10);

    if (!month || !Number.isFinite(day) || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Parser dinamis untuk isi tab Google Spreadsheet (mendukung layout lama Row 6+
 * maupun layout baru ALTO Row 5 + tabel DAFTAR HARI LIBUR NASIONAL di bawah).
 */
export function parseShiftSheetValues(
    rows: any[][],
    year: number,
    month1Based: number
): { shifts: ShiftRow[]; holidays: HolidayRow[] } {
    if (!rows || rows.length < 3) {
        return { shifts: [], holidays: [] };
    }

    // 1. Deteksi baris header "Nama"
    let staticHeaderRowIdx = -1;
    let nameColIndex = -1;
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
        const idx = (rows[r] || []).findIndex(
            (cell) => String(cell ?? "").trim().toLowerCase() === "nama"
        );
        if (idx !== -1) {
            staticHeaderRowIdx = r;
            nameColIndex = idx;
            break;
        }
    }

    if (staticHeaderRowIdx === -1 || nameColIndex === -1) {
        throw new Error("Header 'Nama' tidak ditemukan di sheet.");
    }

    // 2. Deteksi baris tanggal (mengandung angka "1", "2", "3")
    let dateHeaderRowIdx = -1;
    for (let r = staticHeaderRowIdx; r < Math.min(rows.length, staticHeaderRowIdx + 4); r++) {
        const row = rows[r] || [];
        const has1 = row.some((c) => String(c ?? "").trim() === "1");
        const has2 = row.some((c) => String(c ?? "").trim() === "2");
        if (has1 && has2) {
            dateHeaderRowIdx = r;
            break;
        }
    }

    if (dateHeaderRowIdx === -1) {
        throw new Error("Baris header tanggal (1, 2, 3...) tidak ditemukan di sheet.");
    }

    // Ambil hanya kolom tanggal valid (1..31) secara berurutan, berhenti sebelum kolom Rekap/Total
    const dateHeaderRow = rows[dateHeaderRowIdx] || [];
    const dateColumns: Array<{ colIndex: number; day: number }> = [];
    let startedDates = false;
    for (let col = 0; col < dateHeaderRow.length; col++) {
        const raw = String(dateHeaderRow[col] ?? "").trim();
        const parsed = /^\d{1,2}$/.test(raw) ? Number.parseInt(raw, 10) : NaN;
        if (!startedDates) {
            if (parsed === 1) {
                startedDates = true;
                dateColumns.push({ colIndex: col, day: 1 });
            }
        } else {
            if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 31) {
                dateColumns.push({ colIndex: col, day: parsed });
            } else {
                // Berhenti begitu melewati kolom tanggal (masuk area "Total WFO", dll.)
                break;
            }
        }
    }

    if (dateColumns.length === 0) {
        throw new Error("Kolom tanggal 1..31 tidak valid.");
    }

    // 3. Ekstrak baris data user (mulai tepat setelah baris tanggal)
    const shifts: ShiftRow[] = [];
    const firstDateCol = dateColumns[0].colIndex;
    const monthStr = String(month1Based).padStart(2, "0");

    for (let r = dateHeaderRowIdx + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const firstNonEmpty = row.find((c) => String(c ?? "").trim() !== "");
        if (!firstNonEmpty) {
            // Baris kosong setelah sudah dapat minimal 1 user menandakan akhir tabel jadwal
            if (shifts.length > 0) break;
            continue;
        }

        const firstUpper = String(firstNonEmpty).trim().toUpperCase();
        if (firstUpper.startsWith("KETERANGAN") || firstUpper.startsWith("DAFTAR HARI LIBUR")) {
            break;
        }

        // Skip baris nama hari di layout lama (misal: Row 5 berisi "Fungsi", "Sab", "Min")
        const sampleDateCell = String(row[firstDateCol] ?? "").trim().toLowerCase();
        if (DAY_LABELS.has(sampleDateCell)) {
            continue;
        }

        const userName = String(row[nameColIndex] ?? "").trim();
        if (!userName || userName.toLowerCase() === "nama") continue;

        for (const { colIndex, day } of dateColumns) {
            const shiftType = String(row[colIndex] ?? "").trim();
            if (!shiftType) continue;

            const dateStr = `${year}-${monthStr}-${String(day).padStart(2, "0")}`;
            shifts.push({
                name: userName,
                date: dateStr,
                shift_type: shiftType.toUpperCase(),
            });
        }
    }

    // 4. Ekstrak tabel "DAFTAR HARI LIBUR NASIONAL & CUTI BERSAMA" di bagian bawah sheet
    const holidays: HolidayRow[] = [];
    for (let r = dateHeaderRowIdx + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const tanggalCol = row.findIndex(
            (c) => String(c ?? "").trim().toLowerCase() === "tanggal"
        );
        const ketCol = row.findIndex((c) =>
            String(c ?? "").trim().toLowerCase().includes("keterangan")
        );

        if (tanggalCol !== -1 && ketCol !== -1) {
            for (let hr = r + 1; hr < rows.length; hr++) {
                const hRow = rows[hr] || [];
                const rawDate = String(hRow[tanggalCol] ?? "").trim();
                const rawName = String(hRow[ketCol] ?? "").trim();
                if (!rawDate && !rawName) break;

                const isoDate = parseIndonesianDateText(rawDate);
                if (isoDate && rawName) {
                    holidays.push({ date: isoDate, name: rawName });
                }
            }
            break;
        }
    }

    return { shifts, holidays };
}

/**
 * Mengambil jadwal & daftar hari libur nasional dari Google Spreadsheet untuk bulan target (default bulan berjalan WIB).
 * Memprioritaskan tab `${BULAN} _ALTO'${YY}` dan fallback ke `${BULAN}'${YY}`.
 */
export const fetchShiftSheetWithHolidays = async (
    targetDate: Date = new Date()
): Promise<ShiftSheetResult> => {
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const googleApiKey = process.env.GOOGLE_API_KEY_SPREADSHEET;

    if (!spreadsheetId || !googleApiKey) {
        throw new Error("SPREADSHEET_ID atau GOOGLE_API_KEY_SPREADSHEET tidak diset di .env");
    }

    const sheets = google.sheets({ version: "v4", auth: googleApiKey });
    const timeZone = "Asia/Jakarta";

    const monthName = targetDate
        .toLocaleString("id-ID", { month: "long", timeZone })
        .toUpperCase();
    const shortYear = targetDate.toLocaleString("id-ID", { year: "2-digit", timeZone });
    const yearNum = Number.parseInt(
        targetDate.toLocaleString("en-CA", { year: "numeric", timeZone }),
        10
    );
    const monthNum = Number.parseInt(
        targetDate.toLocaleString("en-CA", { month: "2-digit", timeZone }),
        10
    );

    const candidateTabs = [
        `${monthName} _ALTO'${shortYear}`,
        `${monthName}'${shortYear}`,
    ];

    let lastError: any = null;
    for (const tabName of candidateTabs) {
        try {
            logger.debug(`[SheetClient] Mencoba membaca tab: ${tabName}`);
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${tabName}!A1:AZ100`,
            });

            const rows = response.data.values;
            if (!rows || rows.length < 3) {
                logger.warn(`[SheetClient] Data di tab '${tabName}' kosong atau kurang dari 3 baris.`);
                continue;
            }

            const parsed = parseShiftSheetValues(rows, yearNum, monthNum);
            logger.info(
                `[SheetClient] Berhasil membaca tab '${tabName}': ${parsed.shifts.length} jadwal, ${parsed.holidays.length} hari libur nasional.`
            );

            return {
                tabName,
                shifts: parsed.shifts,
                holidays: parsed.holidays,
            };
        } catch (err: any) {
            lastError = err;
            logger.debug(`[SheetClient] Tab '${tabName}' tidak ditemukan/gagal dibaca: ${err.message}`);
        }
    }

    logger.error("[SheetClient] Semua kandidat tab Spreadsheet gagal dibaca", {
        candidateTabs,
        error: lastError?.message,
    });
    throw lastError || new Error(`Tidak ada tab jadwal valid (${candidateTabs.join(", ")})`);
};

/**
 * Wrapper kompatibilitas balik yang mengembalikan array ShiftRow saja.
 */
export const fetchShiftDataFromSheet = async (
    targetDate: Date = new Date()
): Promise<ShiftRow[]> => {
    const result = await fetchShiftSheetWithHolidays(targetDate);
    return result.shifts;
};
