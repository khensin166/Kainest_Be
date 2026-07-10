// src/features/wabot/services/ShiftSchedulerService.ts
// Layanan penjadwalan pengingat shift kerja.
// - Sinkronisasi harian dari Google Spreadsheet ke database (00:05 WIB)
// - Menjadwalkan "alarm" in-memory untuk pengingat 30 menit sebelum shift
// - Anti-dobel: Hanya aktif jika ENABLE_SCHEDULER=true (HANYA di .env VPS Production)
import * as schedule from "node-schedule";
import { prisma } from "../../../infrastructure/database/prisma.js";
import { fetchShiftDataFromSheet } from "../../../infrastructure/google/sheetClient.js";
import { logger } from "../../../infrastructure/logger/logger.js";
// ── Env config ──────────────────────────────────────────────────────────────
const GOWA_BASE_URL = process.env.GOWA_BASE_URL || "http://gowa:3000";
const GOWA_API_KEY = process.env.WA_BOT_API_KEY || process.env.GOWA_API_KEY || "";
const GOWA_DEVICE_ID = process.env.WA_BOT_DEVICE_ID || process.env.GOWA_DEVICE_ID || "";
const ENABLE_SCHEDULER = process.env.ENABLE_SCHEDULER === "true";
// ── Helper: Kirim pesan teks via GOWA ───────────────────────────────────────
async function sendTextViaGowa(phone, message) {
    const url = `${GOWA_BASE_URL}/send/message`;
    try {
        const resp = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Device-Id": GOWA_DEVICE_ID,
                ...(GOWA_API_KEY ? { Authorization: `Basic ${GOWA_API_KEY}` } : {}),
            },
            body: JSON.stringify({ phone, message }),
        });
        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`GOWA send failed [${resp.status}]: ${text}`);
        }
        logger.info("[Scheduler] Pengingat shift terkirim", { phone });
    }
    catch (err) {
        logger.error("[Scheduler] Gagal kirim pesan via GOWA", { phone, error: err.message });
    }
}
// ── Helper: Bangun pesan pengingat yang cerdas ───────────────────────────────
function buildReminderMessage(userName, activity, shiftToday, shiftTomorrow) {
    const tomorrow = shiftTomorrow || "Libur";
    let advice = "";
    // Aturan jadwal berat (clopen / shift pendek)
    if (shiftToday === "2" && tomorrow === "1") {
        advice = "⚠️ *Perhatian:* Jadwalmu besok pagi (Shift 1) setelah siang ini (Shift 2). Pulang kerja langsung istirahat ya!";
    }
    else if (shiftToday === "3" && tomorrow === "1") {
        advice = "⚠️ *Warning:* Pindah dari Shift 3 ke Shift 1 itu berat. Pastikan tidur minimal 6-7 jam begitu sampai rumah.";
    }
    else if (shiftToday === "3" && tomorrow === "2") {
        advice = "💡 Besok masuk siang (Shift 2). Manfaatkan waktu pagi untuk tidur berkualitas setelah Shift 3 ini.";
    }
    // Aturan aktivitas spesifik
    if (!advice) {
        const actLower = activity.activity_name.toLowerCase();
        if (actLower.includes("tidur")) {
            advice = tomorrow === "1"
                ? "Besok dinas pagi. Tidur sekarang adalah investasi energi terbaik."
                : `Selamat beristirahat, ${userName}.`;
        }
        else if (actLower.includes("mulai kerja")) {
            advice = `Semangat bertugas, ${userName}! Jaga hidrasi.`;
        }
    }
    // Default
    if (!advice) {
        advice = activity.note || "Jaga kesehatan dan tetap fokus!";
    }
    return `🔔 *Pengingat: ${activity.activity_name}*\n🕒 Jam: ${activity.time_start} (Shift ${shiftToday})\n\n${advice}`;
}
// ── Job 1: Sinkronisasi Google Sheet → Database ───────────────────────────────
async function syncSheetToDatabase() {
    logger.info("[Scheduler] Memulai sinkronisasi harian dari Google Sheet...");
    try {
        const shiftsFromSheet = await fetchShiftDataFromSheet();
        if (!shiftsFromSheet.length) {
            logger.warn("[Scheduler] Tidak ada data shift dari Spreadsheet.");
            return;
        }
        // Ambil semua user dari DB (sorted by nama terpanjang dulu untuk matching)
        const users = await prisma.user.findMany({ select: { id: true, name: true } });
        const dbUsers = users
            .filter((u) => u.name)
            .map((u) => ({ id: u.id, nameLower: u.name.toLowerCase() }))
            .sort((a, b) => b.nameLower.length - a.nameLower.length);
        logger.info(`[Scheduler] Ditemukan ${users.length} user di DB.`);
        // Match nama sheet → user DB
        let successCount = 0;
        for (const shift of shiftsFromSheet) {
            const sheetNameLower = shift.name.toLowerCase();
            const matchedUser = dbUsers.find((u) => sheetNameLower.includes(u.nameLower));
            if (!matchedUser)
                continue;
            // Upsert ke tabel UserShift
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
        logger.info(`[Scheduler] Sinkronisasi selesai: ${successCount} shift disimpan.`);
        // Setelah sync, jadwalkan pengingat hari ini
        await scheduleRemindersForToday();
    }
    catch (err) {
        logger.error("[Scheduler] Gagal sinkronisasi harian", { error: err.message });
    }
}
// ── Job 2: Jadwalkan Pengingat In-Memory untuk Hari Ini ──────────────────────
export async function scheduleRemindersForToday() {
    const timeZone = "Asia/Jakarta";
    const today = new Date().toLocaleDateString("en-CA", { timeZone }); // YYYY-MM-DD
    logger.info(`[Scheduler] Menjadwalkan pengingat untuk tanggal: ${today}`);
    try {
        // Ambil semua ShiftActivity dari DB
        const activities = await prisma.shiftActivity.findMany();
        if (!activities.length) {
            logger.warn("[Scheduler] Tidak ada ShiftActivity di database.");
            return;
        }
        // Ambil semua UserShift hari ini beserta data user
        const todayShifts = await prisma.userShift.findMany({
            where: { date: new Date(today) },
            include: { user: true },
        });
        if (!todayShifts.length) {
            logger.info("[Scheduler] Tidak ada shift terdaftar untuk hari ini.");
            return;
        }
        // Ambil shift besok untuk saran cerdas
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toLocaleDateString("en-CA", { timeZone });
        const tomorrowShifts = await prisma.userShift.findMany({
            where: { date: new Date(tomorrowStr) },
            select: { userId: true, shift_type: true },
        });
        const tomorrowShiftMap = new Map(tomorrowShifts.map((s) => [s.userId, s.shift_type]));
        let scheduled = 0;
        const nowWib = new Date(new Date().toLocaleString("en-US", { timeZone }));
        for (const userShift of todayShifts) {
            const user = userShift.user;
            if (!user.phone_number)
                continue;
            // Cari semua aktivitas yang sesuai shift_type user ini
            const matchingActivities = activities.filter((a) => a.shift_type === userShift.shift_type);
            for (const activity of matchingActivities) {
                // reminder_time format "HH:MM" → hitung waktu kirim (30 menit SEBELUM shift dimulai)
                // Tapi existing data mungkin sudah menyimpan reminder_time yg tepat, 
                // jadi kita gunakan langsung sebagai jam kirim notifikasi
                const [rHour, rMin] = activity.reminder_time.split(":").map(Number);
                if (isNaN(rHour) || isNaN(rMin))
                    continue;
                const sendAt = new Date();
                sendAt.setHours(rHour, rMin, 0, 0);
                // Skip jika waktu kirim sudah lewat hari ini
                if (sendAt <= nowWib) {
                    logger.info(`[Scheduler] Skip (sudah lewat): ${user.name} – ${activity.activity_name} pukul ${activity.reminder_time}`);
                    continue;
                }
                // Cek apakah sudah pernah kirim log hari ini (anti-dobel dari DB)
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
                const message = buildReminderMessage(user.name || "Kamu", activity, userShift.shift_type, shiftTomorrow);
                // Pasang timer in-memory (node-schedule)
                const jobName = `shift-${user.id}-${activity.id}`;
                schedule.scheduleJob(jobName, sendAt, async () => {
                    logger.info(`[Scheduler] Mengirim pengingat ke ${user.name}`, {
                        phone: user.phone_number,
                        activity: activity.activity_name,
                    });
                    await sendTextViaGowa(user.phone_number, message);
                    // Catat ke NotificationLog
                    await prisma.notificationLog.create({
                        data: { userId: user.id, activityId: activity.id },
                    }).catch((e) => logger.error("[Scheduler] Gagal simpan NotificationLog", { error: e.message }));
                });
                logger.info(`[Scheduler] ✅ Alarm terpasang: ${user.name} – ${activity.activity_name} pukul ${activity.reminder_time}`);
                scheduled++;
            }
        }
        logger.info(`[Scheduler] Total ${scheduled} pengingat dijadwalkan untuk hari ini.`);
    }
    catch (err) {
        logger.error("[Scheduler] Gagal menjadwalkan pengingat", { error: err.message });
    }
}
// ── Fungsi Utama: Aktifkan semua scheduler ────────────────────────────────────
export function startShiftScheduler() {
    // Guard: Hanya aktif jika ENABLE_SCHEDULER=true (VPS Production saja)
    if (!ENABLE_SCHEDULER) {
        logger.info("[Scheduler] ENABLE_SCHEDULER tidak aktif. Scheduler tidak dijalankan (non-production / Vercel).");
        return;
    }
    logger.info("[Scheduler] ✅ Memulai Kainest Shift Scheduler...");
    // Cron 1: Sinkronisasi Google Sheet setiap tengah malam (00:05 WIB)
    schedule.scheduleJob({ hour: 0, minute: 5, tz: "Asia/Jakarta" }, () => {
        logger.info("[Scheduler] 🌙 Memulai sinkronisasi tengah malam...");
        syncSheetToDatabase();
    });
    logger.info("[Scheduler] → Job sinkronisasi harian (00:05 WIB) terdaftar.");
    // Startup: Jadwalkan pengingat sisa hari ini langsung saat aplikasi menyala
    // Ini memastikan scheduler tetap berjalan meski container restart di siang hari
    logger.info("[Scheduler] → Menjadwalkan pengingat hari ini saat startup...");
    scheduleRemindersForToday();
}
