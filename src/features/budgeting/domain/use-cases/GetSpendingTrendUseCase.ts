import { transactionRepository } from "../../data/TransactionRepository.js";
import { getCycleBoundaries } from "../../../../utils/cycleBoundaries.js";

const aggregateByDate = (rawTrend: any[]): { date: string; total: number }[] => {
  const aggregated: Record<string, number> = {};
  rawTrend.forEach((item) => {
    const dateStr = item.date.toISOString().split("T")[0];
    if (!aggregated[dateStr]) aggregated[dateStr] = 0;
    aggregated[dateStr] += item._sum.amount || 0;
  });
  return Object.keys(aggregated).map((date) => ({ date, total: aggregated[date] }));
};

export const getSpendingTrendUseCase = async (userId: string, payday?: number) => {
  try {
    const now = new Date();
    const effectivePayday = payday ?? 31;

    // Gunakan siklus payday, bukan awal/akhir bulan kalender
    const { cycleStart, cycleEnd, cycleLabel, dateRangeLabel } = getCycleBoundaries(now, effectivePayday);

    // Fetch data expense dan income secara paralel dalam rentang siklus
    const [rawExpense, rawIncome] = await Promise.all([
      transactionRepository.getDailyTrend(userId, cycleStart, cycleEnd, "EXPENSE"),
      transactionRepository.getDailyTrend(userId, cycleStart, cycleEnd, "INCOME"),
    ]);

    const expenseTrend = aggregateByDate(rawExpense);
    const incomeTrend = aggregateByDate(rawIncome);

    return {
      success: true,
      data: {
        month: cycleLabel,
        cycle: {
          label: cycleLabel,
          dateRange: dateRangeLabel,
          startDate: cycleStart.toISOString(),
          endDate: cycleEnd.toISOString(),
        },
        expenseTrend,
        incomeTrend,
      },
    };
  } catch (error) {
    console.error("Get Spending Trend Error:", error);
    return { success: false, status: 500, message: "Failed to get spending trend data" };
  }
};