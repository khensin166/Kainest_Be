import { transactionRepository } from "../../data/TransactionRepository.js";
import { budgetRepository } from "../../data/BudgetRepository.js";
import { TransactionType } from "@prisma/client";
import { checkSolvencyAlert } from "./CheckSolvencyUseCase.js";

type InputData = {
  userId: string;
  amount: number;
  categoryId: string;
  note?: string;
  date?: string; // string dari JSON (ISO 8601)
  type?: "INCOME" | "EXPENSE"; // 🆕 Default EXPENSE jika tidak disertakan
};

export const createTransactionUseCase = async (data: InputData) => {
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
      type: (data.type === "INCOME" ? "INCOME" : "EXPENSE") as TransactionType,
    });

    // Write-Time Sync untuk riwayat bulanan
    await budgetRepository.syncMonthlyHistory(data.userId, txDate);

    // Cek Solvabilitas jika tipe transaksi adalah PENGELUARAN
    if (newTx.type === "EXPENSE") {
      // Jalankan asinkronus agar tidak memblokir response
      checkSolvencyAlert(data.userId).catch(err => console.error("Solvency Alert Error:", err));
    }

    return { success: true, data: newTx };
  } catch (error) {
    console.error("Create Transaction Error:", error);
    return { success: false, status: 500, message: "Failed to record transaction" };
  }
};