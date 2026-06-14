import { budgetRepository } from "../../data/BudgetRepository.js";
/**
 * GetMonthlyHistoryUseCase
 * Mengambil semua riwayat keuangan bulanan milik user, diurutkan dari yang terbaru.
 */
export const getMonthlyHistoryUseCase = async (userId) => {
    try {
        const history = await budgetRepository.findAllMonthlyHistory(userId);
        return {
            success: true,
            data: history.map((item) => ({
                id: item.id,
                period: item.period,
                salarySnapshot: item.salarySnapshot,
                totalBudgeted: item.totalBudgeted,
                totalSaved: item.totalSaved,
                totalSpent: item.totalSpent,
                pocketsSnapshot: item.pocketsSnapshot,
                aiEvaluation: item.aiEvaluation ?? null,
                createdAt: item.createdAt,
            })),
        };
    }
    catch (error) {
        console.error("[GetMonthlyHistoryUseCase] Error:", error);
        return {
            success: false,
            status: 500,
            message: error.message || "Gagal mengambil riwayat keuangan.",
        };
    }
};
