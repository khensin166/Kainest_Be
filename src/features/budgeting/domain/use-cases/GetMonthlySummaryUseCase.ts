import { budgetRepository } from "../../data/BudgetRepository.js";
import { pocketRepository } from "../../data/PocketRepository.js";

export const getMonthlySummaryUseCase = async (userId: string) => {
  try {
    // 1. Tentukan Range Tanggal (Bulan Ini)
    // KODE BARU (Konsisten UTC di manapun)
    const now = new Date();

    // 1. startDate: Gunakan Date.UTC untuk memaksa jam 00:00:00 UTC persis
    const startDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    );

    // 2. endDate: Ambil awal bulan depan UTC, lalu kurangi 1 milidetik
    const nextMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
    );
    const endDate = new Date(nextMonthStart.getTime() - 1); // Ini akan jadi tgl terakhir bulan ini jam 23:59:59.999 UTC

    // LOG CCTV (Untuk memastikan hasilnya konsisten 00:00:00Z di Vercel nanti)
    console.log("=================[DEBUG SUMMARY UTC FIX]=================");
    console.log(
      `📅 Periode (UTC Forced): ${startDate.toISOString()} s/d ${endDate.toISOString()}`
    );

    // 🔥 CCTV 1: Cek User ID dan Periode Tanggal
    console.log("=================[DEBUG SUMMARY]=================");
    console.log(`👤 User ID: ${userId}`);
    console.log(
      `📅 Periode: ${startDate.toISOString()} s/d ${endDate.toISOString()}`
    );

    // 2. Ambil History Bulanan
    let history = await budgetRepository.findMonthlyHistory(userId, startDate);
    const user = await budgetRepository.findUserById(userId);
    const salary = user?.salary || 0;

    // 🔥 LAZY LOADING: Jika history bulan ini belum ada, kita buatkan otomatis 
    // berdasarkan blueprint/Pocket yang ada. (Otomatis pindah bulan!)
    if (!history && salary > 0) {
      console.log(`🔄 [LAZY LOAD] Membuat history baru untuk bulan ${startDate.toISOString()}`);
      
      const pockets = await pocketRepository.findPocketsByUser(userId);
      const categories = await budgetRepository.findAllCategories();
      
      let totalBudgeted = 0;
      let totalSaved = 0;
      
      const newPocketsSnapshot = pockets.map((p) => {
        let amountLimit = p.limitAmount || 0;
        if (p.percentage != null) {
          amountLimit = Math.floor((p.percentage / 100) * salary);
        }
        
        const catDetail = categories.find(c => c.id === p.categoryId);
        const isSaving = catDetail?.name.toLowerCase().includes('tabungan') || catDetail?.name.toLowerCase().includes('saving');

        totalBudgeted += amountLimit;
        if (isSaving) {
          totalSaved += amountLimit;
        }

        return {
          categoryId: p.categoryId,
          categoryName: catDetail?.name || "Unknown",
          icon: catDetail?.icon || "💰",
          limitAmount: amountLimit,
        };
      });

      // Simpan history baru
      history = await budgetRepository.upsertMonthlyHistory(userId, startDate, {
        salarySnapshot: salary,
        totalBudgeted: totalBudgeted,
        totalSaved: totalSaved,
        pocketsSnapshot: newPocketsSnapshot,
        totalSpent: 0
      });
    }

    let pocketsSnapshot: any[] = [];
    if (history && history.pocketsSnapshot) {
        if (typeof history.pocketsSnapshot === 'string') {
            try {
                pocketsSnapshot = JSON.parse(history.pocketsSnapshot);
            } catch (e) {
                pocketsSnapshot = [];
            }
        } else if (Array.isArray(history.pocketsSnapshot)) {
            pocketsSnapshot = history.pocketsSnapshot;
        }
    }

    // 3. Ambil Realisasi Pengeluaran (Group By Category)
    // Hasil: [{ categoryId: 'xxx', _sum: { amount: 50000 } }, ...]
    const expenses = await budgetRepository.getMonthlyExpenseGrouped(
      userId,
      startDate,
      endDate
    );

    // 4. Gabungkan Data (Merge Snapshot + Expense)
    const summary = pocketsSnapshot.map((pocket) => {
      // Cari pengeluaran yang cocok dengan kategori ini
      const expense = expenses.find((e) => e.categoryId === pocket.categoryId);
      const spent = expense?._sum.amount || 0;
      const amountLimit = pocket.limitAmount || 0;
      const remaining = amountLimit - spent;
      const percentage = amountLimit > 0 ? Math.min((spent / amountLimit) * 100, 100) : 0;

      return {
        categoryId: pocket.categoryId,
        categoryName: pocket.categoryName,
        icon: pocket.icon,
        limit: amountLimit,
        spent: spent,
        remaining: remaining,
        percentage_used: Math.round(percentage),
        status:
          remaining < 0 ? "OVERBUDGET" : percentage > 80 ? "WARNING" : "SAFE",
      };
    });

    // 5. Hitung Total Keseluruhan
    const totalLimit = summary.reduce((acc, curr) => acc + curr.limit, 0);
    const totalSpent = summary.reduce((acc, curr) => acc + curr.spent, 0);

    return {
      success: true,
      data: {
        salary: salary, // Penting untuk cek apakah user sudah input gaji!
        month: startDate.toLocaleString("default", {
          month: "long",
          year: "numeric",
        }),
        totals: {
          limit: totalLimit,
          spent: totalSpent,
          remaining: totalLimit - totalSpent,
        },
        categories: summary,
      },
    };
  } catch (error) {
    console.error("Get Summary Error:", error);
    return {
      success: false,
      status: 500,
      message: "Failed to get monthly summary",
    };
  }
};
