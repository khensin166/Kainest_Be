// src/features/wabot/services/ShiftSchedulerService.ts
// Layanan penjadwalan pengingat kerja (Hybrid ALTO WFO/WFH/LS + Transisi Shift 1/2/3).
// - Sinkronisasi harian dari Google Spreadsheet ALTO ke database (00:05 WIB)
// - Otomatis mendeteksi Libur Nasional dari tabel bawah spreadsheet
// - Otomatis membersihkan jadwal masa depan user non-spreadsheet (hentikan blast user lama)
// - Anti-dobel: Hanya aktif jika ENABLE_SCHEDULER=true (HANYA di .env VPS Production)

import * as schedule from "node-schedule";
import { prisma } from "../../../infrastructure/database/prisma.js";
import {
    fetchShiftSheetWithHolidays,
    type HolidayRow,
} from "../../../infrastructure/google/sheetClient.js";
import { logger } from "../../../infrastructure/logger/logger.js";
import { sendTextViaGowa } from "../../../utils/gowaService.js";

const ENABLE_SCHEDULER = process.env.ENABLE_SCHEDULER === "true";

// Cache peta hari libur nasional dari tab spreadsheet aktif (YYYY-MM-DD -> Nama Libur)
let cachedHolidayMap = new Map<string, string>();

export interface DefaultShiftActivitySpec {
    shift_type: string;
    activity_name: string;
    time_start: string;
    reminder_time: string;
    note: string;
}

/**
 * Daftar aktivitas harian untuk mode Hybrid ALTO (WFO, WFO_THURSDAY, WFH, WFH_FRIDAY)
 * dan hari libur (LS_SATURDAY, LS_SUNDAY, LS_HOLIDAY).
 */
