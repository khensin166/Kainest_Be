import { PrismaClient } from '@prisma/client'

// Ini memastikan hanya ada satu instance PrismaClient
// yang berjalan di aplikasi Anda.
declare global {
  var prisma: PrismaClient | undefined
}

export const prisma = global.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}