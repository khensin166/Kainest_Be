import { budgetRepository } from "../../data/BudgetRepository.js";
import { pocketRepository } from "../../data/PocketRepository.js";

type SetupData = {
  userId: string;
  salary: number;
  rentAmount: number; // Biaya Kos/Cicilan tetap
};

export const setupMonthlyBudgetUseCase = async (data: SetupData) => {
  try {
    const { userId, salary } = data;

    // 1. Simpan salary ke User
    await budgetRepository.updateUserSalary(userId, salary);

    const now = new Date();
    const period = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    // Ambil histori lama jika ada (untuk tidak mereset totalSpent atau kantong lain jika bukan setup baru)
    const existingHistory = await budgetRepository.findMonthlyHistory(userId, period);
    
    // Jika sudah ada kantong lain di history, biarkan saja (jangan dioverwrite kecuali tabungan)
    if (existingHistory && Array.isArray(existingHistory.pocketsSnapshot)) {
        // Abaikan jika ini setup ulang yang kompleks, biarkan BulkSetup yang menangani kompleksitas
        // Ini hanya untuk initial setup
    } else {
        await budgetRepository.upsertMonthlyHistory(userId, period, {
            salarySnapshot: salary,
            totalBudgeted: 0,
            totalSaved: existingHistory?.totalSaved || 0,
            pocketsSnapshot: [],
            totalSpent: existingHistory?.totalSpent || 0
        });
        
        await budgetRepository.syncMonthlyHistory(userId, period);
    }

    return {
      success: true,
      message: "Salary and savings setup successfully.",
      data: {
        salary
      },
    };
  } catch (error) {
    console.error("Setup Budget Error:", error);
    return { success: false, status: 500, message: "Failed to setup salary" };
  }
};
