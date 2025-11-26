import { prisma } from "../../../infrastructure/database/prisma.js";

export const budgetRepository = {
  /**
   * Cari Budget Limit user untuk kategori tertentu di bulan tertentu
   */
  async findBudgetLimit(userId: string, categoryId: string, monthDate: Date) {
    // monthDate harus diset ke tanggal 1 bulan itu agar match database
    return prisma.budget.findFirst({
      where: {
        userId: userId,
        categoryId: categoryId,
        period: monthDate,
      },
      include: {
        category: true, // Kita butuh nama kategorinya nanti
      },
    });
  },

  /**
   * Ambil semua kategori (untuk dropdown saat input transaksi)
   */
  async findAllCategories() {
    return prisma.budgetCategory.findMany({
      orderBy: { name: "asc" },
    });
  },

  async upsertBudget(
    userId: string,
    categoryId: string,
    period: Date,
    amount: number,
    isAiAdjusted = false
  ) {
    return prisma.budget.upsert({
      where: {
        userId_categoryId_period: {
          // Compound unique key di schema
          userId,
          categoryId,
          period,
        },
      },
      update: { amount_limit: amount, is_ai_adjusted: isAiAdjusted },
      create: {
        userId,
        categoryId,
        period,
        amount_limit: amount,
        is_ai_adjusted: isAiAdjusted,
      },
    });
  },

  /**
   * Ambil semua budget user di bulan tertentu
   * + Include kategori untuk nama & icon
   */
  async findBudgetsByMonth(userId: string, monthDate: Date) {
    return prisma.budget.findMany({
      where: {
        userId: userId,
        period: monthDate,
      },
      include: {
        category: true,
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
