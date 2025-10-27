// src\features\profile\data\ProfileRepository.ts
import { prisma } from '../../../infrastructure/database/prisma.js'
import { generateInviteCode } from '../../../utils/stringUtils.js'

// Tipe data untuk update, semua opsional
type ProfileUpdateData = {
  name?: string; // Dari model User
  displayName?: string; // Dari model UserProfile
  avatarUrl?: string; // Dari model UserProfile
  phone_number?: string;
}

export const profileRepository = {
  /**
   * Mengambil data User beserta UserProfile.
   * Jika UserProfile belum ada (misal: user lama), buatkan satu.
   */
  async getProfileByUserId(userId: string) {
    let user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    })

    if (!user) return null

    // Fallback: Jika user ada tapi profil tidak (untuk user lama)
    if (user && !user.profile) {
      const inviteCode = generateInviteCode();
      const newProfile = await prisma.userProfile.create({
        data: {
          userId: userId,
          invitationCode: inviteCode
        }
      })
      // Gabungkan profil baru ke data user
      user.profile = newProfile
    }

    // Hapus password sebelum dikirim
    if (user.password) {
      delete (user as any).password
    }
    
    return user
  },

  /**
   * Update data User dan UserProfile dalam satu operasi.
   */
  async updateProfileByUserId(userId: string, data: ProfileUpdateData) {
    const { name, phone_number, ...profileData } = data

    // Gunakan nested write untuk update User dan UserProfile sekaligus
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name, // Update 'name' di model User
        phone_number: phone_number,
        profile: {
          // 'upsert' akan create jika tidak ada, atau update jika ada
          upsert: {
            where: { userId: userId },
            create: {
            //   userId: userId, // Diperlukan saat 'create'
              ...profileData
            },
            update: profileData // Update 'displayName' / 'avatarUrl'
          }
        }
      },
      include: {
        profile: true // Kembalikan data baru
      }
    })

    // Hapus password sebelum dikirim
    if (updatedUser.password) {
      delete (updatedUser as any).password
    }

    return updatedUser
  }
}