export const DEFAULT_HYBRID_SHIFT_ACTIVITIES: DefaultShiftActivitySpec[] = [
    // ── WFO (Senin, Rabu — 09:00–18:00 WIB) ──────────────────────────────────
    { shift_type: "WFO", activity_name: "Bangun, mandi & sarapan", time_start: "06:30", reminder_time: "06:00", note: "Mulai pagi dengan tenang sebelum commute" },
    { shift_type: "WFO", activity_name: "Berangkat ke kantor (WFO ALTO)", time_start: "07:30", reminder_time: "07:00", note: "Cek laptop, charger, ID card & antisipasi macet" },
    { shift_type: "WFO", activity_name: "Mulai kerja (WFO ALTO)", time_start: "09:00", reminder_time: "08:30", note: "Cek monitoring, tiket & standup pagi" },
    { shift_type: "WFO", activity_name: "Ngemil pagi & makan buah 🍎", time_start: "10:30", reminder_time: "10:00", note: "Jaga energi & fokus sebelum makan siang" },
    { shift_type: "WFO", activity_name: "Istirahat & makan siang", time_start: "12:00", reminder_time: "11:30", note: "Pilih protein + sayur, rehat dari layar" },
    { shift_type: "WFO", activity_name: "Ngemil sore, makan buah & stretching 🍌", time_start: "15:30", reminder_time: "15:00", note: "Jaga hidrasi & cegah ngantuk sore" },
    { shift_type: "WFO", activity_name: "Selesai kerja & persiapan pulang", time_start: "18:00", reminder_time: "17:30", note: "Rapikan handover / catatan harian sebelum pulang" },
    { shift_type: "WFO", activity_name: "Makan malam & waktu pribadi", time_start: "20:00", reminder_time: "19:30", note: "Istirahat, hobi, atau cek tugas ringan" },
    { shift_type: "WFO", activity_name: "Persiapan tidur malam", time_start: "22:30", reminder_time: "22:00", note: "Prioritaskan tidur 7–8 jam untuk energi besok" },

    // ── WFO KHUSUS KAMIS (Termasuk Ibadah Doa Kamis 19:00 WIB) ───────────────
    { shift_type: "WFO_THURSDAY", activity_name: "Bangun, mandi & sarapan", time_start: "06:30", reminder_time: "06:00", note: "Mulai pagi dengan tenang sebelum commute" },
    { shift_type: "WFO_THURSDAY", activity_name: "Berangkat ke kantor (WFO ALTO)", time_start: "07:30", reminder_time: "07:00", note: "Cek laptop, charger, ID card & antisipasi macet" },
    { shift_type: "WFO_THURSDAY", activity_name: "Mulai kerja (WFO ALTO)", time_start: "09:00", reminder_time: "08:30", note: "Cek monitoring, tiket & standup pagi" },
    { shift_type: "WFO_THURSDAY", activity_name: "Ngemil pagi & makan buah 🍎", time_start: "10:30", reminder_time: "10:00", note: "Jaga energi & fokus sebelum makan siang" },
    { shift_type: "WFO_THURSDAY", activity_name: "Istirahat & makan siang", time_start: "12:00", reminder_time: "11:30", note: "Pilih protein + sayur, rehat dari layar" },
    { shift_type: "WFO_THURSDAY", activity_name: "Ngemil sore, makan buah & stretching 🍌", time_start: "15:30", reminder_time: "15:00", note: "Jaga hidrasi & cegah ngantuk sore" },
    { shift_type: "WFO_THURSDAY", activity_name: "Selesai kerja & persiapan pulang", time_start: "18:00", reminder_time: "17:30", note: "Langsung pulang & bersiap untuk Ibadah Doa Kamis jam 19:00 WIB" },
    { shift_type: "WFO_THURSDAY", activity_name: "Ibadah Doa Kamis (19:00 WIB) 🙏", time_start: "19:00", reminder_time: "18:30", note: "Persiapan & ikuti Ibadah Doa Kamis tepat pukul 19:00 WIB" },
    { shift_type: "WFO_THURSDAY", activity_name: "Makan malam & santai setelah Doa Kamis", time_start: "20:30", reminder_time: "20:00", note: "Istirahat setelah ibadah & seharian WFO" },
    { shift_type: "WFO_THURSDAY", activity_name: "Persiapan tidur malam", time_start: "22:30", reminder_time: "22:00", note: "Prioritaskan tidur 7–8 jam untuk energi besok" },

    // ── WFH (Selasa — 09:00–18:00 WIB) ───────────────────────────────────────
    { shift_type: "WFH", activity_name: "Bangun & stretching / jalan pagi", time_start: "07:00", reminder_time: "06:30", note: "Manfaatkan waktu tanpa commute untuk gerak" },
    { shift_type: "WFH", activity_name: "Mandi, sarapan & siapkan workspace", time_start: "08:00", reminder_time: "07:30", note: "Bikin batas jelas antara mode santai & kerja" },
    { shift_type: "WFH", activity_name: "Mulai kerja (WFH ALTO)", time_start: "09:00", reminder_time: "08:30", note: "Cek monitoring, pesan tim & prioritas harian" },
    { shift_type: "WFH", activity_name: "Ngemil pagi & makan buah 🍎", time_start: "10:30", reminder_time: "10:00", note: "Ambil buah / camilan sehat & minum air" },
    { shift_type: "WFH", activity_name: "Istirahat & makan siang", time_start: "12:00", reminder_time: "11:30", note: "Menjauh sejenak dari meja kerja" },
    { shift_type: "WFH", activity_name: "Ngemil sore, makan buah & rehat mata 🍌", time_start: "15:30", reminder_time: "15:00", note: "Stretching bahu/punggung & minum air putih" },
    { shift_type: "WFH", activity_name: "Selesai kerja (Tutup laptop)", time_start: "18:00", reminder_time: "17:30", note: "Jaga work-life balance, akhiri kerja tepat waktu" },
    { shift_type: "WFH", activity_name: "Makan malam & waktu pribadi", time_start: "20:00", reminder_time: "19:30", note: "Nikmati waktu santai bersama keluarga / me-time" },
    { shift_type: "WFH", activity_name: "Persiapan tidur malam", time_start: "22:30", reminder_time: "22:00", note: "Hindari layar menjelang tidur" },

    // ── WFH KHUSUS JUMAT (Termasuk Olahraga Setelah Selesai Kantor) ──────────
    { shift_type: "WFH_FRIDAY", activity_name: "Bangun & stretching / jalan pagi", time_start: "07:00", reminder_time: "06:30", note: "Manfaatkan waktu tanpa commute untuk gerak" },
    { shift_type: "WFH_FRIDAY", activity_name: "Mandi, sarapan & siapkan workspace", time_start: "08:00", reminder_time: "07:30", note: "Bikin batas jelas antara mode santai & kerja" },
    { shift_type: "WFH_FRIDAY", activity_name: "Mulai kerja (WFH ALTO)", time_start: "09:00", reminder_time: "08:30", note: "Cek monitoring, pesan tim & prioritas harian" },
    { shift_type: "WFH_FRIDAY", activity_name: "Ngemil pagi & makan buah 🍎", time_start: "10:30", reminder_time: "10:00", note: "Ambil buah / camilan sehat & minum air" },
    { shift_type: "WFH_FRIDAY", activity_name: "Istirahat & makan siang", time_start: "12:00", reminder_time: "11:30", note: "Menjauh sejenak dari meja kerja" },
    { shift_type: "WFH_FRIDAY", activity_name: "Ngemil sore, makan buah & rehat mata 🍌", time_start: "15:30", reminder_time: "15:00", note: "Stretching & isi energi sebelum olahraga sore nanti" },
    { shift_type: "WFH_FRIDAY", activity_name: "Selesai kerja (Tutup laptop)", time_start: "18:00", reminder_time: "17:30", note: "Akhiri kerja tepat waktu, habis ini waktunya olahraga Jumat!" },
    { shift_type: "WFH_FRIDAY", activity_name: "Olahraga Setelah Pulang/Selesai Kantor 💪", time_start: "18:30", reminder_time: "18:00", note: "Waktunya olahraga rutin Jumat (gym, lari sore, atau workout)" },
    { shift_type: "WFH_FRIDAY", activity_name: "Makan malam & waktu pribadi", time_start: "20:00", reminder_time: "19:30", note: "Isi protein setelah olahraga & nikmati malam akhir pekan" },
    { shift_type: "WFH_FRIDAY", activity_name: "Persiapan tidur malam", time_start: "22:30", reminder_time: "22:00", note: "Istirahat berkualitas setelah olahraga" },

    // ── LS SABTU (Aktivitas Harian + Ibadah Youth 19:00 WIB) ─────────────────
    { shift_type: "LS_SATURDAY", activity_name: "Selamat Hari Sabtu! Bangun & sarapan santai", time_start: "08:30", reminder_time: "08:00", note: "Nikmati pagi libur tanpa alarm kerja" },
    { shift_type: "LS_SATURDAY", activity_name: "Ngemil pagi & makan buah 🍎", time_start: "10:30", reminder_time: "10:00", note: "Tetap jaga asupan buah & air putih di hari libur" },
    { shift_type: "LS_SATURDAY", activity_name: "Makan siang & Info Ibadah Youth (19:00 WIB) ⛪", time_start: "12:30", reminder_time: "12:00", note: "Makan siang bergizi + pengingat awal malam ini ada Ibadah Youth jam 19:00 WIB" },
    { shift_type: "LS_SATURDAY", activity_name: "Ngemil sore, buah & me-time 🍌", time_start: "15:30", reminder_time: "15:00", note: "Istirahat / hobi sebelum bersiap untuk Youth nanti malam" },
    { shift_type: "LS_SATURDAY", activity_name: "Makan malam ringan & persiapan Ibadah Youth (19:00) ⛪", time_start: "18:00", reminder_time: "17:30", note: "Mandi, siap-siap & berangkat Ibadah Youth tepat waktu" },
    { shift_type: "LS_SATURDAY", activity_name: "Istirahat malam (Besok Hari Minggu)", time_start: "22:30", reminder_time: "22:00", note: "Opsional tidur santai, tetap jaga stamina untuk ibadah besok" },

    // ── LS MINGGU (Aktivitas Harian + 3 Opsi Ibadah 08:00 / 10:30 / 16:00) ──
    { shift_type: "LS_SUNDAY", activity_name: "Selamat Hari Minggu! Sarapan & Info Ibadah ⛪", time_start: "07:15", reminder_time: "06:45", note: "Pilihan sesi ibadah hari ini: 08:00, 10:30, atau 16:00 WIB" },
    { shift_type: "LS_SUNDAY", activity_name: "Ngemil buah pagi & Pengingat Ibadah Sesi 2 (10:30) 🍎⛪", time_start: "10:00", reminder_time: "09:30", note: "Makan buah + pengingat jika ingin ikut ibadah sesi 10:30 WIB" },
    { shift_type: "LS_SUNDAY", activity_name: "Makan siang & istirahat santai", time_start: "12:30", reminder_time: "12:00", note: "Pilih makanan bergizi & nikmati waktu santai/me-time" },
    { shift_type: "LS_SUNDAY", activity_name: "Ngemil sore, buah & Pengingat Ibadah Sesi 3 (16:00) 🍌⛪", time_start: "15:30", reminder_time: "15:00", note: "Camilan sehat + pengingat jika belum ibadah pagi/siang (sesi sore 16:00 WIB)" },
    { shift_type: "LS_SUNDAY", activity_name: "Makan malam & relaksasi Minggu malam", time_start: "19:00", reminder_time: "18:30", note: "Nikmati penutup akhir pekan dengan tenang" },
    { shift_type: "LS_SUNDAY", activity_name: "Persiapan minggu baru & tidur cukup", time_start: "21:30", reminder_time: "21:00", note: "Cek jadwal besok dan siapkan barang bawaan" },

    // ── LS LIBUR NASIONAL WEEKDAY ────────────────────────────────────────────
    { shift_type: "LS_HOLIDAY", activity_name: "Selamat Hari Libur Nasional! Sarapan santai 🎉", time_start: "08:30", reminder_time: "08:00", note: "Nikmati waktu libur, istirahat & me-time" },
    { shift_type: "LS_HOLIDAY", activity_name: "Ngemil pagi & makan buah 🍎", time_start: "10:30", reminder_time: "10:00", note: "Santai di hari libur tetap jaga nutrisi" },
    { shift_type: "LS_HOLIDAY", activity_name: "Makan siang santai", time_start: "12:30", reminder_time: "12:00", note: "Waktu berkualitas untuk istirahat / keluarga" },
    { shift_type: "LS_HOLIDAY", activity_name: "Ngemil sore & makan buah 🍌", time_start: "15:30", reminder_time: "15:00", note: "Me-time, hobi, atau olahraga ringan" },
    { shift_type: "LS_HOLIDAY", activity_name: "Makan malam & santai", time_start: "19:00", reminder_time: "18:30", note: "Istirahat malam yang nyaman" },
    { shift_type: "LS_HOLIDAY", activity_name: "Rehat malam & cek jadwal besok", time_start: "21:30", reminder_time: "21:00", note: "Cek apakah besok masuk kerja atau masih libur" },
];

