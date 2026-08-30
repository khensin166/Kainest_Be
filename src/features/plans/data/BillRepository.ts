import { prisma } from "../../../infrastructure/database/prisma.js";
import type { BillFrequency, BillStatus } from "@prisma/client";

export type BillInput = {
  categoryId: string;
  name: string;
  amount: number;
  frequency: BillFrequency;
  dueDay: number;
  dueMonth?: number | null;
  startDate: Date;
  totalInstallments?: number | null;
  reminderDaysBefore?: number;
  note?: string | null;
};

export const billRepository = {
  /** Tagihan milik user, terbaru dulu. Kategori disertakan untuk label kantong. */
  async findByUser(userId: string, status?: BillStatus) {
    return prisma.recurringBill.findMany({
      where: { userId, ...(status ? { status } : {}) },
      include: { category: true },
      orderBy: [{ status: "asc" }, { dueDay: "asc" }],
    });
  },

  async findById(billId: string) {
    return prisma.recurringBill.findUnique({
      where: { id: billId },
      include: { category: true },
    });
  },

  async create(userId: string, data: BillInput) {
    return prisma.recurringBill.create({
      data: { ...data, userId },
      include: { category: true },
    });
  },

  async update(billId: string, data: Partial<BillInput>) {
    return prisma.recurringBill.update({
      where: { id: billId },
      data,
      include: { category: true },
    });
  },

  async remove(billId: string) {
    return prisma.recurringBill.delete({ where: { id: billId } });
  },

  /** Pelunasan/pelewatan untuk sekumpulan tagihan pada satu siklus. */
  async findPayments(billIds: string[], period: Date) {
    if (billIds.length === 0) return [];
    return prisma.billPayment.findMany({
      where: { billId: { in: billIds }, period },
    });
  },

  async findPayment(billId: string, period: Date) {
    return prisma.billPayment.findUnique({
      where: { billId_period: { billId, period } },
    });
  },

  /**
   * Melunasi tagihan: membuat Transaction dan BillPayment dalam SATU transaksi
   * database, lalu menaikkan angsuran.
   *
   * Dibungkus $transaction karena tiga tulisan ini harus berhasil bersama.
   * Tanpa itu, kegagalan di tengah bisa meninggalkan pengeluaran yang tercatat
   * tanpa tagihannya ikut lunas — pengguna melihat uangnya berkurang sementara
   * tagihannya masih menagih.
   */
  async pay(params: {
    billId: string;
    userId: string;
    categoryId: string;
    period: Date;
    amount: number;
    date: Date;
    note: string;
    installmentNo: number | null;
    /** Menjadi COMPLETED bila angsuran ini menutup tenor. */
    selesaikanTenor: boolean;
  }) {
    return prisma.$transaction(async (tx) => {
      const transaksi = await tx.transaction.create({
        data: {
          amount: params.amount,
          note: params.note,
          date: params.date,
          categoryId: params.categoryId,
          userId: params.userId,
          type: "EXPENSE",
        },
        include: { category: true },
      });

      const pelunasan = await tx.billPayment.create({
        data: {
          billId: params.billId,
          userId: params.userId,
          period: params.period,
          status: "PAID",
          installmentNo: params.installmentNo,
          paidAmount: params.amount,
          transactionId: transaksi.id,
        },
      });

      const tagihan = await tx.recurringBill.update({
        where: { id: params.billId },
        data: {
          paidInstallments: { increment: 1 },
          ...(params.selesaikanTenor ? { status: "COMPLETED" as BillStatus } : {}),
        },
        include: { category: true },
      });

      return { transaksi, pelunasan, tagihan };
    });
  },

  /** Melewati tagihan: tercatat, tetapi TANPA Transaction sehingga budget utuh. */
  async skip(billId: string, userId: string, period: Date) {
    return prisma.billPayment.create({
      data: { billId, userId, period, status: "SKIPPED" },
    });
  },

  /**
   * Membatalkan pelunasan siklus ini: hapus BillPayment, hapus Transaction
   * terkait, dan turunkan angsuran. Satu transaksi database, alasan yang sama
   * seperti pay().
   */
  async cancelPayment(billId: string, period: Date) {
    return prisma.$transaction(async (tx) => {
      const pelunasan = await tx.billPayment.findUnique({
        where: { billId_period: { billId, period } },
      });
      if (!pelunasan) return null;

      await tx.billPayment.delete({ where: { id: pelunasan.id } });
      if (pelunasan.transactionId) {
        await tx.transaction.delete({ where: { id: pelunasan.transactionId } });
      }

      // Hanya PAID yang pernah menaikkan angsuran; SKIPPED tidak.
      if (pelunasan.status === "PAID") {
        await tx.recurringBill.update({
          where: { id: billId },
          data: {
            paidInstallments: { decrement: 1 },
            status: "ACTIVE", // tenor terbuka lagi bila sebelumnya COMPLETED
          },
        });
      }
      return pelunasan;
    });
  },
};
