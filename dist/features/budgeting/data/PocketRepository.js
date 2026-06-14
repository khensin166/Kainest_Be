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
        const category = await prisma.budgetCategory.findUnique({
            where: { id: categoryId },
            select: { keywords: true },
        });
        const defaultKeywords = category?.keywords || [];
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
                keywords: defaultKeywords,
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
        const categoryIds = pockets.map((p) => p.categoryId);
        if (categoryIds.length > 0) {
            await prisma.budgetPocket.deleteMany({
                where: {
                    userId,
                    categoryId: { notIn: categoryIds },
                },
            });
        }
        const categories = await prisma.budgetCategory.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, keywords: true },
        });
        const categoryKeywordsMap = new Map(categories.map((c) => [c.id, c.keywords]));
        const results = [];
        for (const pocket of pockets) {
            const defaultKeywords = categoryKeywordsMap.get(pocket.categoryId) || [];
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
                    keywords: defaultKeywords,
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
     * Update keywords pada kantong tertentu
     */
    async updatePocketKeywords(userId, categoryId, keywords) {
        return prisma.budgetPocket.update({
            where: { userId_categoryId: { userId, categoryId } },
            data: { keywords },
        });
    },
};