/**
 * Memetakan shift_type mentah dari spreadsheet ("WFO", "WFH", "LS", "1", "2", "3")
 * ke tipe ShiftActivity yang sesuai berdasarkan hari dalam seminggu (0=Min .. 6=Sab).
 */
export function resolveActivityShiftType(rawShiftType: string, dayOfWeek: number): string {
    const normalized = rawShiftType.trim().toUpperCase();
    if (normalized === "WFO" && dayOfWeek === 4) return "WFO_THURSDAY";
    if (normalized === "WFH" && dayOfWeek === 5) return "WFH_FRIDAY";
    if (normalized === "LS") {
        if (dayOfWeek === 6) return "LS_SATURDAY";
        if (dayOfWeek === 0) return "LS_SUNDAY";
        return "LS_HOLIDAY";
    }
    return normalized;
}

/**
 * Seed idempoten ShiftActivity untuk jadwal Hybrid ALTO & Hari Libur.
 * Tidak menimpa baris yang sudah ada.
 */
export async function ensureHybridShiftActivities(): Promise<number> {
    const existing = await prisma.shiftActivity.findMany({
        select: { shift_type: true, reminder_time: true },
    });
    const existingKeys = new Set(
        existing.map((a) => `${a.shift_type}::${a.reminder_time}`)
    );

    const toCreate = DEFAULT_HYBRID_SHIFT_ACTIVITIES.filter(
        (spec) => !existingKeys.has(`${spec.shift_type}::${spec.reminder_time}`)
    );

    if (toCreate.length === 0) return 0;

    const result = await prisma.shiftActivity.createMany({
        data: toCreate,
    });
    logger.info(`[Scheduler] ✅ Seeded ${result.count} aktivitas baru untuk Hybrid ALTO & Hari Libur.`);
    return result.count;
}

