// src/features/budgeting/domain/use-cases/GetAiSuggestionUseCase.ts
//
// Mengambil saran AI terbaru yang belum di-apply (is_approved = false) milik user.
// Digunakan oleh BudgetDashboardPage untuk menampilkan Banner notifikasi.

import { prisma } from "../../../../infrastructure/database/prisma.js";

export const getAiSuggestionUseCase = async (userId: string) => {
  try {
    // Ambil saran terbaru bertipe MONTHLY_RESET yang belum di-approve
    const suggestion = await prisma.aISuggestion.findFirst({
      where: {
        userId,
        type: "MONTHLY_RESET",
        is_approved: false,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!suggestion) {
      return { success: true, data: null };
    }

    // Parse proposed_pockets dari JSON (Prisma simpan sebagai JsonValue)
    const proposedPockets = suggestion.proposed_pockets ?? [];

    return {
      success: true,
      data: {
        id: suggestion.id,
        period: suggestion.period,
        insightText: suggestion.suggestion_text,
        proposedPockets,
        createdAt: suggestion.createdAt,
      },
    };
  } catch (error: any) {
    console.error("[GetAiSuggestionUseCase] Error:", error.message);
    return { success: false, status: 500, message: "Gagal mengambil saran AI" };
  }
};
