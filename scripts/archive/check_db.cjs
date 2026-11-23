const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const updates = await prisma.systemUpdate.findMany();
  console.log(JSON.stringify(updates, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
