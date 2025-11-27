import { transactionRepository } from "../../data/TransactionRepository.js";

interface UpdateInput {
  amount?: number;
  categoryId?: string;
  note?: string;
  date?: string; // Format YYYY-MM-DD
}

export const updateTransactionUseCase = async (transactionId: string, userId: string, input: UpdateInput) => {
  try {
    // 1. Cek dulu apakah transaksi ini milik user yang sedang login
    const existingTransaction = await transactionRepository.findTransactionById(transactionId, userId);
    if (!existingTransaction) {
      return { success: false, status: 404, message: "Transaksi tidak ditemukan atau bukan milik Anda." };
    }

    // 2. Siapkan data update
    const updateData: any = {};
    if (input.amount) updateData.amount = input.amount;
    if (input.categoryId) updateData.categoryId = input.categoryId;
    if (input.note !== undefined) updateData.note = input.note; // Note bisa diupdate jadi kosong string
    if (input.date) {
       // Pastikan tanggal diupdate dengan format UTC yang benar
       updateData.date = new Date(`${input.date}T00:00:00Z`);
       if (isNaN(updateData.date.getTime())) return { success: false, status: 400, message: "Format tanggal salah." };
    }

    // 3. Lakukan update di database
    const updatedTransaction = await transactionRepository.updateTransaction(transactionId, updateData);

    return {
      success: true,
      message: "Transaksi berhasil diupdate.",
      data: updatedTransaction,
    };

  } catch (error) {
    console.error("Update Transaction Error:", error);
    return { success: false, status: 500, message: "Gagal mengupdate transaksi." };
  }
};