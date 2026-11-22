import { prisma } from "../../../infrastructure/database/prisma.js";
export const billRepository = {
    /** Tagihan milik user, terbaru dulu. Kategori disertakan untuk label kantong. */
    async findByUser(userId, status) {
        return prisma.recurringBill.findMany({
            where: { userId, ...(status ? { status } : {}) },
            include: { category: true },
            orderBy: [{ status: "asc" }, { dueDay: "asc" }],
        });
    },
    async findById(billId) {
        return prisma.recurringBill.findUnique({
            where: { id: billId },
            include: { category: true },
        });
    },
    async create(userId, data) {
        return prisma.recurringBill.create({
            data: { ...data, userId },
            include: { category: true },
        });
    },
    async update(billId, data) {
        return prisma.recurringBill.update({
            where: { id: billId },
            data,
            include: { category: true },
        });
    },
    async remove(billId) {
        return prisma.recurringBill.delete({ where: { id: billId } });
    },
    /** Pelunasan/pelewatan untuk sekumpulan tagihan pada satu siklus. */
    async findPayments(billIds, period) {
        if (billIds.length === 0)
            return [];
        return prisma.billPayment.findMany({
            where: { billId: { in: billIds }, period },
        });
    },
    async findPayment(billId, period) {
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
    async pay(params) {
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
                    ...(params.selesaikanTenor ? { status: "COMPLETED" } : {}),
                },
                include: { category: true },
            });
            return { transaksi, pelunasan, tagihan };
        });
    },
    /** Melewati tagihan: tercatat, tetapi TANPA Transaction sehingga budget utuh. */
    async skip(billId, userId, period) {
        return prisma.billPayment.create({
            data: { billId, userId, period, status: "SKIPPED" },
        });
    },
    /**
     * Membatalkan pelunasan siklus ini: hapus BillPayment, hapus Transaction
     * terkait, dan turunkan angsuran. Satu transaksi database, alasan yang sama
     * seperti pay().
     */
    async cancelPayment(billId, period) {
        return prisma.$transaction(async (tx) => {
            const pelunasan = await tx.billPayment.findUnique({
                where: { billId_period: { billId, period } },
            });
            if (!pelunasan)
                return null;
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
