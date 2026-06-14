// UpdatePocketKeywordsUseCase.ts
import { pocketRepository } from "../../data/PocketRepository.js";
/**
 * Update keywords pada kantong budget.
 * User bisa menambahkan kata kunci kustom agar LLM semakin pintar mengenali pengeluaran mereka tanpa mengubah kategori sistem.
 */
export const updatePocketKeywordsUseCase = async (userId, categoryId, keywords) => {
    try {
        // Sanitize: lowercase semua keyword dan hapus duplikat
        const cleanKeywords = [...new Set(keywords.map((k) => k.trim().toLowerCase()))].filter((k) => k.length > 0);
        const updated = await pocketRepository.updatePocketKeywords(userId, categoryId, cleanKeywords);
        return {
            success: true,
            data: updated,
        };
    }
    catch (error) {
        console.error("UpdatePocketKeywordsUseCase Error:", error);
        return {
            success: false,
            status: 500,
            message: "Gagal memperbarui kata kunci kantong.",
        };
    }
};
