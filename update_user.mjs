import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    const updatedUser = await prisma.user.update({
      where: { email: "khensin166@gmail.com" },
      data: { whatsappJid: "172662131298437" }
    });
    console.log("Success updated user:", updatedUser.email, "with whatsappJid:", updatedUser.whatsappJid);
  } catch (error) {
    console.error("Failed to update user:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
