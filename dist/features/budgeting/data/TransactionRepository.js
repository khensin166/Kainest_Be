// TransactionRepository.ts
import { prisma } from "../../../infrastructure/database/prisma.js";
export const transactionRepository = {
    /**
     * Catat transaksi baru
     */
    async createTransaction(userId, data) {
        return prisma.transaction.create({
            data: {
                amount: data.amount,
                note: data.note,
                date: data.date,
                categoryId: data.categoryId,
                userId: userId,
                type: data.type || "EXPENSE", // 🆕 default EXPENSE aman untuk data lama
            },
            include: { category: true },
        });
    },
    /**
     * Menghitung TOTAL pengeluaran user per kategori di bulan tertentu
     * Ini vital untuk logic "Sisa Budget"
     */
    async sumExpenseByCategory(userId, categoryId, startDate, endDate) {
        const aggregate = await prisma.transaction.aggregate({
            _sum: {
                amount: true,
            },
            where: {
                userId: userId,
                categoryId: categoryId,
                date: {
                    gte: startDate, // Awal bulan
                    lte: endDate, // Akhir bulan/hari ini
                },
            },
        });
        return aggregate._sum.amount || 0;
    },
    async getDailyTrend(userId, startDate, endDate) {
        return prisma.transaction.groupBy({
            by: ["date"], // Kelompokkan berdasarkan kolom tanggal
            _sum: {
                amount: true, // Jumlahkan kolom amount
            },
            where: {
                userId: userId,
                date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            orderBy: {
                date: "asc", // Urutkan dari tanggal awal bulan
            },
        });
    },
    async findTransactions({ userId, startDate, endDate, search, type, skip, take, }) {
        // 1. Bangun kondisi WHERE secara dinamis
        const whereClause = {
            userId: userId,
        };
        // Jika ada filter tanggal, tambahkan ke kondisi WHERE
        if (startDate && endDate) {
            whereClause.date = {
                gte: startDate,
                lte: endDate,
            };
        }
        if (type && type !== "ALL") {
            whereClause.type = type;
        }
        // Filter Search (Case Insensitive)
        // Mencari di kolom 'note' ATAU nama 'category'
        if (search) {
            whereClause.OR = [
                {
                    note: {
                        contains: search,
                        mode: "insensitive", // PostgreSQL only: makes search case-insensitive
                    },
                },
                {
                    category: {
                        name: {
                            contains: search,
                            mode: "insensitive",
                        },
                    },
                },
            ];
        }
        // 2. Jalankan query findMany (data) dan count (total) secara paralel
        const [transactions, totalCount] = await prisma.$transaction([
            prisma.transaction.findMany({
                where: whereClause,
                skip: skip, // Loncat sekian data (offset)
                take: take, // Ambil sekian data (limit)
                orderBy: { createdAt: "desc" }, // Murni urut berdasarkan waktu input ke sistem
                // Include data kategori agar di UI bisa tampil ikon dan namanya
                include: {
                    category: {
                        select: { id: true, name: true, icon: true, type: true },
                    },
                },
            }),
            prisma.transaction.count({
                where: whereClause,
            }),
        ]);
        return {
            data: transactions,
            total: totalCount,
        };
    },
    /**
     * BARU: Mencari satu transaksi berdasarkan ID dan User ID (untuk keamanan)
     */
    async findTransactionById(id, userId) {
        return prisma.transaction.findFirst({
            where: {
                id: id,
                userId: userId, // Pastikan user hanya bisa lihat transaksinya sendiri
            },
            include: {
                category: true, // Include kategori untuk data lengkap
            },
        });
    },
    /**
     * BARU: Update data transaksi
     */
    async updateTransaction(id, data) {
        return prisma.transaction.update({
            where: { id: id },
            data: data,
            include: { category: true },
        });
    },
    /**
     * BARU: Hapus transaksi
     */
    async deleteTransaction(id) {
        return prisma.transaction.delete({
            where: { id: id },
        });
    },
};
