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

  /**
   * CQRS: Write-Time Sync
   * Menghitung ulang total pengeluaran per kategori untuk suatu bulan
   * dan menyimpannya langsung ke MonthlyFinancialHistory.
   */
  async syncMonthlyHistory(userId: string, targetDate: Date) {
    try {
      const startDate = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), 1));
      const nextMonthStart = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, 1));
      const endDate = new Date(nextMonthStart.getTime() - 1);

      let history = await this.findMonthlyHistory(userId, startDate);
      if (!history) {
        // Jika history tidak ada, buat baru berdasarkan konfigurasi pocket user saat ini
        const user = await this.findUserById(userId);
        if (!user) return;

        const activePockets = await prisma.budgetPocket.findMany({
          where: { userId },
          include: { category: true }
        });

        const salary = user.salary || 0;

        // [FIX: Pocket Rollover] Jika kantong menggunakan persentase, hitung ulang limitAmount
        // dari gaji user saat ini. Sebelumnya, jika kantong diset dengan percentage,
        // limitAmount-nya bisa 0 sehingga template bulan baru terlihat kosong.
        const pocketsSnapshot = activePockets.map(p => {
          let limitAmount = p.limitAmount || 0;
          if (p.percentage != null && p.percentage > 0 && salary > 0) {
            limitAmount = Math.floor((p.percentage / 100) * salary);
          }
          return {
            categoryId: p.categoryId,
            categoryName: p.category.name,
            limitAmount,
            icon: p.category.icon || '💰',
            spent: 0
          };
        });

        let totalBudgeted = pocketsSnapshot.reduce((acc, p) => acc + p.limitAmount, 0);
        let totalSaved = 0;

        const savingPocket = pocketsSnapshot.find(p => p.categoryName.toLowerCase().includes('tabungan') || p.categoryName.toLowerCase().includes('saving'));
        if (savingPocket) {
           totalSaved = savingPocket.limitAmount;
           totalBudgeted -= savingPocket.limitAmount;
        }

        history = await this.upsertMonthlyHistory(userId, startDate, {
           salarySnapshot: user.salary || 0,
           totalBudgeted: totalBudgeted,
           totalSaved: totalSaved,
           pocketsSnapshot: pocketsSnapshot,
           totalSpent: 0
        });
      }

      // 🆕 Query terpisah: EXPENSE dan INCOME
      const expenseGrouped = await this.getMonthlyExpenseGrouped(userId, startDate, endDate);
      const incomeGrouped = await this.getMonthlyIncomeGrouped(userId, startDate, endDate);

      let actualSaved = 0;
      let totalSpent = 0;
      let totalIncome = 0;

      const allCategories = await this.findAllCategories(userId);

      let pocketsSnapshot: any[] = [];
      if (history.pocketsSnapshot) {
          if (typeof history.pocketsSnapshot === 'string') {
              try { pocketsSnapshot = JSON.parse(history.pocketsSnapshot); } catch (e) {}
          } else if (Array.isArray(history.pocketsSnapshot)) {
              pocketsSnapshot = history.pocketsSnapshot as any[];
          }
      }

      pocketsSnapshot = pocketsSnapshot.map((pocket) => {
        const expense = expenseGrouped.find((e) => e.categoryId === pocket.categoryId);
        pocket.spent = expense?._sum.amount || 0;
        return pocket;
      });

      // Hitung totalSpent dan totalSaved dari transaksi EXPENSE
      expenseGrouped.forEach(curr => {
        const cat = allCategories.find(c => c.id === curr.categoryId);
        const isSavings = cat && (cat.name.toLowerCase().includes('tabungan') || cat.name.toLowerCase().includes('saving'));
        
        if (isSavings) {
            actualSaved += (curr._sum.amount || 0);
        } else {
            totalSpent += (curr._sum.amount || 0);
        }
      });

      // Hitung totalIncome dari transaksi INCOME
      incomeGrouped.forEach(curr => {
        totalIncome += (curr._sum.amount || 0);
      });

      await prisma.monthlyFinancialHistory.update({
        where: { id: history.id },
        data: {
          totalSpent: totalSpent,
          totalSaved: actualSaved,
          totalIncome: totalIncome,
          pocketsSnapshot: pocketsSnapshot
        }
      });

      console.log(`✅ [Write-Time Sync] History ${startDate.toISOString()} synced. Spent: ${totalSpent}, Income: ${totalIncome}`);
    } catch (e) {
      console.error("❌ [Write-Time Sync] Gagal sinkronisasi:", e);
    }
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
   * Mengambil Total Pengeluaran (EXPENSE) per Kategori dalam satu bulan
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
        type: "EXPENSE",
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });
  },

  /**
   * 🆕 Mengambil Total Pemasukan (INCOME) per Kategori dalam satu bulan
   */
  async getMonthlyIncomeGrouped(
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
        type: "INCOME",
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
      // 🆕 Kategori Pemasukan Default
      { name: "Pemasukan Umum", type: "INCOME", icon: "💵", isDefault: true },
      { name: "Gaji & Pendapatan Tetap", type: "INCOME", icon: "🏦", isDefault: true },
      { name: "Bonus / THR", type: "INCOME", icon: "🎁", isDefault: true },
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
            type: cat.type as any, // Cast enum
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
