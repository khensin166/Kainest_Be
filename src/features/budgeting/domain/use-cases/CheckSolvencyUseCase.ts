import { prisma } from "../../../../infrastructure/database/prisma.js";
import { getCycleBoundaries } from "../../../../utils/cycleBoundaries.js";
import { sendTextViaGowa } from "../../../../utils/gowaService.js";
import { logger } from "../../../../infrastructure/logger/logger.js";

const formatIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);

export async function checkSolvencyAlert(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { botActiveGroups: true }
    });

    if (!user) return;

    const now = new Date();
    const cycle = getCycleBoundaries(now, user.payday ?? 31);

    // 1. Dapatkan Uang Sisa Saat Ini
    const history = await prisma.monthlyFinancialHistory.findFirst({
      where: { userId, period: cycle.period }
    });
    
    if (!history) return;

    const totalIncome = (history.salarySnapshot || 0) + (history.totalIncome || 0);
    const totalSpent = history.totalSpent || 0;
    const currentCash = totalIncome - totalSpent;

    // 2. Dapatkan Total Tagihan Wajib yang Belum Dibayar
    const activeBills = await prisma.recurringBill.findMany({
      where: { userId, status: "ACTIVE" }
    });

    let unpaidBillsTotal = 0;
    let unpaidBillsCount = 0;

    for (const bill of activeBills) {
      const payment = await prisma.billPayment.findUnique({
        where: { billId_period: { billId: bill.id, period: cycle.period } }
      });

      if (!payment || (payment.status !== "PAID" && payment.status !== "SKIPPED")) {
        unpaidBillsTotal += bill.amount;
        unpaidBillsCount += 1;
      }
    }

    // 3. Hitung Sisa Aman
    const sisaAman = currentCash - unpaidBillsTotal;

    // 4. Tentukan Zona
    let zone: "SAFE" | "WARNING" | "DANGER" = "SAFE";
    if (sisaAman < 0) {
      zone = "DANGER";
    } else if (sisaAman < unpaidBillsTotal * 0.2) {
      // Misal WARNING jika sisa aman kurang dari 20% total tagihan
      zone = "WARNING";
    }

    // Hanya kirim alert jika DANGER
    if (zone !== "DANGER") return;

    // 5. Cek CommitmentAlert agar tidak spam
    const existingAlert = await prisma.commitmentAlert.findUnique({
      where: { userId_period_zone: { userId, period: cycle.period, zone } }
    });

    if (existingAlert) {
      // Sudah pernah di-blast untuk zona ini di siklus ini
      return;
    }

    // 6. Catat ke CommitmentAlert
    await prisma.commitmentAlert.create({
      data: {
        userId,
        period: cycle.period,
        zone,
        shortfall: Math.abs(sisaAman)
      }
    });

    // 7. Blast WA
    const BOT_ENV_MODE = process.env.BOT_ENV_MODE || "production";
    const STAGING_ALLOWED_NUMBERS = (process.env.STAGING_ALLOWED_NUMBERS || "").split(",").map(s => s.trim());
    
    const targetGroup = user.botActiveGroups[0]?.groupId || user.whatsappJid;
    if (!targetGroup) return;

    if (BOT_ENV_MODE !== "production" && !STAGING_ALLOWED_NUMBERS.includes(targetGroup)) {
      logger.info(`[Solvency] Melewati blast ke ${targetGroup} (staging restricted)`);
      return;
    }

    const message = `🚨 *PERINGATAN ZONA MERAH* 🚨\n\n` +
      `Sisa uang kamu saat ini (*${formatIDR(currentCash)}*) sudah LEBIH KECIL dari total ${unpaidBillsCount} tagihan wajib yang belum dibayar (*${formatIDR(unpaidBillsTotal)}*).\n\n` +
      `⚠️ *Artinya: Uang kamu tidak akan cukup untuk melunasi tagihan bulan ini!*\n\n` +
      `Segera hentikan pengeluaran yang tidak perlu atau cari tambahan dana.`;

    await sendTextViaGowa(targetGroup, message);
    logger.info(`[Solvency] Mengirim peringatan DANGER ke user ${userId}`);

  } catch (err: any) {
    logger.error("[Solvency] Error checking solvency", { error: err.message });
  }
}
