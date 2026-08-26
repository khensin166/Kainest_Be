import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const suggestions = await prisma.aISuggestion.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(JSON.stringify(suggestions, null, 2));
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
