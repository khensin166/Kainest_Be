import { coupleRepository } from '../../data/CoupleRepository.js';
export const getCoupleStatusUseCase = async (userId) => {
    const couple = await coupleRepository.findCoupleByUserId(userId);
    if (!couple) {
        return { success: true, connected: false, data: null };
    }
    // Format data agar lebih rapi untuk frontend
    const partner = couple.user1Id === userId ? couple.user2 : couple.user1;
    const response = {
        coupleId: couple.id,
        partner: {
            id: partner.id,
            name: partner.name,
            displayName: partner.profile?.displayName,
            avatarUrl: partner.profile?.avatarUrl
        },
        createdAt: couple.createdAt
    };
    return { success: true, connected: true, data: response };
};
