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
      }
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
}
