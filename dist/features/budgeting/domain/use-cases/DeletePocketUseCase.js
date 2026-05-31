// DeletePocketUseCase.ts
import { pocketRepository } from "../../data/PocketRepository.js";
/**
 * Hapus kantong user untuk kategori tertentu.
 */
export const deletePocketUseCase = async (userId, categoryId) => {
    try {
        await pocketRepository.deletePocket(userId, categoryId);
        return { success: true, message: "Kantong berhasil dihapus." };
    }
    catch (error) {
        // Prisma P2025 = Record to delete does not exist
        if (error?.code === "P2025") {
            return { success: false, status: 404, message: "Kantong tidak ditemukan." };
        }
        console.error("DeletePocketUseCase Error:", error);
        return { success: false, status: 500, message: "Gagal menghapus kantong." };
    }
};
