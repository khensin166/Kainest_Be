import { transactionRepository } from "../../data/TransactionRepository.js";

export const getSpendingTrendUseCase = async (userId: string) => {
  try {
    // 1. Tentukan Range Tanggal Bulan Ini (Konsisten UTC)
    // Ini penting agar cocok dengan data yang disimpan di Vercel/Supabase
    const now = new Date();
    const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const endDate = new Date(nextMonthStart.getTime() - 1); // Akhir bulan jam 23:59:59.999 UTC

    // 2. Ambil Data Agregasi dari Repository
    // Database hanya mengembalikan tanggal yang ADA transaksinya.
    // Tanggal yang tidak ada transaksi tidak akan muncul di sini.
    const rawTrend = await transactionRepository.getDailyTrend(userId, startDate, endDate);

    // 3. Format Hasil agar lebih bersih sebelum dikirim ke frontend
    // Agregasi (Group by string YYYY-MM-DD) agar transaksi di hari yang sama terjumlah
    const aggregatedTrend: Record<string, number> = {};
    rawTrend.forEach(item => {
      const dateStr = item.date.toISOString().split('T')[0];
      if (!aggregatedTrend[dateStr]) {
        aggregatedTrend[dateStr] = 0;
      }
      aggregatedTrend[dateStr] += (item._sum.amount || 0);
    });

    const formattedTrend = Object.keys(aggregatedTrend).map(date => ({
      date,
      totalSpent: aggregatedTrend[date]
    }));

    return {
      success: true,
      data: {
        month: startDate.toLocaleString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
        trend: formattedTrend
      }
    };

  } catch (error) {
    console.error("Get Spending Trend Error:", error);
    return { success: false, status: 500, message: "Failed to get spending trend data" };
  }
};