// BudgetRepository.ts
import { prisma } from "../../../infrastructure/database/prisma.js";
export const budgetRepository = {
    /**
     * Cari Budget Limit user untuk kategori tertentu di bulan tertentu
     */
    async findBudgetLimit(userId, categoryId, monthDate) {
        // monthDate harus diset ke tanggal 1 bulan itu agar match database
        return prisma.budget.findFirst({
            where: {
                userId: userId,
                categoryId: categoryId,
                period: monthDate,
            },
            include: {
                category: true, // Kita butuh nama kategorinya nanti
            },
        });
    },
    async findUserById(userId) {
        return prisma.user.findUnique({
            where: { id: userId },
            select: { salary: true }
        });
    },
    async updateUserSalary(userId, salary) {
        return prisma.user.update({
            where: { id: userId },
            data: { salary }
        });
    },
    /**
     * Ambil semua kategori (untuk dropdown saat input transaksi)
     */
    async findAllCategories() {
        return prisma.budgetCategory.findMany({
            orderBy: { name: "asc" },
        });
    },
    async upsertBudget(userId, categoryId, period, amount, isAiAdjusted = false) {
        return prisma.budget.upsert({
            where: {
                userId_categoryId_period: {
                    // Compound unique key di schema
                    userId,
                    categoryId,
                    period,
                },
            },
            update: { amount_limit: amount, is_ai_adjusted: isAiAdjusted },
            create: {
                userId,
                categoryId,
                period,
                amount_limit: amount,
                is_ai_adjusted: isAiAdjusted,
            },
        });
    },
    /**
     * Menghapus budget untuk bulan tertentu yang kategorinya TIDAK ada dalam daftar.
     * Ini digunakan untuk sinkronisasi dengan Kantong (Pocket) agar data budget yang stale terhapus.
     */
    async deleteBudgetsNotInCategories(userId, period, keepCategoryIds) {
        return prisma.budget.deleteMany({
            where: {
                userId: userId,
                period: period,
                categoryId: {
                    notIn: keepCategoryIds
                }
            }
        });
    },
    /**
     * Ambil semua budget user di bulan tertentu
     * + Include kategori untuk nama & icon
     */
    async findBudgetsByMonth(userId, monthDate) {
        return prisma.budget.findMany({
            where: {
                userId: userId,
                period: monthDate,
            },
            include: {
                category: true,
            },
        });
    },
    /**
     * Mengambil Total Pengeluaran per Kategori dalam satu bulan (Bulk)
     * Menggunakan GroupBy agar efisien (1 query database)
     */
    async getMonthlyExpenseGrouped(userId, startDate, endDate) {
        return prisma.transaction.groupBy({
            by: ["categoryId"],
            _sum: {
                amount: true,
            },
            where: {
                userId: userId,
                date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
        });
    },
    /**
     * SEED: Membuat kategori default jika belum ada
     */
    async seedDefaultCategories() {
        const defaults = [
            { name: "Makan & Minum", type: "EXPENSE", icon: "🍔", isDefault: true },
            { name: "Transportasi", type: "EXPENSE", icon: "🚗", isDefault: true },
            {
                name: "Tempat Tinggal (Kos/Sewa)",
                type: "EXPENSE",
                icon: "🏠",
                isDefault: true,
            },
            { name: "Hiburan", type: "EXPENSE", icon: "🎬", isDefault: true },
            { name: "Belanja Bulanan", type: "EXPENSE", icon: "🛒", isDefault: true },
            {
                name: "Tabungan & Investasi",
                type: "EXPENSE",
                icon: "💰",
                isDefault: true,
            }, // Dianggap expense cashflow
        ];
        // Gunakan transaction agar atomic (masuk semua atau gagal semua)
        // createMany skipDuplicates hanya jalan di DB tertentu, kita pakai loop aman saja
        const results = [];
        for (const cat of defaults) {
            // Cek dulu biar gak duplikat
            const exists = await prisma.budgetCategory.findFirst({
                where: { name: cat.name },
            });
            if (!exists) {
                const newCat = await prisma.budgetCategory.create({
                    data: {
                        name: cat.name,
                        type: "EXPENSE", // Cast enum
                        icon: cat.icon,
                        isDefault: true,
                        // userId null artinya ini global category
                    },
                });
                results.push(newCat);
            }
        }
        return results;
    },
};
