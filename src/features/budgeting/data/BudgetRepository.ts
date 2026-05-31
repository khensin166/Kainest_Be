// BudgetRepository.ts
import { prisma } from "../../../infrastructure/database/prisma.js";

export const budgetRepository = {
  /**
   * Cari Monthly History user di bulan tertentu
   */
  async findMonthlyHistory(userId: string, monthDate: Date) {
    return prisma.monthlyFinancialHistory.findUnique({
      where: {
        userId_period: {
          userId: userId,
          period: monthDate,
        },
      },
    });
  },

  /**
   * Ambil semua riwayat keuangan bulanan milik user, diurutkan dari yang terbaru
   */
  async findAllMonthlyHistory(userId: string) {
    return prisma.monthlyFinancialHistory.findMany({
      where: { userId },
      orderBy: { period: "desc" },
    });
  },

  async findUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { salary: true }
    });
  },

  async updateUserSalary(userId: string, salary: number) {
    return prisma.user.update({
      where: { id: userId },
      data: { salary }
    });
  },

  /**
   * Ambil semua kategori (Global + Custom milik User)
   */
  async findAllCategories(userId?: string) {
    return prisma.budgetCategory.findMany({
      where: userId ? {
        OR: [
          { isDefault: true },
          { userId: null },
          { userId: userId }
        ]
      } : {
        OR: [
          { isDefault: true },
          { userId: null }
        ]
      },
      orderBy: { name: "asc" },
    });
  },

  /**
   * Membuat kategori kustom milik user
   */
  async createCustomCategory(userId: string, name: string, icon: string) {
    return prisma.budgetCategory.create({
      data: {
        name,
        icon,
        type: "EXPENSE",
        isDefault: false,
        userId: userId,
      }
    });
  },

  async upsertMonthlyHistory(
    userId: string,
    period: Date,
    data: {
      salarySnapshot: number;
      totalBudgeted: number;
      totalSaved: number;
      pocketsSnapshot: any;
      totalSpent?: number;
    }
  ) {
    return prisma.monthlyFinancialHistory.upsert({
      where: {
        userId_period: {
          userId,
          period,
        },
      },
      update: {
        salarySnapshot: data.salarySnapshot,
        totalBudgeted: data.totalBudgeted,
        totalSaved: data.totalSaved,
        pocketsSnapshot: data.pocketsSnapshot,
        ...(data.totalSpent !== undefined && { totalSpent: data.totalSpent })
      },
      create: {
        userId,
        period,
        salarySnapshot: data.salarySnapshot,
        totalBudgeted: data.totalBudgeted,
        totalSaved: data.totalSaved,
        pocketsSnapshot: data.pocketsSnapshot,
        totalSpent: data.totalSpent || 0
      },
    });
  },

  /**
   * Mengambil Total Pengeluaran per Kategori dalam satu bulan (Bulk)
   * Menggunakan GroupBy agar efisien (1 query database)
   */
  async getMonthlyExpenseGrouped(
    userId: string,
    startDate: Date,
    endDate: Date
  ) {
    return prisma.transaction.groupBy({
      by: ["categoryId"],
      _sum: {
        amount: true,
      },
      where: {
        userId: userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });
  },

  /**
   * SEED: Membuat kategori default jika belum ada
   */
  async seedDefaultCategories() {
    const defaults = [
      { name: "Makan & Minum", type: "EXPENSE", icon: "🍔", isDefault: true },
      { name: "Transportasi", type: "EXPENSE", icon: "🚗", isDefault: true },
      {
        name: "Tempat Tinggal (Kos/Sewa)",
        type: "EXPENSE",
        icon: "🏠",
        isDefault: true,
      },
      { name: "Hiburan", type: "EXPENSE", icon: "🎬", isDefault: true },
      { name: "Belanja Bulanan", type: "EXPENSE", icon: "🛒", isDefault: true },
      {
        name: "Tabungan & Investasi",
        type: "EXPENSE",
        icon: "💰",
        isDefault: true,
      }, // Dianggap expense cashflow
    ];

    // Gunakan transaction agar atomic (masuk semua atau gagal semua)
    // createMany skipDuplicates hanya jalan di DB tertentu, kita pakai loop aman saja
    const results = [];
    for (const cat of defaults) {
      // Cek dulu biar gak duplikat
      const exists = await prisma.budgetCategory.findFirst({
        where: { name: cat.name },
      });
      if (!exists) {
        const newCat = await prisma.budgetCategory.create({
          data: {
            name: cat.name,
            type: "EXPENSE" as any, // Cast enum
            icon: cat.icon,
            isDefault: true,
            // userId null artinya ini global category
          },
        });
        results.push(newCat);
      }
    }
    return results;
  },
};
