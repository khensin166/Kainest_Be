import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM public."AISuggestion"`);
  console.log("COUNT:", result);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
