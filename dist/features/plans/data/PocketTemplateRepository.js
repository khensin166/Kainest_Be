import { prisma } from "../../../infrastructure/database/prisma.js";
export const pocketTemplateRepository = {
    async findByUser(userId) {
        return prisma.pocketTemplate.findMany({
            where: { userId },
            orderBy: { updatedAt: "desc" },
        });
    },
    async findById(templateId) {
        return prisma.pocketTemplate.findUnique({ where: { id: templateId } });
    },
    async create(userId, name, pockets) {
        return prisma.pocketTemplate.create({ data: { userId, name, pockets } });
    },
    async update(templateId, data) {
        return prisma.pocketTemplate.update({ where: { id: templateId }, data });
    },
    async remove(templateId) {
        return prisma.pocketTemplate.delete({ where: { id: templateId } });
    },
};
