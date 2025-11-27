import { transactionRepository } from "../../data/TransactionRepository.js";

export const deleteTransactionUseCase = async (transactionId: string, userId: string) => {
  try {
    // 1. Cek kepemilikan sebelum hapus
    const existingTransaction = await transactionRepository.findTransactionById(transactionId, userId);
    if (!existingTransaction) {
      return { success: false, status: 404, message: "Transaksi tidak ditemukan." };
    }

    // 2. Hapus dari database
    await transactionRepository.deleteTransaction(transactionId);

    return {
      success: true,
      message: "Transaksi berhasil dihapus.",
    };

  } catch (error) {
    console.error("Delete Transaction Error:", error);
    return { success: false, status: 500, message: "Gagal menghapus transaksi." };
  }
};