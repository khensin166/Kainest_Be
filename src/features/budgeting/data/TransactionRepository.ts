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
  async sumExpenseByCategory(userId: string, categoryId: string, startDate: Date, endDate: Date) {
    const aggregate = await prisma.transaction.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        userId: userId,
        categoryId: categoryId,
        date: {
          gte: startDate, // Awal bulan
          lte: endDate,   // Akhir bulan/hari ini
        },
      },
    });

    return aggregate._sum.amount || 0;
  },

  /**
   * Ambil history transaksi (untuk list di UI)
   */
  async findTransactions(userId: string, limit = 10) {
    return prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: limit,
      include: {
        category: {
          select: { name: true, icon: true }
        }
      }
    });
  }
};