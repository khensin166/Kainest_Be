// UpsertPocketUseCase.ts
import { pocketRepository } from "../../data/PocketRepository.js";
/**
 * Buat atau update kantong user untuk kategori tertentu.
 * Validasi: user harus menyediakan percentage ATAU limitAmount (salah satu).
 */
export const upsertPocketUseCase = async (data) => {
    try {
        const { userId, categoryId, percentage, limitAmount } = data;
        // Validasi: minimal satu harus diisi
        if (percentage == null && limitAmount == null) {
            return {
                success: false,
                status: 400,
                message: "Harap isi persentase atau nominal limit.",
            };
        }
        // Validasi: persentase harus 0-100
        if (percentage != null && (percentage < 0 || percentage > 100)) {
            return {
                success: false,
                status: 400,
                message: "Persentase harus antara 0 dan 100.",
            };
        }
        const pocket = await pocketRepository.upsertPocket(userId, categoryId, {
            percentage: percentage ?? null,
            limitAmount: limitAmount ?? null,
        });
        return { success: true, data: pocket };
    }
    catch (error) {
        console.error("UpsertPocketUseCase Error:", error);
        return { success: false, status: 500, message: "Gagal menyimpan kantong." };
    }
};
