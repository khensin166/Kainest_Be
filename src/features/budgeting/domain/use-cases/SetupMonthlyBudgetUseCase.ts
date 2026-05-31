import { budgetRepository } from "../../data/BudgetRepository.js";
import { pocketRepository } from "../../data/PocketRepository.js";

type SetupData = {
  userId: string;
  salary: number;
  rentAmount: number; // Biaya Kos/Cicilan tetap
  savingTargetPercent?: number; // Default 20%
};

export const setupMonthlyBudgetUseCase = async (data: SetupData) => {
  try {
    const { userId, salary, savingTargetPercent = 0.2 } = data;

    // 1. Simpan salary ke User
    await budgetRepository.updateUserSalary(userId, salary);

    const now = new Date();
    const period = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    let pocketsSnapshot: any[] = [];
    let totalBudgeted = 0;
    let totalSaved = 0;

    // 2. Buat otomatis kantong Tabungan jika ada
    if (savingTargetPercent > 0) {
      const categories = await budgetRepository.findAllCategories();
      const tabunganCategory = categories.find((c) => 
        c.name.toLowerCase().includes("tabungan") || c.name.toLowerCase().includes("saving")
      );

      if (tabunganCategory) {
        // Simpan sebagai template kantong permanen
        await pocketRepository.upsertPocket(userId, tabunganCategory.id, {
          percentage: savingTargetPercent * 100
        });

        const amountLimit = Math.floor(salary * savingTargetPercent);
        totalBudgeted += amountLimit;
        totalSaved += amountLimit;

        pocketsSnapshot.push({
          categoryId: tabunganCategory.id,
          categoryName: tabunganCategory.name,
          icon: tabunganCategory.icon || "💰",
          limitAmount: amountLimit
        });
      }
    }

    // Ambil histori lama jika ada (untuk tidak mereset totalSpent atau kantong lain jika bukan setup baru)
    const existingHistory = await budgetRepository.findMonthlyHistory(userId, period);
    
    // Jika sudah ada kantong lain di history, biarkan saja (jangan dioverwrite kecuali tabungan)
    if (existingHistory && Array.isArray(existingHistory.pocketsSnapshot)) {
        // Abaikan jika ini setup ulang yang kompleks, biarkan BulkSetup yang menangani kompleksitas
        // Ini hanya untuk initial setup
    } else {
        await budgetRepository.upsertMonthlyHistory(userId, period, {
            salarySnapshot: salary,
            totalBudgeted: totalBudgeted,
            totalSaved: totalSaved,
            pocketsSnapshot: pocketsSnapshot,
            totalSpent: existingHistory?.totalSpent || 0
        });
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
