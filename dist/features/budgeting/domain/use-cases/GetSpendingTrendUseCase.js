import { transactionRepository } from "../../data/TransactionRepository.js";
const aggregateByDate = (rawTrend) => {
    const aggregated = {};
    rawTrend.forEach(item => {
        const dateStr = item.date.toISOString().split('T')[0];
        if (!aggregated[dateStr])
            aggregated[dateStr] = 0;
        aggregated[dateStr] += (item._sum.amount || 0);
    });
    return Object.keys(aggregated).map(date => ({ date, total: aggregated[date] }));
};
export const getSpendingTrendUseCase = async (userId) => {
    try {
        // 1. Tentukan Range Tanggal Bulan Ini (Konsisten UTC)
        const now = new Date();
        const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
        const endDate = new Date(nextMonthStart.getTime() - 1);
        // 2. Fetch data expense dan income secara paralel
        const [rawExpense, rawIncome] = await Promise.all([
            transactionRepository.getDailyTrend(userId, startDate, endDate, "EXPENSE"),
            transactionRepository.getDailyTrend(userId, startDate, endDate, "INCOME"),
        ]);
        // 3. Agregasi masing-masing
        const expenseTrend = aggregateByDate(rawExpense);
        const incomeTrend = aggregateByDate(rawIncome);
        return {
            success: true,
            data: {
                month: startDate.toLocaleString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
                expenseTrend,
                incomeTrend,
            }
        };
    }
    catch (error) {
        console.error("Get Spending Trend Error:", error);
        return { success: false, status: 500, message: "Failed to get spending trend data" };
    }
};
