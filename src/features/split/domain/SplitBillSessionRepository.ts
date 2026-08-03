import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class SplitBillSessionRepository {
  static async createSession(data: {
    userId: string;
    totalAmount: number;
    splitData: any;
    summaryText: string;
    merchant?: string;
  }) {
    return await prisma.splitBillSession.create({
      data: {
        userId: data.userId,
        totalAmount: data.totalAmount,
        splitData: data.splitData,
        summaryText: data.summaryText,
        merchant: data.merchant,
      },
    });
  }

  static async getSessionById(id: string) {
    return await prisma.splitBillSession.findUnique({
      where: { id },
      include: {
        user: {
          select: { name: true, profile: { select: { avatarUrl: true } } },
        },
      },
    });
  }

  static async getSessionsByUserId(userId: string) {
    return await prisma.splitBillSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }
}
