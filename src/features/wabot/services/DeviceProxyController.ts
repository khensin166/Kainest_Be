import { Context } from "hono";
import { logger } from "../../../infrastructure/logger/logger.js";

// URL & API Key GOWA (diambil dari .env)
// WA_BOT_API_KEY diasumsikan sudah dalam format Base64 siap pakai (misal: a2FpemVudDpCcmVAa3Rocm91Z2gyMzIx)
const GOWA_BASE_URL = process.env.GOWA_BASE_URL || "https://gowa.kenantomfie.com";
const GOWA_API_KEY = process.env.WA_BOT_API_KEY || process.env.GOWA_API_KEY || "";

const getGowaHeaders = () => ({
  "Content-Type": "application/json",
  ...(GOWA_API_KEY ? { Authorization: `Basic ${GOWA_API_KEY}` } : {}),
});

/**
 * Helper: Parsing respons dari GOWA secara aman.
 * GOWA terkadang mengembalikan teks biasa (misal "Unauthorized") bukan JSON.
 */
const safeParseGowa = async (resp: Response) => {
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    // Bukan JSON, kembalikan sebagai object pesan agar tidak crash
    logger.warn(`[GOWA Proxy] Respons bukan JSON (status ${resp.status}): ${text}`);
    return { success: false, message: text, status: resp.status };
  }
};

/**
 * Proxy: GET /devices → GOWA GET /devices
 */
export const proxyGetDevices = async (c: Context) => {
  try {
    const resp = await fetch(`${GOWA_BASE_URL}/devices`, {
      method: "GET",
      headers: getGowaHeaders(),
    });
    const data = await safeParseGowa(resp);
    return c.json(data, resp.status as any);
  } catch (error: any) {
    logger.error("[GOWA Proxy] proxyGetDevices error:", error.message);
    return c.json({ success: false, message: error.message }, 500);
  }
};

/**
 * Proxy: POST /devices → GOWA POST /devices
 */
export const proxyCreateDevice = async (c: Context) => {
  try {
    const body = await c.req.json();
    const resp = await fetch(`${GOWA_BASE_URL}/devices`, {
      method: "POST",
      headers: getGowaHeaders(),
      body: JSON.stringify(body),
    });
    const data = await safeParseGowa(resp);
    return c.json(data, resp.status as any);
  } catch (error: any) {
    logger.error("[GOWA Proxy] proxyCreateDevice error:", error.message);
    return c.json({ success: false, message: error.message }, 500);
  }
};

/**
 * Proxy: DELETE /devices/:id → GOWA DELETE /devices/:id
 */
export const proxyDeleteDevice = async (c: Context) => {
  try {
    const id = c.req.param("id");
    const resp = await fetch(`${GOWA_BASE_URL}/devices/${id}`, {
      method: "DELETE",
      headers: getGowaHeaders(),
    });
    const data = await safeParseGowa(resp);
    return c.json(data, resp.status as any);
  } catch (error: any) {
    logger.error("[GOWA Proxy] proxyDeleteDevice error:", error.message);
    return c.json({ success: false, message: error.message }, 500);
  }
};

/**
 * Proxy: POST /devices/:id/logout → GOWA POST /devices/:id/logout
 */
export const proxyLogoutDevice = async (c: Context) => {
  try {
    const id = c.req.param("id");
    const resp = await fetch(`${GOWA_BASE_URL}/devices/${id}/logout`, {
      method: "POST",
      headers: getGowaHeaders(),
    });
    const data = await safeParseGowa(resp);
    return c.json(data, resp.status as any);
  } catch (error: any) {
    logger.error("[GOWA Proxy] proxyLogoutDevice error:", error.message);
    return c.json({ success: false, message: error.message }, 500);
  }
};

/**
 * Proxy: GET /devices/:id/login (QR Code) → GOWA GET /devices/:id/login
 */
export const proxyGetDeviceLogin = async (c: Context) => {
  try {
    const id = c.req.param("id");
    const resp = await fetch(`${GOWA_BASE_URL}/devices/${id}/login`, {
      method: "GET",
      headers: getGowaHeaders(),
    });
    const data = await safeParseGowa(resp);
    return c.json(data, resp.status as any);
  } catch (error: any) {
    logger.error("[GOWA Proxy] proxyGetDeviceLogin error:", error.message);
    return c.json({ success: false, message: error.message }, 500);
  }
};
