// Impor klien prisma, bukan supabase
import { prisma } from '../../../infrastructure/database/prisma.js'
// Ganti tipe 'user' jika perlu, sesuaikan dengan model Prisma Anda
import { User } from '@prisma/client' 

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

  async create(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'name'>) { 
    // Sesuaikan tipe 'userData' dengan apa yang dibutuhkan
    // untuk membuat user baru di skema Prisma Anda
    try {
      const user = await prisma.user.create({
        data: userData,
      })
      return user
    } catch (error) {
      console.error(error)
      throw error // Biarkan use-case menangani error
    }
  },
}