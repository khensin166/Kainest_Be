import { budgetRepository } from "../../data/BudgetRepository.js";
import { transactionRepository } from "../../data/TransactionRepository.js";

/**
 * Helper untuk menghitung tanggal
 */
const getMonthDates = () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysInMonth = endOfMonth.getDate();
  const currentDay = now.getDate();
  const daysLeft = daysInMonth - currentDay + 1; // +1 biar hari ini dihitung
  
  return { startOfMonth, endOfMonth, daysInMonth, daysLeft };
};

export const getDailyBudgetStatusUseCase = async (userId: string, categoryId: string) => {
  try {
    const { startOfMonth, endOfMonth, daysInMonth, daysLeft } = getMonthDates();

    // 1. Ambil Limit Budget
    const budget = await budgetRepository.findBudgetLimit(userId, categoryId, startOfMonth);
    
    // Jika user belum set budget, kita tidak bisa hitung zona
    if (!budget) {
      return { 
        success: true, 
        data: null, 
        message: "No budget set for this category" 
      };
    }

    const limit = budget.amount_limit;

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
    } else if (ratio < 0.5) {
      // Kemampuan tinggal 50% dari ideal
      zone = "RED"; 
      message = "Bahaya. Budget menipis, harus super hemat.";
    } else if (ratio < 0.85) {
      // Kemampuan tinggal 85% dari ideal
      zone = "YELLOW";
      message = "Waspada. Mulai kurangi jajan ya.";
    }

    return {
      success: true,
      data: {
        category: budget.category.name,
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

  } catch (error) {
    console.error("Get Budget Status Error:", error);
    return { success: false, status: 500, message: "Failed to calculate budget status" };
  }
};