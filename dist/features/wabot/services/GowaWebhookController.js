// GowaWebhookController.ts
// Menerima Webhook dari GOWA dan meneruskannya ke processBotTransactionUseCase
// GOWA Webhook Payload format: https://github.com/aldinokemal/go-whatsapp-web-multidevice
import { processBotTransactionUseCase } from "../domain/use-cases/ProcessBotTransactionUseCase.js";
import { logger } from "../../../infrastructure/logger/logger.js";
// URL & API Key GOWA (diambil dari .env, isi saat deploy di VPS)
const GOWA_BASE_URL = process.env.GOWA_BASE_URL || "http://gowa:3000";
const GOWA_API_KEY = process.env.WA_BOT_API_KEY || process.env.GOWA_API_KEY || "";
const GOWA_DEVICE_ID = process.env.WA_BOT_DEVICE_ID || process.env.GOWA_DEVICE_ID || "079cae22-efa6-4089-8049-1d1dad483e56";
const STAGING_ALLOWED_NUMBERS = (process.env.STAGING_ALLOWED_NUMBERS || "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
const BOT_ENV_MODE = process.env.BOT_ENV_MODE || "production";
// ─────────────────────────────────────────────────────────────────────────────
// Helper: Kirim pesan teks balik ke GOWA
// ─────────────────────────────────────────────────────────────────────────────
async function sendTextViaGowa(phone, message) {
    const url = `${GOWA_BASE_URL}/send/message`;
    const body = { phone, message };
    const resp = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Device-Id": GOWA_DEVICE_ID,
            ...(GOWA_API_KEY ? { Authorization: `Basic ${GOWA_API_KEY}` } : {}),
        },
        body: JSON.stringify(body),
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`GOWA send failed [${resp.status}]: ${text}`);
    }
    logger.debug("Outgoing text via GOWA", { phone, status: resp.status });
}
// ─────────────────────────────────────────────────────────────────────────────
// Helper: Kirim reaksi emoji balik ke GOWA
// ─────────────────────────────────────────────────────────────────────────────
async function sendReactionViaGowa(phone, messageId, emoji) {
    const url = `${GOWA_BASE_URL}/message/${messageId}/reaction`;
    const body = { phone, emoji };
    const resp = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Device-Id": GOWA_DEVICE_ID,
            ...(GOWA_API_KEY ? { Authorization: `Basic ${GOWA_API_KEY}` } : {}),
        },
        body: JSON.stringify(body),
    });
    if (!resp.ok) {
        const text = await resp.text();
        logger.warn("GOWA reaction failed (non-fatal)", { phone, emoji, status: resp.status, error: text });
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Helper: Kirim status "typing" (Mengetik)
// ─────────────────────────────────────────────────────────────────────────────
async function sendPresenceViaGowa(phone, action) {
    const url = `${GOWA_BASE_URL}/send/chat-presence`;
    const body = { phone, action };
    const resp = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Device-Id": GOWA_DEVICE_ID,
            ...(GOWA_API_KEY ? { Authorization: `Basic ${GOWA_API_KEY}` } : {}),
        },
        body: JSON.stringify(body),
    });
    if (!resp.ok) {
        const text = await resp.text();
        logger.warn("GOWA presence failed", { phone, action, error: text });
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Controller Utama
// ─────────────────────────────────────────────────────────────────────────────
export const gowaWebhookController = async (c) => {
    const startTime = Date.now();
    let senderPhone = "unknown";
    try {
        // 1. Parsing payload dari GOWA v8.9
        // Struktur baru: { event, device_id, payload: { id, from, body, chat_id, is_from_me, timestamp } }
        const payload = await c.req.json();
        const data = payload.payload || {};
        const event = payload.event || payload.Event || "";
        const senderRaw = data.from || payload.sender || payload.from || "";
        const messageId = data.id || payload.message_id || payload.MessageID || "";
        const textBody = data.body || payload.text || payload.message || "";
        const isFromMe = data.is_from_me || payload.is_from_me || payload.IsFromMe || false;
        // Deteksi Voice Note (Audio)
        const isAudio = !!data.audio || data.original_media_type === "audio" || data.type === "audio" || !!data.video_note;
        const hasText = !!textBody && textBody.trim().length > 0;
        // Normalkan nomor telepon (hilangkan suffix WA dan kode negara prefix 0)
        senderPhone = senderRaw
            .replace("@s.whatsapp.net", "")
            .replace("@c.us", "")
            .replace("@lid", "");
        // Tentukan groupId (GOWA v8.9 menyertakannya di chat_id)
        const groupId = (data.chat_id && data.chat_id.endsWith("@g.us")) ? data.chat_id : (payload.group_id || payload.GroupID || undefined);
        // Tentukan timestamp
        const timestamp = data.timestamp ? Math.floor(new Date(data.timestamp).getTime() / 1000) : Math.floor(Date.now() / 1000);
        logger.debug("Incoming Webhook from GOWA", {
            event,
            sender: senderPhone,
            group: groupId || "personal",
            text_preview: textBody.substring(0, 60),
            latency_pre: `${Date.now() - startTime}ms`,
        });
        // 2. Abaikan pesan dari diri sendiri (bot)
        if (isFromMe) {
            logger.debug("Ignored own message (is_from_me=true)", { sender: senderPhone });
            return c.json({ success: true, ignored: true });
        }
        // 3. Abaikan event yang bukan pesan teks
        if (event !== "message" && event !== "text" && event !== "Message") {
            logger.debug("Ignored non-message event", { event });
            return c.json({ success: true, ignored: true, reason: "non-message event" });
        }
        // 4. Abaikan pesan kosong (stiker/gambar tanpa caption) jika bukan pesan audio
        if (!hasText && !isAudio) {
            logger.debug("Ignored empty message body and non-audio", { sender: senderPhone });
            return c.json({ success: true, ignored: true, reason: "empty body" });
        }
        // 5. Staging Safe Mode — hanya respons nomor admin & prefix !dev
        if (BOT_ENV_MODE === "staging") {
            const isAllowed = STAGING_ALLOWED_NUMBERS.some((n) => senderPhone.endsWith(n) || n.endsWith(senderPhone));
            if (!isAllowed) {
                logger.debug("Staging: silent ignore (not allowed number)", { sender: senderPhone });
                return c.json({ success: true, ignored: true, reason: "staging_not_allowed" });
            }
            // Lepas prefix !dev jika ada (pengecualian untuk pesan audio karena tidak bisa diberi prefix teks)
            if (!isAudio && !textBody.toLowerCase().startsWith("!dev ")) {
                logger.debug("Staging: silent ignore (missing !dev prefix)", { sender: senderPhone });
                return c.json({ success: true, ignored: true, reason: "staging_missing_prefix" });
            }
            // textBody sudah di-strip di use case — kita kirim tanpa prefix ke downstream
        }
        // 5. Pemrosesan Asinkron (Background) agar GOWA tidak Timeout
        // Kita jalankan sisa proses tanpa await, dan langsung return 200 OK ke GOWA
        const runBackground = async () => {
            try {
                // 6. Kirim reaksi ⏳ ke pengirim sebagai tanda "sedang diproses"
                if (messageId) {
                    const replyTarget = groupId || `${senderPhone}@s.whatsapp.net`;
                    await sendReactionViaGowa(replyTarget, messageId, "⏳").catch(() => { });
                }
                // 7. Proses pesan menggunakan logic backend yang sudah ada
                let processedText = textBody;
                if (BOT_ENV_MODE === "staging" && !isAudio) {
                    processedText = textBody.slice("!dev ".length).trim();
                }
                let type = "text";
                let audioBuffer;
                if (isAudio) {
                    type = "audio";
                    try {
                        // Gunakan API GOWA untuk mendownload media
                        const downloadUrl = `${GOWA_BASE_URL}/message/${messageId}/download`;
                        const resp = await fetch(downloadUrl, {
                            headers: {
                                "X-Device-Id": GOWA_DEVICE_ID,
                                ...(GOWA_API_KEY ? { Authorization: `Basic ${GOWA_API_KEY}` } : {}),
                            }
                        });
                        if (resp.ok) {
                            const resJson = await resp.json();
                            if (resJson.data && resJson.data.url) {
                                // Fetch dari URL public yang diberikan GOWA
                                const fileResp = await fetch(resJson.data.url);
                                if (fileResp.ok) {
                                    const arrayBuffer = await fileResp.arrayBuffer();
                                    audioBuffer = Buffer.from(arrayBuffer);
                                }
                            }
                        }
                        else {
                            logger.warn("Failed to download media from GOWA", { status: resp.status, text: await resp.text() });
                        }
                    }
                    catch (e) {
                        logger.error("Error downloading audio", { error: e.message });
                    }
                }
                const result = await processBotTransactionUseCase({
                    type,
                    text: processedText,
                    audioBuffer,
                    sender: senderRaw,
                    groupId,
                    timestamp, // ✅ RFC3339 GOWA v8.9
                });
                const latencyMs = Date.now() - startTime;
                // 8. Tangani hasil: ignored (silent)
                if (result.isIgnored) {
                    const reason = result.ignoreReason || "unknown";
                    logger.debug(`Silent ignore (${reason})`, {
                        sender: senderPhone,
                        group: groupId || "personal",
                        latency_ms: latencyMs,
                    });
                    return; // Selesai
                }
                // 9. Tangani hasil: gagal (bukan transaksi / nominal 0 / user belum terdaftar)
                if (!result.success) {
                    logger.warn("processBotTransaction rejected", {
                        sender: senderRaw,
                        groupId,
                        timestamp,
                        message: result.message,
                        latency_ms: latencyMs,
                    });
                    // Kirim reaksi dinamis (default: ❓ untuk gagal biasa, ⚠️ untuk peringatan)
                    const replyTarget = groupId || `${senderPhone}@s.whatsapp.net`;
                    const failReaction = result.reaction || "❓";
                    if (messageId)
                        await sendReactionViaGowa(replyTarget, messageId, failReaction).catch(() => { });
                    // Izinkan membalas teks JIKA flag replyText = true (contoh: pesan peringatan grup belum daftar)
                    if (result.replyText && result.message) {
                        await sendPresenceViaGowa(replyTarget, "start").catch(() => { });
                        await new Promise((r) => setTimeout(r, 1500));
                        await sendTextViaGowa(replyTarget, result.message).catch(() => { });
                    }
                    return; // Selesai
                }
                // 10. Sukses — kirim reaksi ✅ (atau reaksi custom dari usecase, misal 👀) dan teks balasan
                const replyTarget = groupId || `${senderPhone}@s.whatsapp.net`;
                const successReaction = result.reaction || "✅";
                if (messageId)
                    await sendReactionViaGowa(replyTarget, messageId, successReaction).catch(() => { });
                // Jika ada balasan pesan dan (bukan karena sapaan kosong, atau jika dipaksa replyText)
                if (result.data?.message && (!result.isIgnored || result.replyText)) {
                    // Universal Typing Delay (1.5s) Anti-Banned & E2EE Fix
                    await sendPresenceViaGowa(replyTarget, "start").catch(() => { });
                    await new Promise((r) => setTimeout(r, 1500));
                    await sendTextViaGowa(replyTarget, result.data.message).catch((e) => logger.error("Failed to send success reply via GOWA", { error: e.message }));
                }
                logger.debug("Transaction processed successfully", {
                    sender: senderPhone,
                    group: groupId || "personal",
                    transaction_id: result.data?.transaction?.id,
                    latency_ms: latencyMs,
                });
            }
            catch (err) {
                logger.error("Background webhook processing failed", {
                    sender: senderPhone,
                    error: err.message,
                });
            }
        };
        // Jalankan background job
        runBackground();
        // Langsung return 200 OK ke GOWA (Mencegah "context deadline exceeded" / Timeout Retry)
        return c.json({ success: true, status: "processing_in_background" }, 200);
    }
    catch (error) {
        logger.error("GowaWebhookController unhandled error", {
            sender: senderPhone,
            error: error.message,
            stack: error.stack?.split("\n")[0],
        });
        return c.json({ success: false, message: "Internal Server Error" }, 500);
    }
};
