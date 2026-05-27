// BulkSetupPocketsUseCase.ts
import { pocketRepository } from "../../data/PocketRepository.js";

type PocketInput = {
  categoryId: string;
  percentage?: number | null;
  limitAmount?: number | null;
};

type BulkSetupData = {
  userId: string;
  pockets: PocketInput[];
};

/**
 * Setup kantong-kantong user secara bulk (untuk onboarding atau reset).
 * Validasi setiap entri sebelum menyimpan.
 */
export const bulkSetupPocketsUseCase = async (data: BulkSetupData) => {
  try {
    const { userId, pockets } = data;

    if (!pockets || pockets.length === 0) {
      return {
        success: false,
        status: 400,
        message: "Harap sertakan minimal satu kantong.",
      };
    }

    // Validasi setiap pocket
    let totalPercentage = 0;
    for (const p of pockets) {
      if (p.percentage != null && (p.percentage < 0 || p.percentage > 100)) {
        return {
          success: false,
          status: 400,
          message: `Persentase untuk kategori ${p.categoryId} harus antara 0 dan 100.`,
        };
      }
      if (p.percentage != null) {
        totalPercentage += p.percentage;
      }
    }

    // Peringatan jika total persentase melebihi 100%
    if (totalPercentage > 100) {
      return {
        success: false,
        status: 400,
        message: `Total persentase kantong (${totalPercentage}%) melebihi 100%. Silakan sesuaikan.`,
      };
    }

    const results = await pocketRepository.bulkUpsertPockets(userId, pockets);

    return {
      success: true,
      message: `${results.length} kantong berhasil disimpan.`,
      data: results,
    };
  } catch (error) {
    console.error("BulkSetupPocketsUseCase Error:", error);
    return { success: false, status: 500, message: "Gagal menyimpan kantong." };
  }
};
