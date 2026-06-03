import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: "khensin166@gmail.com" }
    });

    if (user) {
      await prisma.waBotConfig.upsert({
        where: { userId: user.id },
        update: { botPhoneNumber: "628999999999" },
        create: {
          userId: user.id,
          baseUrl: "http://localhost:5678", // dummy
          botPhoneNumber: "628999999999"
        }
      });
      console.log("Config seeded for", user.email);
    }
  } catch (error) {
    console.error("Failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
