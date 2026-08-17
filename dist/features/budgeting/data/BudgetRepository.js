// BudgetRepository.ts
import { prisma } from "../../../infrastructure/database/prisma.js";
import { getCycleBoundaries } from "../../../utils/cycleBoundaries.js";
export const budgetRepository = {
    /**
     * Cari Monthly History user di bulan tertentu
     */
    async findMonthlyHistory(userId, monthDate) {
        return prisma.monthlyFinancialHistory.findUnique({
            where: {
                userId_period: {
                    userId: userId,
                    period: monthDate,
                },
            },
        });
    },
    /**
     * Ambil semua riwayat keuangan bulanan milik user, diurutkan dari yang terbaru
     */
    async findAllMonthlyHistory(userId) {
        return prisma.monthlyFinancialHistory.findMany({
            where: { userId },
            orderBy: { period: "desc" },
        });
    },
    /**
     * Mengambil detail User berdasarkan ID
     */
    async findUserById(userId) {
        return prisma.user.findUnique({
            where: { id: userId },
        });
    },
    /**
     * Update saldo kantong
     */
    async updatePocket(pocketId, updatedData) {
        return prisma.budgetPocket.update({
            where: { id: pocketId },
            data: updatedData,
        });
    },
    async updateUserSalary(userId, salary, payday) {
        return prisma.user.update({
            where: { id: userId },
            data: {
                salary,
                // Hanya update payday jika dikirimkan (undefined = tidak diubah)
                ...(payday !== undefined ? { payday } : {}),
            }
        });
    },
    /**
     * Mengambil semua kategori default / global
     */
    async findAllCategories(userId) {
        return prisma.budgetCategory.findMany({
            where: {
                OR: [{ isDefault: true }, { userId: userId }],
            },
        });
    },
    /**
     * Membuat kategori kustom milik user
     */
    async createCustomCategory(userId, name, icon) {
        return prisma.budgetCategory.create({
            data: {
                name,
                icon,
                type: "EXPENSE",
                isDefault: false,
                userId: userId,
            }
        });
    },
    /**
     * Write-Time Sync:
     * Menghitung ulang total pengeluaran per kategori untuk suatu bulan
     * dan menyimpannya langsung ke MonthlyFinancialHistory.
     */
    async syncMonthlyHistory(userId, targetDate) {
        try {
            const user = await this.findUserById(userId);
            if (!user)
                return;
            const payday = user.payday ?? 31;
            const { cycleStart, cycleEnd, period } = getCycleBoundaries(targetDate, payday);
            const startDate = cycleStart;
            const endDate = cycleEnd;
            // =========================================================
            // 🔒 IMMUTABILITY GUARDRAIL
            // Tentukan apakah periode ini adalah bulan lampau (< bulan berjalan)
            // Bulan berjalan ditentukan dari siklus aktif SEKARANG.
            // =========================================================
            const now = new Date();
            const { period: currentPeriod } = getCycleBoundaries(now, payday);
            const isPastPeriod = period.getTime() < currentPeriod.getTime();
            let history = await this.findMonthlyHistory(userId, period);
            if (!history) {
                // Jika history tidak ada, buat baru berdasarkan konfigurasi pocket user saat ini.
                // (Hanya akan terjadi jika ini periode pertama / bulan berjalan)
                const activePockets = await prisma.budgetPocket.findMany({
                    where: { userId },
                    include: { category: true }
                });
                const salary = user.salary || 0;
                const pocketsSnapshot = activePockets.map(p => {
                    let limitAmount = p.limitAmount || 0;
                    if (p.percentage != null && p.percentage > 0 && salary > 0) {
                        limitAmount = Math.floor((p.percentage / 100) * salary);
                    }
                    return {
                        categoryId: p.categoryId,
                        categoryName: p.category.name,
                        limitAmount,
                        icon: p.category.icon || '💰',
                        spent: 0
                    };
                });
                let totalBudgeted = pocketsSnapshot.reduce((acc, p) => acc + p.limitAmount, 0);
                let totalSaved = 0;
                const savingPocket = pocketsSnapshot.find(p => p.categoryName.toLowerCase().includes('tabungan') || p.categoryName.toLowerCase().includes('saving'));
                if (savingPocket) {
                    totalSaved = savingPocket.limitAmount;
                    totalBudgeted -= savingPocket.limitAmount;
                }
                history = await this.upsertMonthlyHistory(userId, period, {
                    salarySnapshot: user.salary || 0,
                    totalBudgeted: totalBudgeted,
                    totalSaved: totalSaved,
                    pocketsSnapshot: pocketsSnapshot,
                    totalSpent: 0
                });
            }
            // 🆕 Query terpisah: EXPENSE dan INCOME
            const expenseGrouped = await this.getMonthlyExpenseGrouped(userId, startDate, endDate);
            const incomeGrouped = await this.getMonthlyIncomeGrouped(userId, startDate, endDate);
            let actualSaved = 0;
            let totalSpent = 0;
            let totalIncome = 0;
            const allCategories = await this.findAllCategories(userId);
            let pocketsSnapshot = [];
            if (history.pocketsSnapshot) {
                if (typeof history.pocketsSnapshot === 'string') {
                    try {
                        pocketsSnapshot = JSON.parse(history.pocketsSnapshot);
                    }
                    catch (e) { }
                }
                else if (Array.isArray(history.pocketsSnapshot)) {
                    pocketsSnapshot = history.pocketsSnapshot;
                }
            }
            // Update realisasi 'spent' per kantong — SELALU BOLEH (untuk transaksi susulan)
            pocketsSnapshot = pocketsSnapshot.map((pocket) => {
                const expense = expenseGrouped.find((e) => e.categoryId === pocket.categoryId);
                pocket.spent = expense?._sum.amount || 0;
                // 🔒 IMMUTABILITY GUARDRAIL untuk bulan lampau:
                // Jangan sentuh limitAmount pada snapshot bulan lalu.
                // Field ini sudah terekam dan merupakan kondisi saat bulan itu aktif.
                // (limitAmount di sini tidak diubah karena kita hanya mengubah .spent)
                return pocket;
            });
            // Hitung totalSpent dan totalSaved dari transaksi EXPENSE
            expenseGrouped.forEach(curr => {
                const cat = allCategories.find(c => c.id === curr.categoryId);
                const isSavings = cat && (cat.name.toLowerCase().includes('tabungan') || cat.name.toLowerCase().includes('saving'));
                if (isSavings) {
                    actualSaved += (curr._sum.amount || 0);
                }
                else {
                    totalSpent += (curr._sum.amount || 0);
                }
            });
            // Hitung totalIncome dari transaksi INCOME
            incomeGrouped.forEach(curr => {
                totalIncome += (curr._sum.amount || 0);
            });
            if (isPastPeriod) {
                // 🔒 PERIODE LAMPAU: Hanya perbarui realisasi (spent/income).
                // salarySnapshot, totalBudgeted, dan limitAmount per kantong TIDAK BOLEH berubah.
                await prisma.monthlyFinancialHistory.update({
                    where: { id: history.id },
                    data: {
                        totalSpent: totalSpent,
                        totalSaved: actualSaved,
                        totalIncome: totalIncome,
                        pocketsSnapshot: pocketsSnapshot, // 'spent' per kantong di-update, 'limitAmount' TIDAK
                    }
                });
                console.log(`✅ [Write-Time Sync - PAST] History ${period.toISOString()} synced (spent only, salary/limits LOCKED). Spent: ${totalSpent}, Income: ${totalIncome}`);
            }
            else {
                // 🟢 PERIODE BERJALAN: Perbarui semua field termasuk totalBudgeted & salarySnapshot.
                await prisma.monthlyFinancialHistory.update({
                    where: { id: history.id },
                    data: {
                        totalSpent: totalSpent,
                        totalSaved: actualSaved,
                        totalIncome: totalIncome,
                        pocketsSnapshot: pocketsSnapshot
                    }
                });
                console.log(`✅ [Write-Time Sync] History ${startDate.toISOString()} synced. Spent: ${totalSpent}, Income: ${totalIncome}`);
            }
        }
        catch (e) {
            console.error("❌ [Write-Time Sync] Gagal sinkronisasi:", e);
        }
    },
    async upsertMonthlyHistory(userId, period, data) {
        return prisma.monthlyFinancialHistory.upsert({
            where: {
                userId_period: {
                    userId,
                    period,
                },
            },
            update: {
                salarySnapshot: data.salarySnapshot,
                totalBudgeted: data.totalBudgeted,
                totalSaved: data.totalSaved,
                pocketsSnapshot: data.pocketsSnapshot,
                ...(data.totalSpent !== undefined && { totalSpent: data.totalSpent })
            },
            create: {
                userId,
                period,
                salarySnapshot: data.salarySnapshot,
                totalBudgeted: data.totalBudgeted,
                totalSaved: data.totalSaved,
                pocketsSnapshot: data.pocketsSnapshot,
                totalSpent: data.totalSpent || 0
            },
        });
    },
    /**
     * Mengambil Total Pengeluaran (EXPENSE) per Kategori dalam satu bulan
     */
    async getMonthlyExpenseGrouped(userId, startDate, endDate) {
        return prisma.transaction.groupBy({
            by: ["categoryId"],
            _sum: {
                amount: true,
            },
            where: {
                userId: userId,
                type: "EXPENSE",
                date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
        });
    },
    /**
     * 🆕 Mengambil Total Pemasukan (INCOME) per Kategori dalam satu bulan
     */
    async getMonthlyIncomeGrouped(userId, startDate, endDate) {
        return prisma.transaction.groupBy({
            by: ["categoryId"],
            _sum: {
                amount: true,
            },
            where: {
                userId: userId,
                type: "INCOME",
                date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
        });
    },
    /**
     * SEED: Membuat kategori default jika belum ada
     */
    async seedDefaultCategories() {
        const defaults = [
            { name: "Makan & Minum", type: "EXPENSE", icon: "🍔", isDefault: true },
            { name: "Transportasi", type: "EXPENSE", icon: "🚗", isDefault: true },
            {
                name: "Tempat Tinggal (Kos/Sewa)",
                type: "EXPENSE",
                icon: "🏠",
                isDefault: true,
            },
            { name: "Hiburan", type: "EXPENSE", icon: "🎬", isDefault: true },
            { name: "Belanja Bulanan", type: "EXPENSE", icon: "🛒", isDefault: true },
            {
                name: "Tabungan & Investasi",
                type: "EXPENSE",
                icon: "💰",
                isDefault: true,
            }, // Dianggap expense cashflow
            // 🆕 Kategori Pemasukan Default
            { name: "Pemasukan Umum", type: "INCOME", icon: "💵", isDefault: true },
            { name: "Gaji & Pendapatan Tetap", type: "INCOME", icon: "🏦", isDefault: true },
            { name: "Bonus / THR", type: "INCOME", icon: "🎁", isDefault: true },
        ];
        // Gunakan transaction agar atomic (masuk semua atau gagal semua)
        // createMany skipDuplicates hanya jalan di DB tertentu, kita pakai loop aman saja
        const results = [];
        for (const cat of defaults) {
            // Cek dulu biar gak duplikat
            const exists = await prisma.budgetCategory.findFirst({
                where: { name: cat.name },
            });
            if (!exists) {
                const newCat = await prisma.budgetCategory.create({
                    data: {
                        name: cat.name,
                        type: cat.type, // Cast enum
                        icon: cat.icon,
                        isDefault: true,
                        // userId null artinya ini global category
                    },
                });
                results.push(newCat);
            }
        }
        return results;
    },
};
