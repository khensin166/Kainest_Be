// ClassifyTransactionUseCase.ts
import { pocketRepository } from "../../data/PocketRepository.js";
import { budgetRepository } from "../../data/BudgetRepository.js";
import { groqService } from "../../../../infrastructure/ai/groqService.js";
const CLASSIFY_SYSTEM_PROMPT = `
You are Kenin, a financial transaction classifier for an Indonesian user.
Your ONLY job: Identify if a transaction is INCOME or EXPENSE, then match it to the CORRECT category ID.

RULES:
1. You will receive a transaction text and two separate lists: EXPENSE categories (with keywords) and INCOME categories.
2. First detect the transaction TYPE:
   - INCOME: keywords like "gaji", "dapat", "masuk", "diterima", "bonus", "bayaran", "dibayar", "terima", "pemasukan".
   - EXPENSE: anything related to spending, buying, paying, eating out, etc.
3. Match the text to the BEST category from the correct type list using keywords as hints.
4. If NO category matches, use the fallback category ID provided.
5. Respond ONLY with valid JSON: { "categoryId": "<id>", "type": "INCOME" | "EXPENSE", "amount": <number>, "note": "<cleaned note>" }
6. Extract the amount from the text (convert "k" to 000, "rb" to 000, "jt" to 000000).
7. The "note" should be a clean, short description.
8. Do NOT add any explanation. JSON only.
`;
/**
 * Klasifikasi teks transaksi user menggunakan Grok/LLM.
 * Mendukung INCOME dan EXPENSE sekaligus.
 * SAFEGUARD: Hanya mengirim kategori valid ke LLM.
 */
export const classifyTransactionUseCase = async (userId, text) => {
    try {
        // 1. Ambil kantong-kantong pengeluaran user beserta keywords
        const userPockets = await pocketRepository.findPocketsForClassification(userId);
        // 2. Ambil semua kategori (EXPENSE + INCOME default)
        const allCategories = await budgetRepository.findAllCategories(userId);
        // 3. Pisahkan kategori INCOME
        const incomeCategories = allCategories.filter(c => c.type === "INCOME");
        // 4. Fallback kategori "Lain-lain"
        const fallbackCategory = allCategories.find((c) => c.name === "Lain-lain" && c.isDefault);
        const fallbackId = fallbackCategory?.id || null;
        // 5. Bangun daftar EXPENSE categories dari kantong user
        let expenseCategoryListText = "";
        if (userPockets.length > 0) {
            expenseCategoryListText = userPockets
                .map((p) => `- ID: ${p.category.id} | Nama: ${p.category.name} | Keywords: ${(p.keywords && p.keywords.length > 0 ? p.keywords : (p.category.keywords || [])).join(", ")}`)
                .join("\n");
        }
        else {
            const expenseDefaults = allCategories.filter(c => c.type === "EXPENSE");
            expenseCategoryListText = expenseDefaults
                .map((c) => `- ID: ${c.id} | Nama: ${c.name} | Keywords: ${(c.keywords || []).join(", ")}`)
                .join("\n");
        }
        // 6. Bangun daftar INCOME categories
        const incomeCategoryListText = incomeCategories
            .map(c => `- ID: ${c.id} | Nama: ${c.name} | Keywords: ${(c.keywords || []).join(", ")}`)
            .join("\n") || "- Tidak ada kategori pemasukan";
        // 7. Buat prompt user context
        const userContext = `
Teks transaksi user: "${text}"

=== DAFTAR KATEGORI PENGELUARAN (EXPENSE) - Pilih jika ini pengeluaran: ===
${expenseCategoryListText}

=== DAFTAR KATEGORI PEMASUKAN (INCOME) - Pilih jika ini pemasukan: ===
${incomeCategoryListText}

Kategori fallback (gunakan jika tidak ada yang cocok):
- ID: ${fallbackId} | Nama: Lain-lain

Balas HANYA dengan JSON: { "categoryId": "<id>", "type": "INCOME" | "EXPENSE", "amount": <number>, "note": "<deskripsi singkat>" }
`;
        // 8. Kirim ke Grok/LLM
        const response = await groqService.generateResponse(CLASSIFY_SYSTEM_PROMPT, userContext);
        // 9. Parse respons JSON dari LLM
        const cleanResponse = response
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim();
        const parsed = JSON.parse(cleanResponse);
        // 10. Validasi: Pastikan categoryId ada di daftar yang valid
        const allValidIds = [
            ...(userPockets.length > 0
                ? userPockets.map(p => p.category.id)
                : allCategories.filter(c => c.type === "EXPENSE").map(c => c.id)),
            ...incomeCategories.map(c => c.id),
        ];
        const chosenId = allValidIds.includes(parsed.categoryId)
            ? parsed.categoryId
            : fallbackId;
        // 11. Tentukan tipe transaksi dari respons AI
        const transactionType = (parsed.type === "INCOME" || parsed.type === "EXPENSE")
            ? parsed.type
            : "EXPENSE"; // default aman ke EXPENSE
        // Cari nama kategori untuk respons
        const chosenCategory = userPockets.find((p) => p.category.id === chosenId)?.category ||
            allCategories.find((c) => c.id === chosenId);
        return {
            success: true,
            categoryId: chosenId,
            categoryName: chosenCategory?.name || "Lain-lain",
            type: transactionType,
            amount: parsed.amount || 0,
            note: parsed.note || text,
        };
    }
    catch (error) {
        console.error("ClassifyTransactionUseCase Error:", error);
        return {
            success: false,
            message: "Gagal mengklasifikasikan transaksi.",
        };
    }
};
