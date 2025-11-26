import { budgetRepository } from "../../data/BudgetRepository.js";
import { groqService } from "../../../../infrastructure/ai/groqService.js";
import { MONTHLY_EVALUATION_SYSTEM_PROMPT } from "../prompts.js";
import { prisma } from "../../../../infrastructure/database/prisma.js";

export const evaluateMonthlyBudgetUseCase = async (userId: string) => {
  try {
    // 1. Tentukan Periode Evaluasi
    // (Idealnya evaluasi bulan lalu, tapi untuk testing kita evaluasi bulan ini)
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // 2. Ambil Data Budget & Spending
    const budgets = await budgetRepository.findBudgetsByMonth(
      userId,
      startDate
    );
    const expenses = await budgetRepository.getMonthlyExpenseGrouped(
      userId,
      startDate,
      endDate
    );

    // 🔥 DEBUG 1: Cek Data Mentah dari Database
    console.log("========================================");
    console.log(
      `🔍 [DEBUG] Periode: ${startDate.toISOString()} s/d ${endDate.toISOString()}`
    );
    console.log(`🔍 [DEBUG] Total Budget Ditemukan: ${budgets.length}`);
    console.log(`🔍 [DEBUG] Data Pengeluaran (Raw):`, expenses);
    console.log("========================================");

    // 3. 🧠 LEARNING ENGINE (Rule-Based Calculation)
    const analysis = budgets.map((budget) => {
      const expense = expenses.find((e) => e.categoryId === budget.categoryId);
      const spent = expense?._sum.amount || 0;
      const limit = budget.amount_limit;

      let suggestion = limit;
      let action = "KEEP"; // KEEP | INCREASE | DECREASE
      let reason = "Spending sesuai budget.";

      // RULE 1: UNDERSPENDING (HEMAT)
      // Jika pemakaian di bawah 70% dari limit -> Tawarkan turunkan budget
      if (spent > 0 && spent < limit * 0.7) {
        // Rumus: Realisasi + Buffer 10%
        const newLimit = Math.ceil((spent * 1.1) / 5000) * 5000; // Pembulatan ke 5000 terdekat
        suggestion = newLimit;
        action = "DECREASE";
        reason = `Hemat banget! Cuma terpakai ${Math.round(
          (spent / limit) * 100
        )}%. Turunkan biar sisa gaji bisa ditabung.`;
      }

      // Kalau sudah kepakai 90%, anggap perlu evaluasi naik budget dikit
      else if (spent > limit * 0.9) {
        suggestion = spent * 1.05; // Saran naikkan 5% dari realisasi
        action = "INCREASE";
        reason =
          "Budget mepet banget (di atas 90%). Naikkan sedikit biar napas lega.";
      }

      // RULE 2: OVERSPENDING (BOROS)
      // Jika pemakaian tembus 100% -> Tawarkan naikkan budget (Realistis)
      else if (spent > limit) {
        // Rumus: Realisasi
        suggestion = spent;
        action = "INCREASE";
        reason =
          "Budget jebol. Naikkan limit agar bulan depan tidak merah lagi.";
      }

      // 🔥 DEBUG 2: Cek Perhitungan Per Item (Supaya tau kenapa masuk KEEP)
      console.log(`👉 Cek Kategori: ${budget.category.name}`);
      console.log(`   Limit: ${limit} | Spent: ${spent}`);
      console.log(`   Ratio: ${(spent / limit) * 100}%`);
      console.log(`   Action: ${action} (Reason: ${reason})`);
      console.log("----------------------------------------");

      return {
        categoryName: budget.category.name,
        currentLimit: limit,
        actualSpent: spent,
        suggestedLimit: suggestion,
        action: action,
        reason: reason,
      };
    });

    // Filter hanya yang ada perubahan (Action != KEEP)
    const changes = analysis.filter((a) => a.action !== "KEEP");

    // 4. Minta Pendapat AI (Groq)
    // Kita kirim hasil hitungan matematika ke AI biar dibungkus kata-kata manis
    // 🔥 DEBUG 3: Cek Apa yang Dikirim ke Groq
    const contextJson = JSON.stringify(
      {
        total_categories: analysis.length,
        proposed_changes: changes,
      },
      null,
      2
    );

    console.log("🤖 [DEBUG] PROMPT DATA KE GROQ:");
    console.log(contextJson);
    console.log("========================================");

    const aiMessage = await groqService.generateResponse(
      MONTHLY_EVALUATION_SYSTEM_PROMPT,
      contextJson
    );

    // 5. Simpan Saran ke Database
    // Simpan JSON lengkap agar Frontend bisa menampilkan tombol "Approve" per item
    await prisma.aISuggestion.create({
      data: {
        userId: userId,
        type: "MONTHLY_EVAL",
        suggestion_text: JSON.stringify({
          ai_message: aiMessage,
          changes: changes,
        }),
        is_approved: false,
      },
    });

    return {
      success: true,
      data: {
        ai_summary: aiMessage,
        details: changes,
      },
    };
  } catch (error) {
    console.error("Evaluation Error:", error);
    return { success: false, status: 500, message: "Evaluation failed" };
  }
};
