import { transactionRepository } from "../../data/TransactionRepository.js";
import { budgetRepository } from "../../data/BudgetRepository.js";
export const updateTransactionUseCase = async (transactionId, userId, input) => {
    try {
        // 1. Cek dulu apakah transaksi ini milik user yang sedang login
        const existingTransaction = await transactionRepository.findTransactionById(transactionId, userId);
        if (!existingTransaction) {
            return { success: false, status: 404, message: "Transaksi tidak ditemukan atau bukan milik Anda." };
        }
        // 2. Siapkan data update
        const updateData = {};
        if (input.amount)
            updateData.amount = input.amount;
        if (input.categoryId)
            updateData.categoryId = input.categoryId;
        if (input.note !== undefined)
            updateData.note = input.note; // Note bisa diupdate jadi kosong string
        if (input.date) {
            // Pastikan tanggal diupdate dengan format UTC yang benar
            updateData.date = new Date(`${input.date}T00:00:00Z`);
            if (isNaN(updateData.date.getTime()))
                return { success: false, status: 400, message: "Format tanggal salah." };
        }
        // 3. Lakukan update di database
        const updatedTransaction = await transactionRepository.updateTransaction(transactionId, updateData);
        // 4. Smart Trigger: Write-Time Sync untuk riwayat bulanan
        // Hanya sync jika amount, categoryId, atau date berubah
        let needsHistorySync = false;
        if (updateData.amount !== undefined && updateData.amount !== existingTransaction.amount)
            needsHistorySync = true;
        if (updateData.categoryId !== undefined && updateData.categoryId !== existingTransaction.categoryId)
            needsHistorySync = true;
        if (updateData.date !== undefined && updateData.date.getTime() !== existingTransaction.date.getTime())
            needsHistorySync = true;
        if (needsHistorySync) {
            const oldDate = existingTransaction.date;
            const newDate = updatedTransaction.date;
            const oldMonth = oldDate.getUTCMonth();
            const oldYear = oldDate.getUTCFullYear();
            const newMonth = newDate.getUTCMonth();
            const newYear = newDate.getUTCFullYear();
            // Sinkronisasi bulan baru (atau bulan yang sama)
            await budgetRepository.syncMonthlyHistory(userId, newDate);
            // Jika pindah bulan, sinkronisasi juga bulan lama
            if (oldMonth !== newMonth || oldYear !== newYear) {
                await budgetRepository.syncMonthlyHistory(userId, oldDate);
            }
        }
        return {
            success: true,
            message: "Transaksi berhasil diupdate.",
            data: updatedTransaction,
        };
    }
    catch (error) {
        console.error("Update Transaction Error:", error);
        return { success: false, status: 500, message: "Gagal mengupdate transaksi." };
    }
};
