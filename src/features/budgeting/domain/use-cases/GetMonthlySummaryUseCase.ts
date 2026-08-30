import { budgetRepository } from "../../data/BudgetRepository.js";
import { pocketRepository } from "../../data/PocketRepository.js";
import { getCycleBoundaries } from "../../../../utils/cycleBoundaries.js";
import { totalAlokasiBulanan } from "../../../plans/domain/savingService.js";

export const getMonthlySummaryUseCase = async (userId: string, payday?: number) => {
  try {
    const now = new Date();

    // 1. Ambil user jika payday tidak dikirimkan langsung
    const user = await budgetRepository.findUserById(userId);
    const salary = user?.salary || 0;
    const effectivePayday = payday ?? (user?.payday ?? 31);

    // 2. Hitung batas siklus berdasarkan payday user
    const { cycleStart, cycleEnd, prevCycleStart, prevCycleEnd, cycleLabel, dateRangeLabel, period, prevPeriod } =
      getCycleBoundaries(now, effectivePayday);

    // 3. Ambil History Bulanan (key: 1st of month dari cycleEnd, sesuai konvensi period)
    let history = await budgetRepository.findMonthlyHistory(userId, period);

    // 🔥 LAZY LOADING: Jika history siklus ini belum ada, buat otomatis
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

        const catDetail = categories.find((c) => c.id === p.categoryId);
        const isSaving =
          catDetail?.name.toLowerCase().includes("tabungan") ||
          catDetail?.name.toLowerCase().includes("saving");

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

      history = await budgetRepository.upsertMonthlyHistory(userId, period, {
        salarySnapshot: salary,
        totalBudgeted: totalBudgeted,
        totalSaved: totalSaved,
        pocketsSnapshot: newPocketsSnapshot,
        totalSpent: 0,
      });
    }

    let pocketsSnapshot: any[] = [];
    if (history && history.pocketsSnapshot) {
      if (typeof history.pocketsSnapshot === "string") {
        try {
          pocketsSnapshot = JSON.parse(history.pocketsSnapshot);
        } catch (e) {
          pocketsSnapshot = [];
        }
      } else if (Array.isArray(history.pocketsSnapshot)) {
        pocketsSnapshot = history.pocketsSnapshot;
      }
    }

    // 4. Ambil Realisasi Pengeluaran berdasarkan rentang siklus aktif (bukan awal/akhir bulan)
    const expenses = await budgetRepository.getMonthlyExpenseGrouped(userId, cycleStart, cycleEnd);

    // 5. Gabungkan Data (Merge Snapshot + Expense)
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
        status: remaining < 0 ? "OVERBUDGET" : percentage > 80 ? "WARNING" : "SAFE",
      };
    });

    // 6. Hitung Total Keseluruhan
    const totalLimit = summary.reduce((acc, curr) => acc + curr.limit, 0);
    const totalSpent = summary.reduce((acc, curr) => acc + curr.spent, 0);
    const totalIncome = history?.totalIncome || 0;
    const unallocatedMentah = Math.max(0, salary - totalLimit);

    // 🆕 Alokasi wishlist tabungan ikut memakan gaji, sama seperti limit kantong.
    // Tanpa dikurangkan, dashboard memberi tahu pengguna ada uang bebas yang
    // sebenarnya sudah dijanjikan — di aplikasi keuangan itu bukan bug kosmetik.
    // Lihat doc/rencana_tabungan_tagihan.md §6.
    const alokasiWishlist = await totalAlokasiBulanan(userId);
    const unallocated = Math.max(0, unallocatedMentah - alokasiWishlist);

    // 7. Kalkulasi MoM (Month-over-Month) berdasarkan period siklus sebelumnya
    const prevHistory = await budgetRepository.findMonthlyHistory(userId, prevPeriod);
    const prevSpent = prevHistory?.totalSpent || 0;
    const prevIncome = prevHistory?.totalIncome || 0;
    let prevPocketsSnapshot: any[] = [];
    if (prevHistory?.pocketsSnapshot) {
      try {
        prevPocketsSnapshot =
          typeof prevHistory.pocketsSnapshot === "string"
            ? JSON.parse(prevHistory.pocketsSnapshot)
            : Array.isArray(prevHistory.pocketsSnapshot)
            ? prevHistory.pocketsSnapshot
            : [];
      } catch {
        prevPocketsSnapshot = [];
      }
    }
    const prevLimit = prevPocketsSnapshot.reduce((acc: number, p: any) => acc + (p.limitAmount || 0), 0);
    const prevRemaining = prevLimit - prevSpent;
    const totalRemaining = totalLimit - totalSpent;

    const calcMom = (curr: number, prev: number) =>
      prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null;

    return {
      success: true,
      data: {
        salary: salary,
        payday: effectivePayday, // 🆕 Dikirim ke frontend agar BudgetSetupModal bisa pre-fill nilai yang benar
        // Label teks bulan (untuk kompatibilitas frontend yang sudah ada)
        month: cycleLabel,
        // 🆕 Metadata siklus untuk informasi di frontend
        cycle: {
          label: cycleLabel,           // misal: "Agustus 2026"
          dateRange: dateRangeLabel,   // misal: "25 Jul - 24 Agu"
          startDate: cycleStart.toISOString(),
          endDate: cycleEnd.toISOString(),
        },
        totals: {
          limit: totalLimit,
          spent: totalSpent,
          additionalIncome: totalIncome,
          remaining: totalRemaining,
          unallocated: unallocated,
          // Total yang sudah dijanjikan ke wishlist tabungan pada siklus ini.
          savingAllocation: alokasiWishlist,
          mom: {
            limit: calcMom(totalLimit, prevLimit),
            spent: calcMom(totalSpent, prevSpent),
            additionalIncome: calcMom(totalIncome, prevIncome),
            remaining: prevRemaining !== 0 ? calcMom(totalRemaining, prevRemaining) : null,
          },
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
