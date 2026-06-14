import { prisma } from "../infrastructure/database/prisma.js";

async function main() {
  console.log("Memulai migrasi keywords dari BudgetCategory ke BudgetPocket...");

  // 1. Ambil semua pocket yang belum memiliki keywords (meskipun sekarang defaultnya [])
  // Untuk amannya, kita bisa update semua pocket yang array keywords-nya masih kosong,
  // ATAU update semua pocket sekalian dengan keywords dari category saat ini.
  const allPockets = await prisma.budgetPocket.findMany({
    include: { category: true }
  });

  console.log(`Ditemukan ${allPockets.length} kantong (pocket).`);

  let updatedCount = 0;

  for (const pocket of allPockets) {
    if (!pocket.keywords || pocket.keywords.length === 0) {
      const categoryKeywords = pocket.category?.keywords || [];
      if (categoryKeywords.length > 0) {
        await prisma.budgetPocket.update({
          where: { id: pocket.id },
          data: { keywords: categoryKeywords }
        });
        updatedCount++;
      }
    }
  }

  console.log(`Migrasi selesai! ${updatedCount} kantong berhasil di-backfill dengan keywords dari kategori.`);
}

main()
  .catch((e) => {
    console.error("Terjadi error saat migrasi:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
