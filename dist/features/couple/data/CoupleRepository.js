import { prisma } from '../../../infrastructure/database/prisma.js';
export const coupleRepository = {
    /**
     * Cari data Couple berdasarkan ID salah satu user
     */
    async findCoupleByUserId(userId) {
        return await prisma.couple.findFirst({
            where: {
                OR: [
                    { user1Id: userId },
                    { user2Id: userId }
                ]
            },
            // Sertakan data pasangan Anda
            include: {
                user1: { select: { id: true, name: true, profile: { select: { displayName: true, avatarUrl: true } } } },
                user2: { select: { id: true, name: true, profile: { select: { displayName: true, avatarUrl: true } } } }
            }
        });
    },
    /**
     * Cari User (dan profilnya) berdasarkan invitationCode
     */
    async findUserByInviteCode(code) {
        return await prisma.userProfile.findUnique({
            where: { invitationCode: code },
            include: { user: true } // Ambil data User yang terhubung
        });
    },
    /**
     * Buat entri Couple baru
     */
    async createCouple(user1Id, user2Id) {
        return await prisma.couple.create({
            data: {
                user1Id: user1Id,
                user2Id: user2Id
            }
        });
    }
};
