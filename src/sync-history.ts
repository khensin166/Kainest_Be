import { prisma } from "./infrastructure/database/prisma.js";
import { budgetRepository } from "./features/budgeting/data/BudgetRepository.js";

async function main() {
  console.log("🔍 Memulai sinkronisasi data riwayat bulanan...");

  // Ambil semua transaksi unik berdasarkan userId dan bulan
  const transactions = await prisma.transaction.findMany({
    select: {
      userId: true,
      date: true,
    },
  });

  if (transactions.length === 0) {
    console.log("ℹ️ Tidak ditemukan transaksi di database. Silakan insert data terlebih dahulu.");
    return;
  }

  const uniqueSyncPairs = new Map<string, { userId: string; period: Date }>();

  for (const tx of transactions) {
    const date = new Date(tx.date);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const key = `${tx.userId}_${year}_${month}`;

    if (!uniqueSyncPairs.has(key)) {
      // Periode di DB adalah tanggal 1 UTC untuk bulan tersebut
      const startOfMonth = new Date(Date.UTC(year, month, 1));
      uniqueSyncPairs.set(key, { userId: tx.userId, period: startOfMonth });
      console.log(`📌 Target sinkronisasi ditemukan: User ID = ${tx.userId} | Periode = ${year}-${(month + 1).toString().padStart(2, "0")}`);
    }
  }

  console.log(`🔄 Menjalankan sinkronisasi untuk ${uniqueSyncPairs.size} periode...`);

  for (const [_, pair] of uniqueSyncPairs.entries()) {
    await budgetRepository.syncMonthlyHistory(pair.userId, pair.period);
  }

  console.log("✅ Semua data riwayat bulanan berhasil disinkronisasi!");
}

main()
  .catch((e) => {
    console.error("❌ Terjadi kesalahan saat sinkronisasi:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
