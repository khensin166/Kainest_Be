// src/utils/gowaService.ts
import { logger } from "../infrastructure/logger/logger.js";

const GOWA_BASE_URL = process.env.GOWA_BASE_URL || "http://gowa:3000";
const GOWA_API_KEY = process.env.WA_BOT_API_KEY || process.env.GOWA_API_KEY || "";
const GOWA_DEVICE_ID = process.env.WA_BOT_DEVICE_ID || process.env.GOWA_DEVICE_ID || "";

export async function sendTextViaGowa(phone: string, message: string): Promise<void> {
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
    if (!resp.ok) {
      const text = await resp.text();
      logger.error(`[GOWA] Gagal kirim WA ke ${phone}: ${resp.status} ${text}`);
    }
  } catch (err: any) {
    logger.error(`[GOWA] Exception kirim WA ke ${phone}: ${err.message}`);
  }
}
