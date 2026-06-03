// GetPocketsUseCase.ts
import { pocketRepository } from "../../data/PocketRepository.js";
/**
 * Ambil daftar kantong milik user.
 * Jika user belum memiliki kantong, kembalikan array kosong
 * beserta daftar kategori default yang tersedia.
 */
export const getPocketsUseCase = async (userId) => {
    try {
        const pockets = await pocketRepository.findPocketsByUser(userId);
        return {
            success: true,
            data: pockets,
        };
    }
    catch (error) {
        console.error("GetPocketsUseCase Error:", error);
        return { success: false, status: 500, message: "Gagal mengambil data kantong." };
    }
};
