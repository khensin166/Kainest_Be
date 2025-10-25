import { coupleRepository } from '../../data/CoupleRepository.js'

export const connectCoupleUseCase = async (currentUserId: string, invitationCode: string) => {
  // 1. Validasi input
  if (!invitationCode) {
    return { success: false, message: 'Invitation code is required' }
  }

  // 2. Cari target user berdasarkan kodenya
  const targetProfile = await coupleRepository.findUserByInviteCode(invitationCode)
  if (!targetProfile) {
    return { success: false, message: 'Invalid invitation code' }
  }
  const targetUser = targetProfile.user

  // 3. Cek tidak menghubungkan ke diri sendiri
  if (targetUser.id === currentUserId) {
    return { success: false, message: "You cannot connect with yourself" }
  }

  // 4. Cek apakah user saat ini sudah punya pasangan
  const currentUserCouple = await coupleRepository.findCoupleByUserId(currentUserId)
  if (currentUserCouple) {
    return { success: false, message: 'You are already connected to a partner' }
  }

  // 5. Cek apakah target user sudah punya pasangan
  const targetUserCouple = await coupleRepository.findCoupleByUserId(targetUser.id)
  if (targetUserCouple) {
    return { success: false, message: 'This user is already connected to another partner' }
  }

  // 6. Buat koneksi!
  try {
    const newCouple = await coupleRepository.createCouple(currentUserId, targetUser.id)
    return { success: true, data: newCouple }
  } catch (error) {
    console.error(error)
    return { success: false, message: 'Failed to create connection' }
  }
}