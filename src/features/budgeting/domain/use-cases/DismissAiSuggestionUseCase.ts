// src/features/budgeting/domain/use-cases/DismissAiSuggestionUseCase.ts
import { prisma } from "../../../../infrastructure/database/prisma.js";

export const dismissAiSuggestionUseCase = async (userId: string, suggestionId: string) => {
  try {
    const suggestion = await prisma.aISuggestion.findFirst({
      where: {
        id: suggestionId,
        userId,
      },
    });

    if (!suggestion) {
      return { success: false, status: 404, message: "Saran AI tidak ditemukan" };
    }

    if (suggestion.is_approved) {
      return { success: false, status: 400, message: "Saran AI ini sudah diproses sebelumnya" };
    }

    // Tandai suggestion ini sebagai dismissed (is_approved = true, applied_at = null)
    // dan juga bersihkan suggestion lain yang menggantung agar tidak muncul lagi.
    await prisma.aISuggestion.updateMany({
      where: { 
        userId, 
        type: "MONTHLY_RESET", 
        is_approved: false 
      },
      data: { 
        is_approved: true,
        applied_at: null // Penanda bahwa ini ditolak/diabaikan
      },
    });

    return {
      success: true,
      message: "Saran AI berhasil diabaikan",
    };
  } catch (error: any) {
    console.error("[DismissAiSuggestionUseCase] Error:", error.message);
    return { success: false, status: 500, message: "Gagal mengabaikan saran AI" };
  }
};
