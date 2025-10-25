import { profileRepository } from '../../data/ProfileRepository.js'

type ProfileUpdateData = {
  name?: string;
  displayName?: string;
  avatarUrl?: string;
}

export const updateProfileUseCase = async (userId: string, data: ProfileUpdateData) => {
  // Filter data kosong jika ada
  const validData = Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== null && v !== undefined)
  );

  if (Object.keys(validData).length === 0) {
    return { success: false, message: 'No data provided for update' }
  }

  try {
    const updatedProfile = await profileRepository.updateProfileByUserId(userId, validData)
    return { success: true, profile: updatedProfile }
  } catch (error) {
    console.error(error)
    return { success: false, message: 'Failed to update profile' }
  }
}