function formatShiftHeaderLabel(shiftToday: string, holidayTodayName?: string | null): string {
    const normalized = shiftToday.trim().toUpperCase();
    if (normalized === "WFO") return "🏢 WFO ALTO • 09:00–18:00";
    if (normalized === "WFH") return "🏠 WFH ALTO • 09:00–18:00";
    if (normalized === "LS") {
        return holidayTodayName
            ? `🎉 Libur Nasional: ${holidayTodayName}`
            : "🎉 Hari Libur (LS)";
    }
    return `Shift ${shiftToday}`;
}

/**
 * Membangun pesan pengingat teks WA standar (tampil sempurna di laptop & HP)
 * dengan saran cerdas kontekstual (H-1 libur, transisi shift, WFO/WFH).
 */
export function buildReminderMessage(
    userName: string,
    activity: { activity_name: string; time_start: string; note?: string | null },
    shiftToday: string,
    shiftTomorrow: string | null,
    options?: {
        holidayTodayName?: string | null;
        holidayTomorrowName?: string | null;
    }
): string {
    const todayNorm = shiftToday.trim().toUpperCase();
    const tomorrowNorm = (shiftTomorrow || "LS").trim().toUpperCase();
    const actLower = activity.activity_name.toLowerCase();
    const isEveningWrapUp =
        actLower.includes("tidur") ||
        actLower.includes("istirahat malam") ||
        actLower.includes("rehat malam") ||
        actLower.includes("minggu baru");

    let advice = "";

    // 1. Aturan jadwal berat transisi shift lama (clopen)
    if (todayNorm === "2" && tomorrowNorm === "1") {
        advice = "⚠️ *Perhatian:* Jadwalmu besok pagi (Shift 1) setelah siang ini (Shift 2). Pulang kerja langsung istirahat ya!";
    } else if (todayNorm === "3" && tomorrowNorm === "1") {
        advice = "⚠️ *Warning:* Pindah dari Shift 3 ke Shift 1 itu berat. Pastikan tidur minimal 6-7 jam begitu sampai rumah.";
    } else if (todayNorm === "3" && tomorrowNorm === "2") {
        advice = "💡 Besok masuk siang (Shift 2). Manfaatkan waktu pagi untuk tidur berkualitas setelah Shift 3 ini.";
    }

    // 2. Saran cerdas malam hari H-1 (besok libur / WFO / WFH)
    if (!advice && isEveningWrapUp) {
        if (tomorrowNorm === "LS" || tomorrowNorm === "LIBUR") {
            if (options?.holidayTomorrowName) {
                advice = `🎉 Besok Libur Nasional: *${options.holidayTomorrowName}*! Malam ini opsional kamu bisa tidur lebih lama dan nikmati waktu me-time.`;
            } else {
                advice = "🎉 Besok libur! Malam ini opsional kamu bisa tidur lebih lama, ada waktu me-time atau santai tanpa buru-buru.";
            }
        } else if (tomorrowNorm === "WFO") {
            advice = "🏢 Besok jadwal WFO di kantor ALTO (09:00–18:00). Siapkan laptop, charger, ID card, dan tidur cukup ya!";
        } else if (tomorrowNorm === "WFH") {
            advice = "🏠 Besok jadwal WFH (09:00–18:00). Pagi besok bisa dimanfaatkan untuk stretching/olahraga ringan sebelum jam 09:00.";
        } else if (tomorrowNorm === "1") {
            advice = "Besok dinas pagi (Shift 1). Tidur sekarang adalah investasi energi terbaik.";
        }
    }

    // 3. Konteks khusus Libur Nasional di pagi hari
    if (!advice && todayNorm === "LS" && options?.holidayTodayName && actLower.includes("selamat hari libur")) {
        advice = `Selamat menikmati *${options.holidayTodayName}*, ${userName}! Manfaatkan hari ini untuk istirahat penuh dan me-time.`;
    }

    // 4. Aturan aktivitas spesifik
    if (!advice) {
        if (actLower.includes("mulai kerja")) {
            advice = `Semangat bertugas, ${userName}! Jaga fokus dan hidrasi.`;
        } else if (actLower.includes("olahraga")) {
            advice = activity.note || `Ayo gerak ${userName}! Olahraga setelah kerja bikin badan segar dan tidur makin nyenyak.`;
        }
    }

    // 5. Default fallback ke catatan aktivitas
    if (!advice) {
        advice = activity.note || "Jaga kesehatan dan tetap fokus!";
    }

    const headerLabel = formatShiftHeaderLabel(shiftToday, options?.holidayTodayName);
    return `🔔 *Pengingat: ${activity.activity_name}*\n🕒 Jam: ${activity.time_start} (${headerLabel})\n\n${advice}`;
}

