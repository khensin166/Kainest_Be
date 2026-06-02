import { prisma } from "../../../infrastructure/database/prisma.js";

export const botTransactionRepository = {
  /**
   * Cek apakah grup terdaftar di BotActiveGroup
   */
  async getActiveGroup(groupId: string) {
    return prisma.botActiveGroup.findUnique({
      where: { groupId },
    });
  },

  /**
   * Cari user berdasarkan nomor telepon (exact match atau contains)
   */
  async getUserByPhoneNumber(phoneNumber: string) {
    // Kita coba exact match dulu
    let user = await prisma.user.findUnique({
      where: { phone_number: phoneNumber },
    });

    if (!user) {
      // Coba cari dengan LIKE pattern (contoh: nomor di db '08123', dari bot '628123')
      // Untuk sederhananya kita cari user yang phone_number-nya diakhiri dengan nomor belakang sender
      // Asumsi minimal 9 digit yang dicocokkan (menghilangkan kode negara)
      const phoneTail = phoneNumber.length > 9 ? phoneNumber.slice(-9) : phoneNumber;
      
      user = await prisma.user.findFirst({
        where: {
          phone_number: {
            endsWith: phoneTail,
          },
        },
      });
    }

    return user;
  },
};
