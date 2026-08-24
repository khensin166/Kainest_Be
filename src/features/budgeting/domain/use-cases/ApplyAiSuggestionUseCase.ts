// src/features/budgeting/domain/use-cases/ApplyAiSuggestionUseCase.ts
//
// 1-Click Apply: Menerapkan semua saran budget dari AI ke kantong (BudgetPocket) user.
// Setelah berhasil, suggestion ditandai is_approved = true.

import { prisma } from "../../../../infrastructure/database/prisma.js";
import { pocketRepository } from "../../data/PocketRepository.js";

type ProposedPocket = {
  categoryId: string;
  categoryName: string;
  newLimitAmount: number;
  action: "INCREASE" | "DECREASE" | "KEEP";
  reason: string;
};

export const applyAiSuggestionUseCase = async (userId: string, suggestionId: string) => {
  try {
    // 1. Ambil suggestion dari database dan validasi kepemilikan
    const suggestion = await prisma.aISuggestion.findFirst({
      where: {
        id: suggestionId,
        userId,             // Pastikan hanya owner yang bisa apply
        is_approved: false, // Jangan apply yang sudah di-apply
      },
    });

    if (!suggestion) {
      return {
        success: false,
        status: 404,
        message: "Saran AI tidak ditemukan atau sudah pernah diterapkan.",
      };
    }

    // 2. Parse proposed_pockets
    const proposed = (suggestion.proposed_pockets ?? []) as ProposedPocket[];

    if (!proposed.length) {
      return {
        success: false,
        status: 400,
        message: "Tidak ada perubahan kantong yang direkomendasikan.",
      };
    }

    // 3. Terapkan setiap perubahan kantong (kecuali KEEP)
    const results: { categoryId: string; success: boolean }[] = [];

    for (const item of proposed) {
      if (item.action === "KEEP") continue;

      try {
        await pocketRepository.upsertPocket(userId, item.categoryId, {
          limitAmount: item.newLimitAmount,
          percentage: null, // Ganti ke nominal, bukan persentase
        });
        results.push({ categoryId: item.categoryId, success: true });
      } catch (err: any) {
        console.error(`[ApplyAiSuggestion] Gagal update kantong ${item.categoryId}:`, err.message);
        results.push({ categoryId: item.categoryId, success: false });
      }
    }

    // 4. Tandai suggestion sebagai telah di-apply
    await prisma.aISuggestion.update({
      where: { id: suggestionId },
      data: {
        is_approved: true,
        applied_at: new Date(),
      },
    });

    const appliedCount = results.filter((r) => r.success).length;

    return {
      success: true,
      data: {
        appliedCount,
        totalProposed: proposed.filter((p) => p.action !== "KEEP").length,
        details: results,
      },
    };
  } catch (error: any) {
    console.error("[ApplyAiSuggestionUseCase] Error:", error.message);
    return { success: false, status: 500, message: "Gagal menerapkan saran AI" };
  }
};
