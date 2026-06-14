import { Groq } from "groq-sdk";
import { logger } from "../../utils/logger.js";
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});
export const groqService = {
    /**
     * Fungsi generic untuk mengirim chat ke LLM
     */
    async generateResponse(systemPrompt, userContextJson) {
        const payload = {
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
        };
        logger.info({
            message: "Sending payload to Groq AI",
            payload,
        });
        try {
            const completion = await groq.chat.completions.create(payload);
            const responseContent = completion.choices[0]?.message?.content || "Maaf, saya sedang pusing.";
            logger.info({
                message: "Received response from Groq AI",
                response: responseContent,
            });
            return responseContent;
        }
        catch (error) {
            // 🔥 UBAH BAGIAN INI UNTUK MELIHAT ERROR ASLI:
            logger.error({
                message: "❌ [DEBUG] GROQ API ERROR DETAIL",
                error: error instanceof Error ? error.message : String(error),
            });
            return "Maaf, layanan AI sedang sibuk. Coba lagi nanti.";
        }
    },
};
