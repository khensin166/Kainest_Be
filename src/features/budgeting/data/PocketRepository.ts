// PocketRepository.ts
import { prisma } from "../../../infrastructure/database/prisma.js";

export const pocketRepository = {
  /**
   * Ambil semua kantong milik user, beserta data kategori-nya
   */
  async findPocketsByUser(userId: string) {
    return prisma.budgetPocket.findMany({
      where: { userId },
      include: {
        category: true, // Sertakan nama, icon, keywords
      },
      orderBy: { category: { name: "asc" } },
    });
  },

  /**
   * Buat atau update kantong user untuk kategori tertentu (Upsert)
   */
  async upsertPocket(
    userId: string,
    categoryId: string,
    data: { percentage?: number | null; limitAmount?: number | null }
  ) {
    return prisma.budgetPocket.upsert({
      where: {
        userId_categoryId: { userId, categoryId },
      },
      update: {
        percentage: data.percentage,
        limitAmount: data.limitAmount,
      },
      create: {
        userId,
        categoryId,
        percentage: data.percentage,
        limitAmount: data.limitAmount,
      },
      include: { category: true },
    });
  },

  /**
   * Hapus kantong user (jika user tidak ingin kategori itu lagi)
   */
  async deletePocket(userId: string, categoryId: string) {
    return prisma.budgetPocket.delete({
      where: {
        userId_categoryId: { userId, categoryId },
      },
    });
  },

  /**
   * Bulk upsert kantong dari array (untuk setup awal)
   */
  async bulkUpsertPockets(
    userId: string,
    pockets: Array<{
      categoryId: string;
      percentage?: number | null;
      limitAmount?: number | null;
    }>
  ) {
    // 1. Dapatkan daftar categoryId yang ada di payload baru
    const categoryIds = pockets.map((p) => p.categoryId);

    // 2. Hapus semua kantong user yang TIDAK ADA di payload
    // Ini penting agar jika user mengganti/menghapus kantong, data lama tidak menjadi zombie
    if (categoryIds.length > 0) {
      await prisma.budgetPocket.deleteMany({
        where: {
          userId,
          categoryId: { notIn: categoryIds },
        },
      });
    }

    // 3. Upsert sisanya
    const results = [];
    for (const pocket of pockets) {
      const result = await prisma.budgetPocket.upsert({
        where: {
          userId_categoryId: { userId, categoryId: pocket.categoryId },
        },
        update: {
          percentage: pocket.percentage,
          limitAmount: pocket.limitAmount,
        },
        create: {
          userId,
          categoryId: pocket.categoryId,
          percentage: pocket.percentage,
          limitAmount: pocket.limitAmount,
        },
        include: { category: true },
      });
      results.push(result);
    }
    return results;
  },

  /**
   * Ambil semua kantong user BESERTA keywords kategori
   * (Digunakan saat klasifikasi AI / Grok)
   */
  async findPocketsForClassification(userId: string) {
    return prisma.budgetPocket.findMany({
      where: { userId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            keywords: true,
          },
        },
      },
    });
  },

  /**
   * Update keywords pada kategori tertentu
   */
  async updateCategoryKeywords(categoryId: string, keywords: string[]) {
    return prisma.budgetCategory.update({
      where: { id: categoryId },
      data: { keywords },
    });
  },
};
