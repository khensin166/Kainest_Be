import { groqService } from "../../../../infrastructure/ai/groqService.js";
import { getDailyBudgetStatusUseCase } from "./GetDailyBudgetStatusUseCase.js";
import { BUDGET_ADVISOR_SYSTEM_PROMPT } from "../prompts.js";
import { prisma } from "../../../../infrastructure/database/prisma.js"; // Untuk simpan log

export const getAiAdvisorUseCase = async (
  userId: string,
  categoryId: string
) => {
  // 1. Ambil Data Real-time (Logic Fase 1)
  const statusResult = await getDailyBudgetStatusUseCase(userId, categoryId);

  if (!statusResult.success || !statusResult.data) {
    return {
      success: false,
      message: "Data budget belum tersedia untuk dianalisis.",
    };
  }

  const budgetData = statusResult.data;

  // 2. Cek Cache Database (Optional tapi disarankan)
  // Agar tidak boros token, kita cek apakah hari ini sudah ada saran untuk kategori ini?
  // (Untuk MVP kita skip dulu logic ini, langsung tembak AI)

  // 3. Susun Context untuk AI
  const contextJson = JSON.stringify(
    {
      category: budgetData.category,
      limit: budgetData.limit_month,
      spent: budgetData.spent_so_far,
      remaining: budgetData.remaining,
      daily_safe_limit: budgetData.daily_safe_spend,
      current_zone: budgetData.zone,
    },
    null,
    2
  ); // null, 2 biar printnya rapi

  // 🔥 TAMBAHKAN INI:
  console.log("==========================================");
  console.log("🤖 [DEBUG] DATA YANG DIKIRIM KE GROQ:");
  console.log(contextJson);
  console.log("==========================================");

  // 4. Panggil Groq
  const aiAdvice = await groqService.generateResponse(
    BUDGET_ADVISOR_SYSTEM_PROMPT,
    contextJson
  );

  // 5. Simpan Saran ke Database (Untuk History)
  await prisma.aISuggestion.create({
    data: {
      userId: userId,
      type: "DAILY_ADVISOR",
      suggestion_text: aiAdvice,
      is_approved: true, // Default true karena ini cuma advice, bukan perubahan budget
    },
  });

  return {
    success: true,
    data: {
      zone: budgetData.zone,
      advice: aiAdvice,
    },
  };
};
