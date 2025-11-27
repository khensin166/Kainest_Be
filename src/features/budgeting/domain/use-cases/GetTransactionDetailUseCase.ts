import { transactionRepository } from "../../data/TransactionRepository.js";

export const getTransactionDetailUseCase = async (transactionId: string, userId: string) => {
  try {
    // Cek apakah transaksi ada dan milik user tersebut
    const transaction = await transactionRepository.findTransactionById(transactionId, userId);

    if (!transaction) {
      return { success: false, status: 404, message: "Transaksi tidak ditemukan." };
    }

    return {
      success: true,
      data: transaction,
    };
  } catch (error) {
    console.error("Get Transaction Detail Error:", error);
    return { success: false, status: 500, message: "Gagal mengambil detail transaksi." };
  }
};