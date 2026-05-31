// SetupMonthlyBudgetUseCase.ts
import { budgetRepository } from "../../data/BudgetRepository.js";
export const setupMonthlyBudgetUseCase = async (data) => {
    try {
        const { userId, salary } = data;
        // Hanya menyimpan salary ke User
        await budgetRepository.updateUserSalary(userId, salary);
        return {
            success: true,
            message: "Salary saved successfully. Please setup your pockets.",
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