function updateHolidayCache(holidays: HolidayRow[]): void {
    for (const h of holidays) {
        cachedHolidayMap.set(h.date, h.name);
    }
}

function getWibDayOfWeek(yyyyMmDd: string): number {
    // Parse sebagai tengah hari WIB agar aman dari geser timezone
    const d = new Date(`${yyyyMmDd}T12:00:00+07:00`);
    return d.getUTCDay();
}

// ── Job 1: Sinkronisasi Google Sheet ALTO → Database ─────────────────────────
export async function syncSheetToDatabase(targetDate: Date = new Date()): Promise<void> {
    logger.info("[Scheduler] Memulai sinkronisasi harian dari Google Sheet...");
    try {
        await ensureHybridShiftActivities();

        const sheetResult = await fetchShiftSheetWithHolidays(targetDate);
        const shiftsFromSheet = sheetResult.shifts;
        updateHolidayCache(sheetResult.holidays);

        if (!shiftsFromSheet.length) {
            logger.warn("[Scheduler] Tidak ada data shift dari Spreadsheet.");
            return;
        }

        // Ambil semua user dari DB (sorted by nama terpanjang dulu untuk matching)
        const users = await prisma.user.findMany({ select: { id: true, name: true } });
        const dbUsers = users
            .filter((u) => u.name)
            .map((u) => ({ id: u.id, nameLower: u.name!.toLowerCase() }))
            .sort((a, b) => b.nameLower.length - a.nameLower.length);

        const matchedUserIds = new Set<string>();
        let successCount = 0;

        for (const shift of shiftsFromSheet) {
            const sheetNameLower = shift.name.toLowerCase();
            const matchedUser = dbUsers.find(
                (u) => sheetNameLower.includes(u.nameLower) || u.nameLower.includes(sheetNameLower)
            );
            if (!matchedUser) continue;

            matchedUserIds.add(matchedUser.id);

            await prisma.userShift.upsert({
                where: { userId_date: { userId: matchedUser.id, date: new Date(shift.date) } },
                update: { shift_type: shift.shift_type },
                create: {
                    userId: matchedUser.id,
                    date: new Date(shift.date),
                    shift_type: shift.shift_type,
                },
            });
            successCount++;
        }

        // Hentikan blast user lama: bersihkan UserShift mulai hari ini milik user yg tidak ada di spreadsheet
        if (matchedUserIds.size > 0) {
            const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
            const pruned = await prisma.userShift.deleteMany({
                where: {
                    date: { gte: new Date(todayStr) },
                    userId: { notIn: [...matchedUserIds] },
                },
            });
            if (pruned.count > 0) {
                logger.info(
                    `[Scheduler] 🧹 Membersihkan ${pruned.count} jadwal masa depan milik user di luar spreadsheet.`
                );
            }
        }

        logger.info(
            `[Scheduler] Sinkronisasi selesai (${sheetResult.tabName}): ${successCount} jadwal disimpan, ${sheetResult.holidays.length} libur nasional tercatat.`
        );

        // Setelah sync, jadwalkan pengingat hari ini
        await scheduleRemindersForToday();
    } catch (err: any) {
        logger.error("[Scheduler] Gagal sinkronisasi harian", { error: err.message });
    }
}

