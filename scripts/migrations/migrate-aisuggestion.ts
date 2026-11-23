import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("Migrating missing rows from public to kainest...");
  
  // Insert data from public to kainest, ignore if ID already exists OR if userId does not exist
  await prisma.$executeRawUnsafe(`
    INSERT INTO kainest."AISuggestion" ("id", "userId", "type", "suggestion_text", "is_approved", "createdAt")
    SELECT p."id", p."userId", p."type", p."suggestion_text", p."is_approved", p."createdAt"
    FROM public."AISuggestion" p
    INNER JOIN kainest."User" u ON p."userId"::text = u."id"::text
    ON CONFLICT ("id") DO NOTHING;
  `);
  
  console.log("Dropping public table...");
  await prisma.$executeRawUnsafe(`DROP TABLE public."AISuggestion" CASCADE;`);
  
  console.log("Creating View in public...");
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE VIEW public."AISuggestion" AS
    SELECT * FROM kainest."AISuggestion";
  `);
  
  console.log("Done!");
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
