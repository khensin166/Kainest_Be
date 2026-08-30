import { prisma } from "../../../infrastructure/database/prisma.js";
import type { ContributionSource, SavingGoalStatus } from "@prisma/client";

export type GoalInput = {
  name: string;
  targetAmount: number;
  monthlyAllocation?: number;
  targetDate?: Date | null;
  icon?: string | null;
};

export const savingGoalRepository = {
  async findByUser(userId: string, status?: SavingGoalStatus) {
    return prisma.savingGoal.findMany({
      where: { userId, ...(status ? { status } : {}) },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
  },

  async findById(goalId: string) {
    return prisma.savingGoal.findUnique({ where: { id: goalId } });
  },

  async create(userId: string, data: GoalInput) {
    return prisma.savingGoal.create({ data: { ...data, userId } });
  },

  async update(goalId: string, data: Partial<GoalInput> & { status?: SavingGoalStatus }) {
    return prisma.savingGoal.update({ where: { id: goalId }, data });
  },

  async remove(goalId: string) {
    return prisma.savingGoal.delete({ where: { id: goalId } });
  },

  /** Total terkumpul per wishlist. Penarikan bernilai negatif ikut terjumlah. */
  async sumByGoal(goalIds: string[]) {
    if (goalIds.length === 0) return new Map<string, number>();
    const baris = await prisma.savingContribution.groupBy({
      by: ["goalId"],
      where: { goalId: { in: goalIds } },
      _sum: { amount: true },
    });
    return new Map(baris.map((b) => [b.goalId, b._sum.amount ?? 0]));
  },

  /** Setoran per wishlist pada satu siklus — dipakai penjaga solvabilitas. */
  async sumByGoalForPeriod(goalIds: string[], period: Date) {
    if (goalIds.length === 0) return new Map<string, number>();
    const baris = await prisma.savingContribution.groupBy({
      by: ["goalId"],
      where: { goalId: { in: goalIds }, period },
      _sum: { amount: true },
    });
    return new Map(baris.map((b) => [b.goalId, b._sum.amount ?? 0]));
  },

  async contributions(goalId: string, take = 50) {
    return prisma.savingContribution.findMany({
      where: { goalId },
      orderBy: { date: "desc" },
      take,
    });
  },

  async addContribution(params: {
    goalId: string;
    userId: string;
    amount: number;
    source: ContributionSource;
    note?: string | null;
    date: Date;
    period: Date;
  }) {
    return prisma.savingContribution.create({ data: params });
  },

  /** Bulan pertama setoran, untuk menghitung laju menabung. */
  async firstContributionDate(goalId: string) {
    const baris = await prisma.savingContribution.findFirst({
      where: { goalId },
      orderBy: { date: "asc" },
      select: { date: true },
    });
    return baris?.date ?? null;
  },
};
