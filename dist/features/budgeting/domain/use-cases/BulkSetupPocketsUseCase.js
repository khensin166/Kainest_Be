// BulkSetupPocketsUseCase.ts
import { pocketRepository } from "../../data/PocketRepository.js";
import { budgetRepository } from "../../data/BudgetRepository.js";
/**
 * Setup kantong-kantong user secara bulk (untuk onboarding atau reset).
 * Validasi setiap entri sebelum menyimpan.
 */
export const bulkSetupPocketsUseCase = async (data) => {
    try {
        const { userId, pockets } = data;
        if (!pockets || pockets.length === 0) {
            return {
                success: false,
                status: 400,
                message: "Harap sertakan minimal satu kantong.",
            };
        }
        // Validasi setiap pocket
        let totalPercentage = 0;
        for (const p of pockets) {
            if (p.percentage != null && (p.percentage < 0 || p.percentage > 100)) {
                return {
                    success: false,
                    status: 400,
                    message: `Persentase untuk kategori ${p.categoryId} harus antara 0 dan 100.`,
                };
            }
            if (p.percentage != null) {
                totalPercentage += p.percentage;
            }
        }
        // Peringatan jika total persentase melebihi 100%
        if (totalPercentage > 100) {
            return {
                success: false,
                status: 400,
                message: `Total persentase kantong (${totalPercentage}%) melebihi 100%. Silakan sesuaikan.`,
            };
        }
        // Ambil salary user untuk menghitung budget bulanan
        const user = await budgetRepository.findUserById(userId);
        const salary = user?.salary || 0;
        const results = await pocketRepository.bulkUpsertPockets(userId, pockets);
        // Sinkronisasi limit ke Budget bulanan (untuk bulan berjalan)
        const now = new Date();
        const period = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const budgetPromises = pockets.map((p) => {
            let amountLimit = p.limitAmount || 0;
            if (p.percentage != null) {
                amountLimit = Math.floor((p.percentage / 100) * salary);
            }
            return budgetRepository.upsertBudget(userId, p.categoryId, period, amountLimit, false);
        });
        await Promise.all(budgetPromises);
        // Hapus data budget (bulanan) yang usang/stale (seperti default Makan, Kos, Transport) 
        // jika user tidak memasukkannya ke dalam Pocket yang baru diset.
        const keepCategoryIds = pockets.map(p => p.categoryId);
        await budgetRepository.deleteBudgetsNotInCategories(userId, period, keepCategoryIds);
        return {
            success: true,
            message: `${results.length} kantong berhasil disimpan.`,
            data: results,
        };
    }
    catch (error) {
        console.error("BulkSetupPocketsUseCase Error:", error);
        return { success: false, status: 500, message: "Gagal menyimpan kantong." };
    }
};
