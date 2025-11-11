// UserRepository.ts
import { prisma } from "../../../infrastructure/database/prisma.js";
import { User } from "@prisma/client";
import { generateInviteCode } from "../../../utils/stringUtils.js";

export const userRepository = {
  async findByEmail(email: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
      });
      return user; // Akan null jika tidak ditemukan
    } catch (error) {
      console.error(error);
      return null;
    }
  },

  async create(data: { email: string; password: string; name?: string }) {
    try {
      const inviteCode = generateInviteCode();

      const user = await prisma.user.create({
        data: {
          // Data untuk model 'User'
          email: data.email,
          password: data.password,
          name: data.name,
          profile: {
            create: {
              invitationCode: inviteCode,
              displayName: data.name,
            },
          },
        },
        include: {
          profile: true, // Kembalikan data lengkap
        },
      });
      return user;
    } catch (error) {
      console.error(error);
      throw error;
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
          updatedAt: true,
          // Tambahkan field lain jika perlu (misal: avatarUrl)
        },
      });
      return user; // Akan null jika tidak ditemukan
    } catch (error) {
      console.error(error);
      return null;
    }
  },
};
