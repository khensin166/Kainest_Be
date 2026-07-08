import { logger } from "../logger/logger.js";
/**
 * Mentranskripsi buffer audio (Voice Note) menggunakan layanan Cloudflare Worker Whisper.
 * @param audioBuffer Buffer dari file audio
 * @returns Teks hasil transkripsi
 */
export const transcribeAudio = async (audioBuffer) => {
    const cfWorkerUrl = "https://kainest-ear.kenan2020oke.workers.dev";
    logger.info("Transcribing audio using Cloudflare Whisper...", { byteLength: audioBuffer.length });
    try {
        const cfResponse = await fetch(cfWorkerUrl, {
            method: "POST",
            body: audioBuffer,
            headers: {
                'Content-Type': 'application/octet-stream'
            }
        });
        const cfResult = await cfResponse.json();
        if (cfResult.status === "error" || !cfResult.text) {
            throw new Error(cfResult.message || "Gagal mentranskripsi suara");
        }
        logger.info("Transcription successful", { textLength: cfResult.text.length });
        return cfResult.text.trim();
    }
    catch (error) {
        logger.error("Cloudflare Whisper API Error", {
            error: error.message
        });
        throw new Error(error.message || "Gagal menghubungi layanan transkripsi");
    }
};
