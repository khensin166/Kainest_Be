import { transactionRepository } from "../../data/TransactionRepository.js";

interface GetTransactionsInput {
  userId: string;
  page?: string;     // Query param selalu string
  limit?: string;    // Query param selalu string
  startDate?: string; // Format YYYY-MM-DD
  endDate?: string;   // Format YYYY-MM-DD
}

export const getTransactionsUseCase = async (input: GetTransactionsInput) => {
  try {
    // 1. Normalisasi Input Pagination
    const page = Number(input.page) || 1; // Default page 1
    const take = Number(input.limit) || 20; // Default limit 20 item per halaman
    const skip = (page - 1) * take; // Hitung offset

    // 2. Normalisasi Input Tanggal (Filter)
    let filterStartDate: Date | undefined;
    let filterEndDate: Date | undefined;

    // Jika user mengirim filter tanggal, ubah string "YYYY-MM-DD" jadi Date UTC
    // Kita asumsikan frontend mengirim tanggal saja (tanpa jam)
    if (input.startDate && input.endDate) {
      // Tambahkan jam 00:00:00 UTC untuk start date
      filterStartDate = new Date(`${input.startDate}T00:00:00Z`);
      // Tambahkan jam 23:59:59 UTC untuk end date agar mencakup seluruh hari itu
      filterEndDate = new Date(`${input.endDate}T23:59:59.999Z`);

      // Validasi sederhana jika tanggal tidak valid
      if (isNaN(filterStartDate.getTime()) || isNaN(filterEndDate.getTime())) {
         return { success: false, status: 400, message: "Format tanggal tidak valid (gunakan YYYY-MM-DD)." };
      }
    }

    // 3. Panggil Repository
    const { data, total } = await transactionRepository.findTransactions({
      userId: input.userId,
      startDate: filterStartDate,
      endDate: filterEndDate,
      skip,
      take,
    });

    // 4. Hitung Metadata Pagination
    const totalPages = Math.ceil(total / take);

    // 5. Format Output
    return {
      success: true,
      data: data, // Array transaksi
      meta: {     // Informasi tambahan untuk frontend
        totalItems: total,
        totalPages: totalPages,
        currentPage: page,
        itemsPerPage: take,
      }
    };

  } catch (error) {
    console.error("Get Transactions Error:", error);
    return { success: false, status: 500, message: "Gagal mengambil daftar transaksi." };
  }
};