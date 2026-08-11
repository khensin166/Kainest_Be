import { transactionRepository } from "../../data/TransactionRepository.js";
import { getCycleBoundaries } from "../../../../utils/cycleBoundaries.js";

interface GetTransactionsInput {
  userId: string;
  page?: string;       // Query param selalu string
  limit?: string;      // Query param selalu string
  startDate?: string;  // Format YYYY-MM-DD — jika tidak dikirim, default ke cycleStart
  endDate?: string;    // Format YYYY-MM-DD — jika tidak dikirim, default ke cycleEnd
  search?: string;
  type?: "INCOME" | "EXPENSE" | "ALL";
  payday?: number;     // Dari profil user, diteruskan oleh controller
  scope?: "cycle" | "all"; // "cycle" = siklus aktif, "all" = semua transaksi
}

export const getTransactionsUseCase = async (input: GetTransactionsInput) => {
  try {
    // 1. Normalisasi Input Pagination
    const page = Number(input.page) || 1;
    const take = Number(input.limit) || 20;
    const skip = (page - 1) * take;

    // 2. Tentukan batas tanggal
    let filterStartDate: Date | undefined;
    let filterEndDate: Date | undefined;
    let cycleLabel: string | undefined;
    let dateRangeLabel: string | undefined;

    if (input.scope === "all") {
      // Mode All Time: tidak ada filter tanggal → semua 514+ transaksi
      filterStartDate = undefined;
      filterEndDate = undefined;
    } else if (input.startDate && input.endDate) {
      // Frontend mengirimkan filter tanggal eksplisit (misal: filter bulan tertentu di halaman Rekap)
      filterStartDate = new Date(`${input.startDate}T00:00:00Z`);
      filterEndDate = new Date(`${input.endDate}T23:59:59.999Z`);

      if (isNaN(filterStartDate.getTime()) || isNaN(filterEndDate.getTime())) {
        return { success: false, status: 400, message: "Format tanggal tidak valid (gunakan YYYY-MM-DD)." };
      }
    } else {
      // Tidak ada filter eksplisit → default ke siklus payday aktif
      const effectivePayday = input.payday ?? 31;
      const cycle = getCycleBoundaries(new Date(), effectivePayday);
      filterStartDate = cycle.cycleStart;
      filterEndDate = cycle.cycleEnd;
      cycleLabel = cycle.cycleLabel;
      dateRangeLabel = cycle.dateRangeLabel;
    }

    // 3. Panggil Repository
    const { data, total } = await transactionRepository.findTransactions({
      userId: input.userId,
      startDate: filterStartDate,
      endDate: filterEndDate,
      search: input.search,
      type: input.type,
      skip,
      take,
    });

    // 4. Hitung Metadata Pagination
    const totalPages = Math.ceil(total / take);

    // 5. Format Output — sertakan info siklus jika default (tidak ada filter eksplisit)
    return {
      success: true,
      data: data,
      meta: {
        totalItems: total,
        totalPages: totalPages,
        currentPage: page,
        itemsPerPage: take,
        // 🆕 Metadata siklus (hanya muncul jika tidak ada filter tanggal eksplisit)
        ...(cycleLabel && {
          cycle: {
            label: cycleLabel,
            dateRange: dateRangeLabel,
            startDate: filterStartDate?.toISOString(),
            endDate: filterEndDate?.toISOString(),
          },
        }),
      },
    };
  } catch (error) {
    console.error("Get Transactions Error:", error);
    return { success: false, status: 500, message: "Gagal mengambil daftar transaksi." };
  }
};