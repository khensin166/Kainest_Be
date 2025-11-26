import { budgetRepository } from "../../data/BudgetRepository.js";

export const getMonthlySummaryUseCase = async (userId: string) => {
  try {
    // 1. Tentukan Range Tanggal (Bulan Ini)
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // 2. Ambil Semua Budget User Bulan Ini
    const budgets = await budgetRepository.findBudgetsByMonth(userId, startDate);

    // 3. Ambil Realisasi Pengeluaran (Group By Category)
    // Hasil: [{ categoryId: 'xxx', _sum: { amount: 50000 } }, ...]
    const expenses = await budgetRepository.getMonthlyExpenseGrouped(userId, startDate, endDate);

    // 4. Gabungkan Data (Merge Budget + Expense)
    const summary = budgets.map(budget => {
      // Cari pengeluaran yang cocok dengan kategori ini
      const expense = expenses.find(e => e.categoryId === budget.categoryId);
      const spent = expense?._sum.amount || 0;
      const remaining = budget.amount_limit - spent;
      const percentage = Math.min((spent / budget.amount_limit) * 100, 100);

      return {
        categoryId: budget.categoryId,
        categoryName: budget.category.name,
        icon: budget.category.icon,
        limit: budget.amount_limit,
        spent: spent,
        remaining: remaining,
        percentage_used: Math.round(percentage),
        status: remaining < 0 ? 'OVERBUDGET' : (percentage > 80 ? 'WARNING' : 'SAFE')
      };
    });

    // 5. Hitung Total Keseluruhan
    const totalLimit = summary.reduce((acc, curr) => acc + curr.limit, 0);
    const totalSpent = summary.reduce((acc, curr) => acc + curr.spent, 0);

    return {
      success: true,
      data: {
        month: startDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
        totals: {
          limit: totalLimit,
          spent: totalSpent,
          remaining: totalLimit - totalSpent
        },
        categories: summary
      }
    };

  } catch (error) {
    console.error("Get Summary Error:", error);
    return { success: false, status: 500, message: "Failed to get monthly summary" };
  }
};