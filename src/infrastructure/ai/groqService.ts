import { Groq } from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export const groqService = {
  /**
   * Fungsi generic untuk mengirim chat ke LLM
   */
  async generateResponse(systemPrompt: string, userContextJson: string) {
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `Here is the user data context: \n ${userContextJson}`,
          },
        ],
        model: "llama-3.3-70b-versatile", // Model cepat & hemat token
        temperature: 0.7, // Sedikit kreatif tapi tetap faktual
        max_tokens: 300, // Batasi agar tidak terlalu panjang (hemat waktu)
      });

      return (
        completion.choices[0]?.message?.content || "Maaf, saya sedang pusing."
      );
    } catch (error) {
      // 🔥 UBAH BAGIAN INI UNTUK MELIHAT ERROR ASLI:
      console.error("❌ [DEBUG] GROQ API ERROR DETAIL:", error);
      return "Maaf, layanan AI sedang sibuk. Coba lagi nanti.";
    }
  },
};