// ── Job 2: Jadwalkan Pengingat In-Memory untuk Hari Ini ──────────────────────
export async function scheduleRemindersForToday(): Promise<void> {
    const timeZone = "Asia/Jakarta";
    const today = new Date().toLocaleDateString("en-CA", { timeZone }); // YYYY-MM-DD
    const dayOfWeek = getWibDayOfWeek(today);

    logger.info(`[Scheduler] Menjadwalkan pengingat untuk tanggal: ${today}`);

    try {
        await ensureHybridShiftActivities();

        // Jika cache libur nasional masih kosong (misal baru restart), tarik ringan dari sheet bulan berjalan
        if (cachedHolidayMap.size === 0 && process.env.SPREADSHEET_ID && process.env.GOOGLE_API_KEY_SPREADSHEET) {
            try {
                const res = await fetchShiftSheetWithHolidays();
                updateHolidayCache(res.holidays);
            } catch {
                // Non-fatal: tetap lanjut jadwalkan dari DB
            }
        }

        const activities = await prisma.shiftActivity.findMany();
        if (!activities.length) {
            logger.warn("[Scheduler] Tidak ada ShiftActivity di database.");
            return;
        }

        const todayShifts = await prisma.userShift.findMany({
            where: { date: new Date(today) },
            include: { user: true },
        });

        if (!todayShifts.length) {
            logger.info("[Scheduler] Tidak ada shift terdaftar untuk hari ini.");
            return;
        }

        const tomorrow = new Date(`${today}T12:00:00+07:00`);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toLocaleDateString("en-CA", { timeZone });

        const tomorrowShifts = await prisma.userShift.findMany({
            where: { date: new Date(tomorrowStr) },
            select: { userId: true, shift_type: true },
        });
        const tomorrowShiftMap = new Map(tomorrowShifts.map((s) => [s.userId, s.shift_type]));

        const holidayTodayName = cachedHolidayMap.get(today) ?? null;
        const holidayTomorrowName = cachedHolidayMap.get(tomorrowStr) ?? null;

        let scheduled = 0;
        const nowWib = new Date(); // Sistem sudah dikunci ke Asia/Jakarta via Docker ENV TZ

        for (const userShift of todayShifts) {
            const user = userShift.user;
            if (!user.phone_number) continue;

            const resolvedShiftType = resolveActivityShiftType(userShift.shift_type, dayOfWeek);
            let matchingActivities = activities.filter((a) => a.shift_type === resolvedShiftType);

            // Fallback ke tipe dasar jika variasi hari khusus tidak ditemukan
            if (matchingActivities.length === 0 && resolvedShiftType !== userShift.shift_type) {
                matchingActivities = activities.filter((a) => a.shift_type === userShift.shift_type);
            }

            for (const activity of matchingActivities) {
                const [rHour, rMin] = activity.reminder_time.split(":").map(Number);
                if (isNaN(rHour) || isNaN(rMin)) continue;

                const sendAt = new Date();
                sendAt.setHours(rHour, rMin, 0, 0);

                if (sendAt <= nowWib) {
                    logger.info(
                        `[Scheduler] Skip (sudah lewat): ${user.name} – ${activity.activity_name} pukul ${activity.reminder_time}`
                    );
                    continue;
                }

                const todayStart = new Date(`${today}T00:00:00.000Z`);
                const existingLog = await prisma.notificationLog.findFirst({
                    where: {
                        userId: user.id,
                        activityId: activity.id,
                        sent_at: { gte: todayStart },
                    },
                });
                if (existingLog) {
                    logger.info(`[Scheduler] Skip (sudah terkirim): ${user.name} – ${activity.activity_name}`);
                    continue;
                }

                const shiftTomorrow = tomorrowShiftMap.get(user.id) ?? null;
                const message = buildReminderMessage(
                    user.name || "Kamu",
                    activity,
                    userShift.shift_type,
                    shiftTomorrow,
                    { holidayTodayName, holidayTomorrowName }
                );

                const jobName = `shift-${user.id}-${activity.id}`;
                // Batalkan job lama dengan nama sama jika re-schedule
                schedule.scheduledJobs[jobName]?.cancel();

                schedule.scheduleJob(jobName, sendAt, async () => {
                    logger.info(`[Scheduler] Mengirim pengingat ke ${user.name}`, {
                        phone: user.phone_number,
                        activity: activity.activity_name,
                    });

                    await sendTextViaGowa(user.phone_number!, message);

                    await prisma.notificationLog
                        .create({
                            data: { userId: user.id, activityId: activity.id },
                        })
                        .catch((e) =>
                            logger.error("[Scheduler] Gagal simpan NotificationLog", {
                                error: e.message,
                            })
                        );
                });

                logger.info(
                    `[Scheduler] ✅ Alarm terpasang: ${user.name} – ${activity.activity_name} pukul ${activity.reminder_time} (${resolvedShiftType})`
                );
                scheduled++;
            }
        }

        logger.info(`[Scheduler] Total ${scheduled} pengingat dijadwalkan untuk hari ini.`);
    } catch (err: any) {
        logger.error("[Scheduler] Gagal menjadwalkan pengingat", { error: err.message });
    }
}

// ── Fungsi Utama: Aktifkan semua scheduler ────────────────────────────────────
export function startShiftScheduler(): void {
    if (!ENABLE_SCHEDULER) {
        logger.info(
            "[Scheduler] ENABLE_SCHEDULER tidak aktif. Scheduler tidak dijalankan (non-production / Vercel)."
        );
        return;
    }

    logger.info("[Scheduler] ✅ Memulai Kainest Shift & Hybrid ALTO Scheduler...");

    // Cron 1: Sinkronisasi Google Sheet setiap tengah malam (00:05 WIB)
    schedule.scheduleJob({ hour: 0, minute: 5, tz: "Asia/Jakarta" }, () => {
        logger.info("[Scheduler] 🌙 Memulai sinkronisasi tengah malam...");
        syncSheetToDatabase();
    });
    logger.info("[Scheduler] → Job sinkronisasi harian (00:05 WIB) terdaftar.");

    // Startup: Jadwalkan pengingat sisa hari ini langsung saat aplikasi menyala
    logger.info("[Scheduler] → Menjadwalkan pengingat hari ini saat startup...");
    scheduleRemindersForToday();
}
