import { prisma } from "../../../infrastructure/database/prisma.js";
import { Prisma } from "@prisma/client";

type CreateTransactionData = {
  amount: number;
  note?: string;
  date: Date;
  categoryId: string;
};

export const transactionRepository = {
  /**
   * Catat transaksi baru
   */
  async createTransaction(userId: string, data: CreateTransactionData) {
    return prisma.transaction.create({
      data: {
        amount: data.amount,
        note: data.note,
        date: data.date,
        categoryId: data.categoryId,
        userId: userId,
      },
    });
  },

  /**
   * Menghitung TOTAL pengeluaran user per kategori di bulan tertentu
   * Ini vital untuk logic "Sisa Budget"
   */
  async sumExpenseByCategory(
    userId: string,
    categoryId: string,
    startDate: Date,
    endDate: Date
  ) {
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

  async getDailyTrend(userId: string, startDate: Date, endDate: Date) {
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

  async findTransactions({
    userId,
    startDate,
    endDate,
    skip,
    take,
  }: {
    userId: string;
    startDate?: Date; // Opsional
    endDate?: Date; // Opsional
    skip: number;
    take: number;
  }) {
    // 1. Bangun kondisi WHERE secara dinamis
    const whereClause: any = {
      userId: userId,
    };

    // Jika ada filter tanggal, tambahkan ke kondisi WHERE
    if (startDate && endDate) {
      whereClause.date = {
        gte: startDate,
        lte: endDate,
      };
    }

    // 2. Jalankan query findMany (data) dan count (total) secara paralel
    const [transactions, totalCount] = await prisma.$transaction([
      prisma.transaction.findMany({
        where: whereClause,
        skip: skip, // Loncat sekian data (offset)
        take: take, // Ambil sekian data (limit)
        orderBy: {
          date: "desc", // Urutkan dari yang paling baru
        },
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
  async findTransactionById(id: string, userId: string) {
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
  async updateTransaction(
    id: string,
    data: { amount?: number; categoryId?: string; note?: string; date?: Date }
  ) {
    return prisma.transaction.update({
      where: { id: id },
      data: data,
      include: { category: true },
    });
  },

  /**
   * BARU: Hapus transaksi
   */
  async deleteTransaction(id: string) {
    return prisma.transaction.delete({
      where: { id: id },
    });
  },
};
