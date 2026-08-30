import { prisma } from "../../../infrastructure/database/prisma.js";
import type { Prisma } from "@prisma/client";

export const pocketTemplateRepository = {
  async findByUser(userId: string) {
    return prisma.pocketTemplate.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
  },

  async findById(templateId: string) {
    return prisma.pocketTemplate.findUnique({ where: { id: templateId } });
  },

  async create(userId: string, name: string, pockets: Prisma.InputJsonValue) {
    return prisma.pocketTemplate.create({ data: { userId, name, pockets } });
  },

  async update(templateId: string, data: { name?: string; pockets?: Prisma.InputJsonValue }) {
    return prisma.pocketTemplate.update({ where: { id: templateId }, data });
  },

  async remove(templateId: string) {
    return prisma.pocketTemplate.delete({ where: { id: templateId } });
  },
};
