import { budgetRepository } from "../../data/BudgetRepository.js";
import { pocketRepository } from "../../data/PocketRepository.js";
export const setupMonthlyBudgetUseCase = async (data) => {
    try {
        const { userId, salary, savingTargetPercent = 0.2 } = data;
        // 1. Simpan salary ke User
        await budgetRepository.updateUserSalary(userId, salary);
        // 2. Buat otomatis kantong Tabungan jika ada
        if (savingTargetPercent > 0) {
            const categories = await budgetRepository.findAllCategories();
            const idTabungan = categories.find((c) => c.name.toLowerCase().includes("tabungan") || c.name.toLowerCase().includes("saving"))?.id;
            if (idTabungan) {
                // Simpan sebagai template kantong permanen
                await pocketRepository.upsertPocket(userId, idTabungan, {
                    percentage: savingTargetPercent * 100
                });
                // Simpan sebagai budget untuk bulan berjalan
                const now = new Date();
                const period = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
                const amountLimit = Math.floor(salary * savingTargetPercent);
                await budgetRepository.upsertBudget(userId, idTabungan, period, amountLimit, false);
            }
        }
        return {
            success: true,
            message: "Salary and savings setup successfully.",
            data: {
                salary
            },
        };
    }
    catch (error) {
        console.error("Setup Budget Error:", error);
        return { success: false, status: 500, message: "Failed to setup salary" };
    }
};
