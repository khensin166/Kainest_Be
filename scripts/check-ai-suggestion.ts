import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.aISuggestion.findMany({
    where: { userId: 'qu4k76pZXH5ncDB4GW8R3dUhXVXIZmvB' },
    orderBy: { createdAt: 'desc' },
    take: 1
  });
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
