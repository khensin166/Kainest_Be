import { prisma } from "../../../infrastructure/database/prisma.js";

export class AdminRepository {
  /**
   * Mengambil daftar semua user beserta profil mereka
   */
  async getAllUsers() {
    return prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        role: true,
        banned: true,
        permissions: true,
        profile: {
          select: {
            avatarUrl: true,
            displayName: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    });
  }

  /**
   * Mengupdate role, status banned, atau permissions user
   */
  async updateUserAccess(userId: string, data: { role?: string, banned?: boolean, permissions?: string[] }) {
    return prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        role: true,
        banned: true,
        permissions: true
      }
    });
  }

  /**
   * Mengambil data lengkap user yang dibutuhkan untuk proses reset bulanan
   */
  async getUserForReset(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        payday: true,
        waBotConfig: {
          select: {
            baseUrl: true,
          }
        },
        botActiveGroups: {
          select: {
            groupId: true,
          }
        }
      }
    });
  }
}
