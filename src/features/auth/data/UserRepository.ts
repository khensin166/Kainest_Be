// Impor klien prisma, bukan supabase
import { prisma } from '../../../infrastructure/database/prisma.js'
// Ganti tipe 'user' jika perlu, sesuaikan dengan model Prisma Anda
import { User } from '@prisma/client' 
import { generateInviteCode } from '../../../utils/stringUtils.js'

export const userRepository = {
  async findByEmail(email: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
      })
      return user // Akan null jika tidak ditemukan
    } catch (error) {
      console.error(error)
      return null
    }
  },

  // GANTI FUNGSI 'CREATE' ANDA DENGAN INI
  async create(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'name' | 'phone_number' | 'shifts' | 'logs' | 'todos' | 'photos' | 'profile' | 'couples1' | 'couples2'>) { 
    try {
      // Buat kode undangan unik
      const inviteCode = generateInviteCode();

      const user = await prisma.user.create({
        data: {
          ...userData, // Ini akan menyertakan email & password
          
          // Secara otomatis buat UserProfile yang terhubung
          profile: {
            create: {
              invitationCode: inviteCode,
            }
          }
        },
        // Kembalikan user beserta profil yang baru dibuat
        include: {
          profile: true
        }
      })
      return user
    } catch (error) {
      console.error(error)
      throw error 
    }
  },

  async findById(id: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        // Pilih data yang ingin dikembalikan
        // PENTING: JANGAN sertakan 'password'
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true
          // Tambahkan field lain jika perlu (misal: avatarUrl)
        }
      })
      return user // Akan null jika tidak ditemukan
    } catch (error) {
      console.error(error)
      return null
    }
  }
}