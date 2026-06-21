import { budgetRepository } from "../../data/BudgetRepository.js";
import { pocketRepository } from "../../data/PocketRepository.js";

export const getMonthlySummaryUseCase = async (userId: string) => {
  try {
    // 1. Tentukan Range Tanggal (Bulan Ini) - Konsisten UTC
    const now = new Date();

    const startDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    );

    const nextMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
    );
    const endDate = new Date(nextMonthStart.getTime() - 1);

    // 🆕 Bulan lalu untuk kalkulasi MoM (Month-over-Month)
    const prevMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
    );

    // 2. Ambil History Bulanan
    let history = await budgetRepository.findMonthlyHistory(userId, startDate);
    const user = await budgetRepository.findUserById(userId);
    const salary = user?.salary || 0;

    // 🔥 LAZY LOADING: Jika history bulan ini belum ada, buat otomatis
    if (!history && salary > 0) {
      const pockets = await pocketRepository.findPocketsByUser(userId);
      const categories = await budgetRepository.findAllCategories(userId);
      
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

    // 3. Ambil Realisasi Pengeluaran (hanya EXPENSE)
    const expenses = await budgetRepository.getMonthlyExpenseGrouped(
      userId,
      startDate,
      endDate
    );

    // 4. Gabungkan Data (Merge Snapshot + Expense)
    const summary = pocketsSnapshot.map((pocket) => {
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
    const totalIncome = history?.totalIncome || 0;
    const unallocated = Math.max(0, salary - totalLimit);

    // 🆕 6. Kalkulasi MoM (Month-over-Month) secara dinamis - TANPA kolom database baru
    const prevHistory = await budgetRepository.findMonthlyHistory(userId, prevMonthStart);
    const prevSpent = prevHistory?.totalSpent || 0;
    const prevIncome = prevHistory?.totalIncome || 0;
    // Untuk limit & remaining bulan lalu, kita ambil dari snapshot history
    let prevPocketsSnapshot: any[] = [];
    if (prevHistory?.pocketsSnapshot) {
      try {
        prevPocketsSnapshot = typeof prevHistory.pocketsSnapshot === 'string'
          ? JSON.parse(prevHistory.pocketsSnapshot)
          : (Array.isArray(prevHistory.pocketsSnapshot) ? prevHistory.pocketsSnapshot : []);
      } catch { prevPocketsSnapshot = []; }
    }
    const prevLimit = prevPocketsSnapshot.reduce((acc: number, p: any) => acc + (p.limitAmount || 0), 0);
    const prevRemaining = prevLimit - prevSpent;
    const totalRemaining = totalLimit - totalSpent;

    // Helper: hitung persen MoM, null jika data bulan lalu tidak ada/nol
    const calcMom = (curr: number, prev: number) =>
      prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null;

    const momLimit = calcMom(totalLimit, prevLimit);
    const momSpent = calcMom(totalSpent, prevSpent);
    const momAdditionalIncome = calcMom(totalIncome, prevIncome);
    const momRemaining = prevRemaining !== 0 ? calcMom(totalRemaining, prevRemaining) : null;

    return {
      success: true,
      data: {
        salary: salary,
        month: startDate.toLocaleString("default", {
          month: "long",
          year: "numeric",
        }),
        totals: {
          limit: totalLimit,
          spent: totalSpent,
          additionalIncome: totalIncome,
          remaining: totalRemaining,
          unallocated: unallocated,
          // Perbandingan vs bulan lalu (null jika tidak ada data historis)
          mom: {
            limit: momLimit,
            spent: momSpent,
            additionalIncome: momAdditionalIncome,
            remaining: momRemaining,
          }
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
