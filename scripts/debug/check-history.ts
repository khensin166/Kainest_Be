import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const history = await prisma.monthlyFinancialHistory.findMany({
    where: { userId: 'qu4k76pZXH5ncDB4GW8R3dUhXVXIZmvB' },
    orderBy: { period: 'desc' }
  });
  console.log(JSON.stringify(history, null, 2));
}

main().finally(() => prisma.$disconnect());
