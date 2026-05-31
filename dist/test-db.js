// test-db.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    // Check if "Lain-lain" category already exists
    const existingCategory = await prisma.budgetCategory.findFirst({
        where: { name: 'Lain-lain', isDefault: true }
    });
    if (!existingCategory) {
        const newCategory = await prisma.budgetCategory.create({
            data: {
                name: 'Lain-lain',
                type: 'EXPENSE',
                icon: '📝',
                isDefault: true,
                keywords: ['lain', 'lainnya', 'random', 'tidak diketahui', 'lain-lain', 'unknown'],
            }
        });
        console.log('✅ Created default category "Lain-lain":', newCategory.id);
    }
    else {
        console.log('ℹ️ "Lain-lain" category already exists:', existingCategory.id);
        // Update existing category keywords if they are empty
        if (!existingCategory.keywords || existingCategory.keywords.length === 0) {
            await prisma.budgetCategory.update({
                where: { id: existingCategory.id },
                data: {
                    keywords: ['lain', 'lainnya', 'random', 'tidak diketahui', 'lain-lain', 'unknown']
                }
            });
            console.log('✅ Updated keywords for "Lain-lain"');
        }
    }
    // Also update existing default categories to have basic keywords if needed
    // This is a basic mapping, you can expand this later via UI
    const keywordMapping = {
        'Makan & Minum': ['makan', 'minum', 'gofood', 'grabfood', 'kafe', 'kopi', 'restoran', 'nasi', 'jajan'],
        'Transportasi': ['bensin', 'parkir', 'tol', 'gojek', 'grab', 'kereta', 'krl', 'mrt', 'angkot'],
        'Tempat Tinggal (Kos/Sewa)': ['kos', 'sewa', 'listrik', 'air', 'ipl', 'kontrakan', 'apartemen'],
        'Hiburan': ['nonton', 'bioskop', 'netflix', 'game', 'spotify', 'langganan', 'jalan-jalan'],
        'Belanja Bulanan': ['belanja', 'supermarket', 'minimarket', 'sabun', 'shampoo', 'beras', 'indomaret', 'alfamart'],
        'Tabungan & Investasi': ['tabung', 'investasi', 'saham', 'reksadana', 'crypto', 'deposito', 'bibit']
    };
    for (const [categoryName, keywords] of Object.entries(keywordMapping)) {
        const category = await prisma.budgetCategory.findFirst({
            where: { name: categoryName, isDefault: true }
        });
        if (category && (!category.keywords || category.keywords.length === 0)) {
            await prisma.budgetCategory.update({
                where: { id: category.id },
                data: { keywords }
            });
            console.log(`✅ Updated keywords for "${categoryName}"`);
        }
    }
}
// Main 
main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
