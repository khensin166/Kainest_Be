import { profileRepository } from '../../data/ProfileRepository.js';
export const getProfileUseCase = async (userId) => {
    const profile = await profileRepository.getProfileByUserId(userId);
    if (!profile) {
        return { success: false, message: 'Profile not found' };
    }
    return { success: true, profile };
};
