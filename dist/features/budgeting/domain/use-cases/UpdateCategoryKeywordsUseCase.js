// UpdateCategoryKeywordsUseCase.ts
import { pocketRepository } from "../../data/PocketRepository.js";
/**
 * Update keywords pada kategori budget.
 * User bisa menambahkan kata kunci kustom agar LLM semakin pintar mengenali pengeluaran mereka.
 */
export const updateCategoryKeywordsUseCase = async (categoryId, keywords) => {
    try {
        // Sanitize: lowercase semua keyword dan hapus duplikat
        const cleanKeywords = [...new Set(keywords.map((k) => k.trim().toLowerCase()))].filter((k) => k.length > 0);
        const updated = await pocketRepository.updateCategoryKeywords(categoryId, cleanKeywords);
        return {
            success: true,
            data: updated,
        };
    }
    catch (error) {
        console.error("UpdateCategoryKeywordsUseCase Error:", error);
        return {
            success: false,
            status: 500,
            message: "Gagal memperbarui kata kunci kategori.",
        };
    }
};
