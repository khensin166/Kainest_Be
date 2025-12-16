import { prisma } from '../../../infrastructure/database/prisma.js';

export class WaBotConfigRepository {
  async upsertConfig(userId: string, baseUrl: string, adminSecret?: string) {
    return prisma.waBotConfig.upsert({
      where: { userId },
      // Update jika data sudah ada
      update: { 
        baseUrl, 
        adminSecret 
      },
      // Buat baru jika belum ada
      create: { 
        userId, 
        baseUrl, 
        adminSecret 
      },
    });
  }

  async getConfig(userId: string) {
    return prisma.waBotConfig.findUnique({
      where: { userId },
    });
  }
}