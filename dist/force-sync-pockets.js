import { prisma } from "./infrastructure/database/prisma.js";
import { budgetRepository } from "./features/budgeting/data/BudgetRepository.js";
async function main() {
    console.log("🔍 Memulai sinkronisasi ulang pocketsSnapshot untuk semua bulan...");
    const users = await prisma.user.findMany();
    for (const user of users) {
        const userId = user.id;
        const salary = user.salary || 0;
        // 1. Ambil pocket aktif saat ini
        const activePockets = await prisma.budgetPocket.findMany({
            where: { userId },
            include: { category: true }
        });
        if (activePockets.length === 0)
            continue;
        // 2. Buat snapshot baru
        let totalBudgeted = 0;
        const pocketsSnapshot = activePockets.map(p => {
            let amountLimit = p.limitAmount || 0;
            if (p.percentage != null) {
                amountLimit = Math.floor((p.percentage / 100) * salary);
            }
            totalBudgeted += amountLimit;
            return {
                categoryId: p.categoryId,
                categoryName: p.category.name,
                icon: p.category.icon || '💰',
                limitAmount: amountLimit,
                spent: 0
            };
        });
        // 3. Ambil semua histori
        const histories = await budgetRepository.findAllMonthlyHistory(userId);
        for (const history of histories) {
            console.log(`Mengupdate bulan ${history.period.toISOString()}...`);
            await prisma.monthlyFinancialHistory.update({
                where: { id: history.id },
                data: {
                    totalBudgeted: totalBudgeted,
                    pocketsSnapshot: pocketsSnapshot
                }
            });
            // Sinkronisasi ulang untuk menghitung ulang spent dan saved
            await budgetRepository.syncMonthlyHistory(userId, history.period);
        }
    }
    console.log("✅ Semua bulan berhasil disamakan dengan setup pocket terbaru!");
}
main()
    .catch((e) => {
    console.error("❌ Terjadi kesalahan:", e);
})
    .finally(async () => {
    await prisma.$disconnect();
});
