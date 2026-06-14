import { transactionRepository } from "../../data/TransactionRepository.js";
import { budgetRepository } from "../../data/BudgetRepository.js";
export const createTransactionUseCase = async (data) => {
    if (!data.amount || data.amount <= 0) {
        return { success: false, status: 400, message: "Amount must be positive" };
    }
    if (!data.categoryId) {
        return { success: false, status: 400, message: "Category is required" };
    }
    try {
        const txDate = data.date ? new Date(data.date) : new Date();
        const newTx = await transactionRepository.createTransaction(data.userId, {
            amount: data.amount,
            categoryId: data.categoryId,
            note: data.note,
            date: txDate,
            type: (data.type === "INCOME" ? "INCOME" : "EXPENSE"),
        });
        // Write-Time Sync untuk riwayat bulanan
        await budgetRepository.syncMonthlyHistory(data.userId, txDate);
        return { success: true, data: newTx };
    }
    catch (error) {
        console.error("Create Transaction Error:", error);
        return { success: false, status: 500, message: "Failed to record transaction" };
    }
};
