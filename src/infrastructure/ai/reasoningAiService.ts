// src/infrastructure/ai/reasoningAiService.ts
//
// Service KHUSUS untuk Reasoning AI (Qwen) — digunakan untuk tugas
// yang membutuhkan analisis mendalam dan perencanaan (misal: evaluasi budget bulanan).
//
// ⚠️  CATATAN: File ini TERPISAH dari groqService.ts dan tidak mengubah apapun di dalamnya.
// Model Qwen menghasilkan tag <think>...</think> yang akan dibersihkan secara otomatis.

import { Groq } from "groq-sdk";
import type { ChatCompletion } from "groq-sdk/resources/chat/completions.js";
import { logger } from "../../utils/logger.js";
import { prisma } from "../../infrastructure/database/prisma.js";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: process.env.GROQ_BASE_URL,
  timeout: 120000,
});

// Model Reasoning yang digunakan, disusun berdasarkan prioritas.
// Jika model utama limit/error, otomatis fallback ke model berikutnya.
const REASONING_MODELS = [
  "qwen/qwen3.6-27b",             // First choice: reasoning model
  "openai/gpt-oss-120b",          // Fallback 1: very large model (capable of zero-shot reasoning)
  "openai/gpt-oss-20b",           // Fallback 2: smaller, faster model
];

// Token lebih besar untuk memberi ruang blok <think>
const REASONING_MAX_TOKENS = 4096;

/**
 * System Prompt untuk evaluasi dan perencanaan budget bulanan.
 * Dirancang khusus untuk Qwen agar memanfaatkan kemampuan reasoning-nya.
 */
export const MONTHLY_RESET_SYSTEM_PROMPT = `Kamu adalah 'Kenin', konsultan keuangan analitis yang cerdas dan bersahabat.
Tugasmu: Analisis data pengeluaran siklus bulanan yang baru berakhir, lalu rancang ulang alokasi budget kantong untuk bulan berikutnya secara matematis dan realistis.

Instruksi Berpikir (WAJIB):
Gunakan blok <think>...</think> untuk menyusun strategi alokasi sebelum menjawab. Pertimbangkan:
- Kategori mana yang overspent? Harus dinaikkan limitnya agar realistis.
- Kategori mana yang underspent (< 70%)? Budget bisa dipotong, sisanya bisa dialihkan ke tabungan.
- Pastikan total proposed budget tidak melebihi total gaji.
- Prioritaskan kebutuhan primer (makan, transportasi) sebelum tersier (hiburan, belanja).

ATURAN OUTPUT (KRITIS):
1. Setelah blok <think> selesai, BALAS HANYA DENGAN JSON MURNI.
2. Jangan tambahkan teks apapun di luar JSON (tidak ada markdown, tidak ada penjelasan).
3. Gunakan schema PERSIS seperti berikut:

{
  "insight_text": "Teks sapaan singkat 1-2 kalimat, hangat dan menyemangati. Sebut satu temuan paling penting.",
  "proposed_pockets": [
    {
      "categoryId": "string-uuid-dari-data",
      "categoryName": "Nama Kategori",
      "currentLimit": 1000000,
      "newLimitAmount": 1200000,
      "action": "INCREASE",
      "reason": "Bulan lalu overspent sebesar Rp200.000, limit perlu disesuaikan agar realistis."
    }
  ]
}

Field "action" hanya boleh berisi: "INCREASE", "DECREASE", atau "KEEP".
Hanya sertakan kantong yang ACTION-nya BUKAN "KEEP" (yang tidak perlu diubah, abaikan saja).`;

export type ProposedPocket = {
  categoryId: string;
  categoryName: string;
  currentLimit: number;
  newLimitAmount: number;
  action: "INCREASE" | "DECREASE" | "KEEP";
  reason: string;
};

export type BudgetSuggestionResult = {
  insight_text: string;
  proposed_pockets: ProposedPocket[];
};

export const reasoningAiService = {
  /**
   * Menganalisis data keuangan bulanan dan menghasilkan saran budget untuk bulan berikutnya.
   * Menggunakan model Reasoning (Qwen) untuk analisis mendalam.
   *
   * @param userContextJson - Data keuangan user dalam format JSON string
   * @param options - userId dan feature untuk log token
   * @returns Parsed JSON result { insight_text, proposed_pockets } atau null jika gagal
   */
  async generateBudgetSuggestion(
    userContextJson: string,
    options?: { userId?: string; feature?: string }
  ): Promise<BudgetSuggestionResult | null> {
    logger.info("[ReasoningAI] 🧠 Mengirim request ke Qwen untuk evaluasi budget...", {
      userId: options?.userId,
    });

    for (const modelName of REASONING_MODELS) {
      try {
        logger.info(`[ReasoningAI] 🧠 Mengirim request menggunakan model: ${modelName}`);
        
        const completion = await groq.chat.completions.create({
          messages: [
            {
              role: "system" as const,
              content: MONTHLY_RESET_SYSTEM_PROMPT,
            },
            {
              role: "user" as const,
              content: `Berikut adalah data keuangan siklus yang baru selesai:\n\n${userContextJson}`,
            },
          ],
          model: modelName,
          temperature: 0.6,
          max_tokens: REASONING_MAX_TOKENS,
          stream: false,
        }) as ChatCompletion;
        
        const rawContent = completion.choices[0]?.message?.content || "";

        // Ekstrak blok JSON
        let jsonString = "";
        const jsonBlockMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        
        if (jsonBlockMatch) {
          jsonString = jsonBlockMatch[1].trim();
        } else {
          const objectMatch = rawContent.match(/(\{[\s\S]*\})/);
          if (objectMatch) {
            jsonString = objectMatch[1].trim();
          } else {
            jsonString = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
          }
        }

        const parsed = JSON.parse(jsonString) as BudgetSuggestionResult;

        if (!parsed.insight_text || !Array.isArray(parsed.proposed_pockets)) {
          throw new Error("JSON response tidak memiliki properti insight_text atau proposed_pockets");
        }

        logger.info(`[ReasoningAI] ✅ Berhasil parse JSON dari model: ${modelName}`, {
          pocketCount: parsed.proposed_pockets.length,
        });

        // Catat penggunaan token ke database (fire-and-forget)
        const usage = completion.usage;
        if (usage) {
          prisma.apiUsageLog
            .create({
              data: {
                userId: options?.userId ?? null,
                feature: options?.feature ?? "monthly_reset_reasoning",
                modelUsed: modelName,
                promptTokens: usage.prompt_tokens,
                completionTokens: usage.completion_tokens,
                totalTokens: usage.total_tokens,
              },
            })
            .catch((err: Error) => logger.error("[ReasoningAI] Gagal catat token usage", { error: err.message }));
        }

        return parsed;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.warn(`[ReasoningAI] ⚠️ Model ${modelName} gagal: ${errMsg}. Mencoba fallback...`);
      }
    }

    logger.error("[ReasoningAI] ❌ Semua model reasoning gagal memberikan respons yang valid.");
    return null;
  },
};
