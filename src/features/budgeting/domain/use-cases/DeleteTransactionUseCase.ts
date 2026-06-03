import { transactionRepository } from "../../data/TransactionRepository.js";
import { budgetRepository } from "../../data/BudgetRepository.js";

export const deleteTransactionUseCase = async (transactionId: string, userId: string) => {
  try {
    // 1. Cek kepemilikan sebelum hapus
    const existingTransaction = await transactionRepository.findTransactionById(transactionId, userId);
    if (!existingTransaction) {
      return { success: false, status: 404, message: "Transaksi tidak ditemukan." };
    }

    // 2. Hapus dari database
    await transactionRepository.deleteTransaction(transactionId);

    // 3. Write-Time Sync untuk riwayat bulanan
    await budgetRepository.syncMonthlyHistory(userId, existingTransaction.date);

    return {
      success: true,
      message: "Transaksi berhasil dihapus.",
    };

  } catch (error) {
    console.error("Delete Transaction Error:", error);
    return { success: false, status: 500, message: "Gagal menghapus transaksi." };
  }
};