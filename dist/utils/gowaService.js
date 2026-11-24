// src/utils/gowaService.ts
import { logger } from "../infrastructure/logger/logger.js";
const GOWA_BASE_URL = process.env.GOWA_BASE_URL || "http://gowa:3000";
const GOWA_API_KEY = process.env.WA_BOT_API_KEY || process.env.GOWA_API_KEY || "";
const GOWA_DEVICE_ID = process.env.WA_BOT_DEVICE_ID || process.env.GOWA_DEVICE_ID || "";
export async function sendTextViaGowaWithResult(phone, message) {
    const url = `${GOWA_BASE_URL}/send/message`;
    try {
        const resp = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Device-Id": GOWA_DEVICE_ID,
                ...(GOWA_API_KEY ? { Authorization: `Basic ${GOWA_API_KEY}` } : {}),
            },
            body: JSON.stringify({ phone, message }),
        });
        const text = await resp.text();
        if (!resp.ok) {
            logger.error(`[GOWA] Gagal kirim WA ke ${phone}: ${resp.status} ${text}`);
            return { ok: false, status: resp.status, body: text, error: `HTTP ${resp.status}: ${text}` };
        }
        return { ok: true, status: resp.status, body: text };
    }
    catch (err) {
        logger.error(`[GOWA] Exception kirim WA ke ${phone}: ${err.message}`);
        return { ok: false, error: err?.message || String(err) };
    }
}
export async function sendTextViaGowa(phone, message) {
    await sendTextViaGowaWithResult(phone, message);
}
/**
 * Mengambil nama grup WhatsApp dari GOWA (`GET /group/info?group_id=...`).
 * Mengembalikan null jika GOWA gagal/timeout agar tidak mengganggu alur utama.
 */
export async function getGroupNameViaGowa(groupId) {
    if (!groupId || !groupId.endsWith("@g.us"))
        return null;
    const baseUrl = process.env.GOWA_BASE_URL || GOWA_BASE_URL;
    const apiKey = process.env.WA_BOT_API_KEY || process.env.GOWA_API_KEY || GOWA_API_KEY;
    const deviceId = process.env.WA_BOT_DEVICE_ID || process.env.GOWA_DEVICE_ID || GOWA_DEVICE_ID;
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const url = `${baseUrl}/group/info?group_id=${encodeURIComponent(groupId)}`;
        const resp = await fetch(url, {
            method: "GET",
            headers: {
                ...(deviceId ? { "X-Device-Id": deviceId } : {}),
                ...(apiKey ? { Authorization: `Basic ${apiKey}` } : {}),
            },
            signal: controller.signal,
        });
        clearTimeout(timer);
        if (!resp.ok)
            return null;
        const json = await resp.json().catch(() => null);
        const info = json?.results || json?.data || json;
        const name = info?.Name || info?.name || info?.Subject || info?.subject || null;
        return typeof name === "string" && name.trim().length > 0 ? name.trim() : null;
    }
    catch (err) {
        logger.debug(`[GOWA] Gagal mengambil nama grup ${groupId}: ${err?.message || err}`);
        return null;
    }
}
