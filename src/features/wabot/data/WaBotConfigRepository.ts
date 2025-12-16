import { prisma } from "../../../infrastructure/database/prisma.js";

export const waBotConfigRepository = {
  /**
   * Menyimpan atau memperbarui konfigurasi bot
   */
  async upsertConfig(userId: string, baseUrl: string, adminSecret?: string) {
    return prisma.waBotConfig.upsert({
      where: { userId },
      update: {
        baseUrl,
        adminSecret,
      },
      create: {
        userId,
        baseUrl,
        adminSecret,
      },
    });
  },

  /**
   * Mengambil konfigurasi bot berdasarkan User ID
   */
  async getConfig(userId: string) {
    return prisma.waBotConfig.findUnique({
      where: { userId },
    });
  },
};
