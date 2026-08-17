import { Groq } from "groq-sdk";
import type { ChatCompletion } from "groq-sdk/resources/chat/completions.js";
import { logger } from "../../utils/logger.js";
import { prisma } from "../../infrastructure/database/prisma.js";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Daftar model prioritas fallback.
 * Sistem mencoba model pertama, jika gagal otomatis mencoba model berikutnya.
 * Prioritas: qwen (limit terbesar) → gpt-oss-120b → gpt-oss-20b → gpt-oss-safeguard-20b
 */
const FALLBACK_MODELS = [
  "qwen/qwen3.6-27b",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-safeguard-20b",
];

export const groqService = {
  /**
   * Fungsi generic untuk mengirim chat ke LLM.
   * Menggunakan mekanisme fallback model otomatis dan mencatat penggunaan token ke database.
   *
   * @param systemPrompt - Instruksi sistem untuk LLM
   * @param userContextJson - Konteks data user sebagai string
   * @param options - Opsi tambahan: userId untuk pelacakan token, feature untuk label log
   */
  async generateResponse(
    systemPrompt: string,
    userContextJson: string,
    options?: { userId?: string; feature?: string }
  ): Promise<string> {
    const baseMessages = [
      {
        role: "system" as const,
        content: systemPrompt,
      },
      {
        role: "user" as const,
        content: `Here is the user data context: \n ${userContextJson}`,
      },
    ];

    let completion: ChatCompletion | null = null;
    let usedModel = "";

    // Iterasi setiap model dalam daftar fallback
    for (const modelName of FALLBACK_MODELS) {
      try {
        logger.debug({ message: `[GroqService] Mencoba model: ${modelName}` });

        completion = await groq.chat.completions.create({
          messages: baseMessages,
          model: modelName,
          temperature: 0.7,
          max_tokens: 1024, // Reasoning models butuh token lebih untuk blok <think>
          stream: false,
        }) as ChatCompletion;

        usedModel = modelName;
        logger.info({ message: `[GroqService] ✅ Berhasil menggunakan model: ${modelName}` });
        break; // Sukses → keluar dari loop
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.warn({
          message: `[GroqService] ⚠️ Model ${modelName} gagal, mencoba selanjutnya...`,
          error: errMsg,
        });
        // Lanjut ke model berikutnya
      }
    }

    // Jika semua model gagal
    if (!completion) {
      logger.error({ message: "[GroqService] ❌ Semua model AI gagal digunakan." });
      return "Maaf, layanan AI sedang sibuk. Coba lagi nanti.";
    }

    const rawContent = completion.choices[0]?.message?.content || "";

    // Strip blok <think>...</think> dari model reasoning (Qwen, DeepSeek, dll).
    // Kasus 1: Tag lengkap <think>...</think>
    // Kasus 2: Tag terpotong karena token limit — buang semua setelah <think> yang tidak tertutup
    const responseContent = rawContent
      .replace(/<think>[\s\S]*?<\/think>/g, "")
      .replace(/<think>[\s\S]*/g, "")
      .trim() || "Maaf, saya sedang pusing.";

    logger.debug({
      message: "[GroqService] Received response from Groq AI",
      response: responseContent,
    });

    // Catat penggunaan token ke database (fire-and-forget, tidak memblokir respons)
    const usage = completion.usage;
    if (usage) {
      prisma.apiUsageLog
        .create({
          data: {
            userId: options?.userId ?? null,
            feature: options?.feature ?? "unknown",
            modelUsed: usedModel,
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          },
        })
        .catch((err) => {
          logger.warn({
            message: "[GroqService] Gagal menyimpan log token ke database",
            error: err instanceof Error ? err.message : String(err),
          });
        });
    }

    return responseContent;
  },
};
