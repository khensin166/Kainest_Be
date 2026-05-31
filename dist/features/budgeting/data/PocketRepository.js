// PocketRepository.ts
import { prisma } from "../../../infrastructure/database/prisma.js";
export const pocketRepository = {
    /**
     * Ambil semua kantong milik user, beserta data kategori-nya
     */
    async findPocketsByUser(userId) {
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
    async upsertPocket(userId, categoryId, data) {
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
    async deletePocket(userId, categoryId) {
        return prisma.budgetPocket.delete({
            where: {
                userId_categoryId: { userId, categoryId },
            },
        });
    },
    /**
     * Bulk upsert kantong dari array (untuk setup awal)
     */
    async bulkUpsertPockets(userId, pockets) {
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
    async findPocketsForClassification(userId) {
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
    async updateCategoryKeywords(categoryId, keywords) {
        return prisma.budgetCategory.update({
            where: { id: categoryId },
            data: { keywords },
        });
    },
};
