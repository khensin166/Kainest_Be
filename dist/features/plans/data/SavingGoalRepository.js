import { prisma } from "../../../infrastructure/database/prisma.js";
export const savingGoalRepository = {
    async findByUser(userId, status) {
        return prisma.savingGoal.findMany({
            where: { userId, ...(status ? { status } : {}) },
            orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        });
    },
    async findById(goalId) {
        return prisma.savingGoal.findUnique({ where: { id: goalId } });
    },
    async create(userId, data) {
        return prisma.savingGoal.create({ data: { ...data, userId } });
    },
    async update(goalId, data) {
        return prisma.savingGoal.update({ where: { id: goalId }, data });
    },
    async remove(goalId) {
        return prisma.savingGoal.delete({ where: { id: goalId } });
    },
    /** Total terkumpul per wishlist. Penarikan bernilai negatif ikut terjumlah. */
    async sumByGoal(goalIds) {
        if (goalIds.length === 0)
            return new Map();
        const baris = await prisma.savingContribution.groupBy({
            by: ["goalId"],
            where: { goalId: { in: goalIds } },
            _sum: { amount: true },
        });
        return new Map(baris.map((b) => [b.goalId, b._sum.amount ?? 0]));
    },
    /** Setoran per wishlist pada satu siklus — dipakai penjaga solvabilitas. */
    async sumByGoalForPeriod(goalIds, period) {
        if (goalIds.length === 0)
            return new Map();
        const baris = await prisma.savingContribution.groupBy({
            by: ["goalId"],
            where: { goalId: { in: goalIds }, period },
            _sum: { amount: true },
        });
        return new Map(baris.map((b) => [b.goalId, b._sum.amount ?? 0]));
    },
    async contributions(goalId, take = 50) {
        return prisma.savingContribution.findMany({
            where: { goalId },
            orderBy: { date: "desc" },
            take,
        });
    },
    async addContribution(params) {
        return prisma.savingContribution.create({ data: params });
    },
    /** Bulan pertama setoran, untuk menghitung laju menabung. */
    async firstContributionDate(goalId) {
        const baris = await prisma.savingContribution.findFirst({
            where: { goalId },
            orderBy: { date: "asc" },
            select: { date: true },
        });
        return baris?.date ?? null;
    },
};
