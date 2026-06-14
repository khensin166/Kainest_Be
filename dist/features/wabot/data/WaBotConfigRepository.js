import { prisma } from "../../../infrastructure/database/prisma.js";
export const waBotConfigRepository = {
    /**
     * Menyimpan atau memperbarui konfigurasi bot
     */
    async upsertConfig(userId, baseUrl, adminSecret) {
        return prisma.waBotConfig.upsert({
            where: { userId },
            update: {
                baseUrl,
                adminSecret,
            },
            create: {
                userId,
                baseUrl,
                adminSecret,
            },
        });
    },
    /**
     * Mengambil konfigurasi bot berdasarkan User ID
     */
    async getConfig(userId) {
        return prisma.waBotConfig.findUnique({
            where: { userId },
        });
    },
    /**
     * Memperbarui nomor HP bot (Untuk webhook bailey)
     */
    async updateBotPhoneNumber(userId, botPhoneNumber) {
        return prisma.waBotConfig.update({
            where: { userId },
            data: { botPhoneNumber },
        });
    },
    /**
     * Mengambil konfigurasi bot pertama (Asumsi bot SaaS tersentral)
     */
    async getFirstConfig() {
        return prisma.waBotConfig.findFirst();
    },
};
