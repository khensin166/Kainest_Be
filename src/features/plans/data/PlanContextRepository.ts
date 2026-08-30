import { prisma } from "../../../infrastructure/database/prisma.js";

/**
 * Mengumpulkan angka-angka anggaran yang dibutuhkan penjaga solvabilitas.
 *
 * Sengaja memakai rumus yang SAMA PERSIS dengan GetMonthlySummaryUseCase:
 *   totalRemaining = totalLimit - totalSpent   (sisa di dalam kantong)
 *   unallocated    = salary - totalLimit       (gaji yang belum masuk kantong)
 * Kalau kedua tempat menghitung sendiri-sendiri, keduanya akan menyimpang
 * begitu salah satunya disunting.
 */
export const planContextRepository = {
  async getUserBudget(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, salary: true, payday: true },
    });
  },

  /** Total limit seluruh kantong, dengan persentase dihitung ulang atas gaji terkini. */
  async getTotalPocketLimit(userId: string, salary: number) {
    const pockets = await prisma.budgetPocket.findMany({
      where: { userId },
      select: { percentage: true, limitAmount: true },
    });
    return pockets.reduce((total, p) => {
      if (p.percentage && p.percentage > 0) {
        return total + Math.floor((p.percentage / 100) * salary);
      }
      return total + Math.floor(p.limitAmount ?? 0);
    }, 0);
  },

  /** Total pengeluaran dalam rentang siklus. */
  async getTotalSpent(userId: string, cycleStart: Date, cycleEnd: Date) {
    const hasil = await prisma.transaction.aggregate({
      where: { userId, type: "EXPENSE", date: { gte: cycleStart, lte: cycleEnd } },
      _sum: { amount: true },
    });
    return hasil._sum.amount ?? 0;
  },
};
