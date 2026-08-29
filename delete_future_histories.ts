import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const currentPeriod = new Date(Date.UTC(2026, 7, 1)); // August 2026
  console.log(`Menghapus MonthlyFinancialHistory yang memiliki period > ${currentPeriod.toISOString()}`);
  
  const result = await prisma.monthlyFinancialHistory.deleteMany({
    where: {
      period: {
        gt: currentPeriod
      }
    }
  });

  console.log(`Berhasil menghapus ${result.count} data riwayat masa depan.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
