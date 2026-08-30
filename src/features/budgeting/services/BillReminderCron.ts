// src/features/budgeting/services/BillReminderCron.ts
import * as schedule from "node-schedule";
import { prisma } from "../../../infrastructure/database/prisma.js";
import { logger } from "../../../infrastructure/logger/logger.js";
import { getCycleBoundaries } from "../../../utils/cycleBoundaries.js";
import { sendTextViaGowa } from "../../../utils/gowaService.js";

const ENABLE_SCHEDULER = process.env.ENABLE_SCHEDULER === "true";
const BOT_ENV_MODE = process.env.BOT_ENV_MODE || "production";
const STAGING_ALLOWED_NUMBERS = (process.env.STAGING_ALLOWED_NUMBERS || "").split(",").map(s => s.trim());

const formatIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);

export async function processBillReminders() {
  logger.info("[BillReminderCron] Memulai pengecekan tagihan jatuh tempo...");
  try {
    const now = new Date();
    // Gunakan zona waktu server lokal jika dibutuhkan, tapi Date() sudah menggunakan waktu server saat ini.
    // Menghilangkan jam/menit/detik untuk komparasi sisa hari
    const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const activeBills = await prisma.recurringBill.findMany({
      where: { status: "ACTIVE" },
      include: {
        user: { include: { botActiveGroups: true } }
      }
    });

    for (const bill of activeBills) {
      const { period, cycleStart } = getCycleBoundaries(now, bill.user.payday ?? 31);
      
      const payment = await prisma.billPayment.findUnique({
        where: { billId_period: { billId: bill.id, period } }
      });

      if (payment && (payment.status === "PAID" || payment.status === "SKIPPED")) {
        continue;
      }

      const dueDay = bill.dueDay;
      let dueMonth = cycleStart.getMonth();
      let dueYear = cycleStart.getFullYear();
      
      // Jika dueDay lebih kecil dari tanggal mulai siklus, berarti tagihan itu ada di bulan berikutnya dari cycleStart
      if (dueDay < cycleStart.getDate()) {
        dueMonth += 1;
        if (dueMonth > 11) {
          dueMonth = 0;
          dueYear += 1;
        }
      }
      
      const targetDueDate = new Date(dueYear, dueMonth, dueDay);

      const diffTime = targetDueDate.getTime() - todayZero.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= bill.reminderDaysBefore && diffDays >= 0) {
        // Ambil grup bot atau kontak pribadi user
        const userGroup = bill.user.botActiveGroups[0]?.groupId || bill.user.whatsappJid;
        if (!userGroup) continue;

        if (BOT_ENV_MODE !== "production" && !STAGING_ALLOWED_NUMBERS.includes(userGroup)) {
          logger.info(`[BillReminderCron] Melewati blast ke ${userGroup} (staging restricted)`);
          continue;
        }

        const hMinStr = diffDays === 0 ? "HARI INI!" : `H-${diffDays}`;
        const message = `🚨 *PENGINGAT TAGIHAN* 🚨\n\n` +
          `Tagihan *${bill.name}* jatuh tempo *${hMinStr}*\n` +
          `💰 Nominal: ${formatIDR(bill.amount)}\n\n` +
          `Jangan lupa dibayar ya! Ketik *!tagihan* untuk melihat daftar tagihan, lalu *!bayar <kode>* jika sudah lunas.`;

        await sendTextViaGowa(userGroup, message);
        logger.info(`[BillReminderCron] Mengirim pengingat untuk tagihan ${bill.id} ke ${userGroup}`);
      }
    }
  } catch (err: any) {
    logger.error("[BillReminderCron] Error saat memproses tagihan", { error: err.message });
  }
}

export function startBillReminderScheduler() {
  if (!ENABLE_SCHEDULER) {
    logger.info("[BillReminderCron] ENABLE_SCHEDULER=false. Cron pengingat tagihan dimatikan.");
    return;
  }
  
  // Berjalan setiap hari pukul 07:00 WIB
  schedule.scheduleJob("0 7 * * *", () => {
    processBillReminders();
  });
  logger.info("[BillReminderCron] Berhasil dijadwalkan: setiap pukul 07:00 WIB");
}
