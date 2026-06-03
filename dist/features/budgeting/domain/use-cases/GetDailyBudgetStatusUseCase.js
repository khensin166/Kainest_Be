import { budgetRepository } from "../../data/BudgetRepository.js";
import { transactionRepository } from "../../data/TransactionRepository.js";
/**
 * Helper untuk menghitung tanggal
 */
const getMonthDates = () => {
    const now = new Date();
    // Gunakan UTC agar seragam dengan GetMonthlySummary
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const endOfMonth = new Date(nextMonthStart.getTime() - 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const daysLeft = daysInMonth - currentDay + 1; // +1 biar hari ini dihitung
    return { startOfMonth, endOfMonth, daysInMonth, daysLeft };
};
export const getDailyBudgetStatusUseCase = async (userId, categoryId) => {
    try {
        const { startOfMonth, endOfMonth, daysInMonth, daysLeft } = getMonthDates();
        // 1. Ambil Limit Budget dari History
        const history = await budgetRepository.findMonthlyHistory(userId, startOfMonth);
        let limit = 0;
        let categoryName = "Kategori";
        if (history && history.pocketsSnapshot) {
            let pockets = [];
            if (typeof history.pocketsSnapshot === 'string') {
                try {
                    pockets = JSON.parse(history.pocketsSnapshot);
                }
                catch (e) { }
            }
            else if (Array.isArray(history.pocketsSnapshot)) {
                pockets = history.pocketsSnapshot;
            }
            const pocket = pockets.find(p => p.categoryId === categoryId);
            if (pocket) {
                limit = pocket.limitAmount || 0;
                categoryName = pocket.categoryName || categoryName;
            }
        }
        // Jika user belum set budget, kita tidak bisa hitung zona
        if (limit <= 0) {
            return {
                success: true,
                data: null,
                message: "No budget set for this category"
            };
        }
        // 2. Hitung Total Terpakai
        const spent = await transactionRepository.sumExpenseByCategory(userId, categoryId, startOfMonth, endOfMonth);
        // 3. Logic Hitungan Kenin
        const remaining = limit - spent;
        // Hitung rata-rata ideal (Baseline)
        // Contoh: Limit 1.5jt / 30 hari = 50rb/hari
        const initialDailyBudget = limit / daysInMonth;
        // Hitung kemampuan riil saat ini (Adaptive)
        // Contoh: Sisa 500rb / 10 hari = 50rb/hari
        const currentDailySafe = remaining > 0 ? (remaining / daysLeft) : 0;
        // 4. Tentukan ZONA (Ratio Logic)
        // Ratio = Kemampuan Hari Ini / Kemampuan Ideal Awal
        const ratio = currentDailySafe / initialDailyBudget;
        let zone = "GREEN";
        let message = "Aman! Pengeluaranmu terkendali.";
        if (remaining <= 0) {
            zone = "OVERSPENT";
            message = "Kamu sudah overbudget bulan ini.";
        }
        else if (ratio < 0.5) {
            // Kemampuan tinggal 50% dari ideal
            zone = "RED";
            message = "Bahaya. Budget menipis, harus super hemat.";
        }
        else if (ratio < 0.85) {
            // Kemampuan tinggal 85% dari ideal
            zone = "YELLOW";
            message = "Waspada. Mulai kurangi jajan ya.";
        }
        return {
            success: true,
            data: {
                category: categoryName,
                limit_month: limit,
                spent_so_far: spent,
                remaining: remaining,
                days_left: daysLeft,
                // Data Penting untuk UI
                daily_safe_spend: Math.floor(currentDailySafe),
                zone: zone, // GREEN | YELLOW | RED | OVERSPENT
                recommendation_text: message
            }
        };
    }
    catch (error) {
        console.error("Get Budget Status Error:", error);
        return { success: false, status: 500, message: "Failed to calculate budget status" };
    }
};
