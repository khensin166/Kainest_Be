import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
export class SplitBillSessionRepository {
    static async createSession(data) {
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
    static async getSessionById(id) {
        return await prisma.splitBillSession.findUnique({
            where: { id },
            include: {
                user: {
                    select: { name: true, profile: { select: { avatarUrl: true } } },
                },
            },
        });
    }
    static async getSessionsByUserId(userId) {
        return await prisma.splitBillSession.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
        });
    }
}
