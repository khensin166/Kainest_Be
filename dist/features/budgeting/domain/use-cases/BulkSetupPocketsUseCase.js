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
        // Ambil detail kategori untuk nama & icon di snapshot
        const categories = await budgetRepository.findAllCategories();
        // Sinkronisasi limit ke Monthly Financial History (untuk bulan berjalan)
        const now = new Date();
        const period = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        let totalBudgeted = 0;
        let totalSaved = 0;
        const pocketsSnapshot = pockets.map((p) => {
            let amountLimit = p.limitAmount || 0;
            if (p.percentage != null) {
                amountLimit = Math.floor((p.percentage / 100) * salary);
            }
            const catDetail = categories.find(c => c.id === p.categoryId);
            const isSaving = catDetail?.name.toLowerCase().includes('tabungan') || catDetail?.name.toLowerCase().includes('saving');
            totalBudgeted += amountLimit;
            if (isSaving) {
                totalSaved += amountLimit;
            }
            return {
                categoryId: p.categoryId,
                categoryName: catDetail?.name || "Unknown",
                icon: catDetail?.icon || "💰",
                limitAmount: amountLimit,
            };
        });
        // Cari tahu totalSpent saat ini jika history sudah ada, supaya tidak kereset ke 0
        const existingHistory = await budgetRepository.findMonthlyHistory(userId, period);
        await budgetRepository.upsertMonthlyHistory(userId, period, {
            salarySnapshot: salary,
            totalBudgeted: totalBudgeted,
            totalSaved: totalSaved,
            pocketsSnapshot: pocketsSnapshot,
            totalSpent: existingHistory?.totalSpent || 0,
        });
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
