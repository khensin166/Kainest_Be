// ClassifyTransactionUseCase.ts
import { pocketRepository } from "../../data/PocketRepository.js";
import { budgetRepository } from "../../data/BudgetRepository.js";
import { groqService } from "../../../../infrastructure/ai/groqService.js";
const CLASSIFY_SYSTEM_PROMPT = `
You are Kenin, a financial transaction classifier for an Indonesian user.
Your ONLY job: Match a user's spending text to the CORRECT category ID from the list provided.

RULES:
1. You will receive a spending text and a list of available categories with keywords.
2. Match the text to the BEST category using the keywords as hints.
3. If NO category matches, return the fallback category ID provided.
4. Respond ONLY with valid JSON: { "categoryId": "<id>", "amount": <number>, "note": "<cleaned note>" }
5. Extract the amount from the text (convert "k" to 000, "rb" to 000, "jt" to 000000).
6. The "note" should be a clean, short description of the spending.
7. Do NOT add any explanation. JSON only.
`;
/**
 * Klasifikasi teks pengeluaran user menggunakan Grok/LLM.
 * SAFEGUARD: Hanya mengirim kategori dari kantong yang DIMILIKI user ke LLM.
 */
export const classifyTransactionUseCase = async (userId, text) => {
    try {
        // 1. Ambil kantong-kantong user beserta keywords
        const userPockets = await pocketRepository.findPocketsForClassification(userId);
        // 2. Cari kategori "Lain-lain" sebagai fallback
        const allCategories = await budgetRepository.findAllCategories();
        const fallbackCategory = allCategories.find((c) => c.name === "Lain-lain" && c.isDefault);
        const fallbackId = fallbackCategory?.id || null;
        // 3. Bangun daftar kategori untuk prompt
        // PENTING: Hanya kirim kategori dari kantong user!
        let categoryListText = "";
        if (userPockets.length > 0) {
            // User punya kantong -> kirim hanya kantong mereka
            categoryListText = userPockets
                .map((p) => `- ID: ${p.category.id} | Nama: ${p.category.name} | Keywords: ${(p.category.keywords || []).join(", ")}`)
                .join("\n");
        }
        else {
            // User belum setup kantong -> kirim semua kategori default
            categoryListText = allCategories
                .map((c) => `- ID: ${c.id} | Nama: ${c.name} | Keywords: ${(c.keywords || []).join(", ")}`)
                .join("\n");
        }
        // 4. Buat prompt user context
        const userContext = `
Teks pengeluaran user: "${text}"

Daftar kategori yang tersedia (PILIH HANYA DARI INI):
${categoryListText}

Kategori fallback (gunakan jika tidak ada yang cocok):
- ID: ${fallbackId} | Nama: Lain-lain

Balas HANYA dengan JSON: { "categoryId": "<id>", "amount": <number>, "note": "<deskripsi singkat>" }
`;
        // 5. Kirim ke Grok/LLM
        const response = await groqService.generateResponse(CLASSIFY_SYSTEM_PROMPT, userContext);
        // 6. Parse respons JSON dari LLM
        // Bersihkan respons jika LLM menambahkan backtick markdown
        const cleanResponse = response
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim();
        const parsed = JSON.parse(cleanResponse);
        // 7. Validasi: Pastikan categoryId yang dipilih LLM memang ada di daftar user
        const validIds = userPockets.length > 0
            ? userPockets.map((p) => p.category.id)
            : allCategories.map((c) => c.id);
        const chosenId = validIds.includes(parsed.categoryId)
            ? parsed.categoryId
            : fallbackId;
        // Cari nama kategori untuk respons
        const chosenCategory = userPockets.find((p) => p.category.id === chosenId)?.category ||
            allCategories.find((c) => c.id === chosenId);
        return {
            success: true,
            categoryId: chosenId,
            categoryName: chosenCategory?.name || "Lain-lain",
            amount: parsed.amount || 0,
            note: parsed.note || text,
        };
    }
    catch (error) {
        console.error("ClassifyTransactionUseCase Error:", error);
        return {
            success: false,
            message: "Gagal mengklasifikasikan pengeluaran.",
        };
    }
};
