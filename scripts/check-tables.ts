import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRawUnsafe(`SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('public', 'kainest') AND table_name ILIKE '%AISuggestion%'`);
  console.log("TABLES:", result);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
