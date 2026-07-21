import { Context } from "hono";
import { logger } from "../../../infrastructure/logger/logger.js";

// URL & API Key GOWA (diambil dari .env)
const GOWA_BASE_URL = process.env.GOWA_BASE_URL || "https://gowa.kenantomfie.com";
const GOWA_API_KEY = process.env.WA_BOT_API_KEY || process.env.GOWA_API_KEY || "YWRtaW46YWRtaW4=";

const getGowaHeaders = () => {
  return {
    "Content-Type": "application/json",
    ...(GOWA_API_KEY ? { Authorization: `Basic ${GOWA_API_KEY}` } : {}),
  };
};

/**
 * Proxy: GET /devices
 */
export const proxyGetDevices = async (c: Context) => {
  try {
    const url = `${GOWA_BASE_URL}/devices`;
    const resp = await fetch(url, {
      method: "GET",
      headers: getGowaHeaders(),
    });
    const data = await resp.json();
    return c.json(data, resp.status as any);
  } catch (error: any) {
    logger.error("Error proxyGetDevices:", error);
    return c.json({ error: error.message }, 500);
  }
};

/**
 * Proxy: POST /devices
 */
export const proxyCreateDevice = async (c: Context) => {
  try {
    const body = await c.req.json();
    const url = `${GOWA_BASE_URL}/devices`;
    const resp = await fetch(url, {
      method: "POST",
      headers: getGowaHeaders(),
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    return c.json(data, resp.status as any);
  } catch (error: any) {
    logger.error("Error proxyCreateDevice:", error);
    return c.json({ error: error.message }, 500);
  }
};

/**
 * Proxy: DELETE /devices/:id
 */
export const proxyDeleteDevice = async (c: Context) => {
  try {
    const id = c.req.param("id");
    const url = `${GOWA_BASE_URL}/devices/${id}`;
    const resp = await fetch(url, {
      method: "DELETE",
      headers: getGowaHeaders(),
    });
    const data = await resp.json();
    return c.json(data, resp.status as any);
  } catch (error: any) {
    logger.error("Error proxyDeleteDevice:", error);
    return c.json({ error: error.message }, 500);
  }
};

/**
 * Proxy: POST /devices/:id/logout
 */
export const proxyLogoutDevice = async (c: Context) => {
  try {
    const id = c.req.param("id");
    const url = `${GOWA_BASE_URL}/devices/${id}/logout`;
    const resp = await fetch(url, {
      method: "POST",
      headers: getGowaHeaders(),
    });
    const data = await resp.json();
    return c.json(data, resp.status as any);
  } catch (error: any) {
    logger.error("Error proxyLogoutDevice:", error);
    return c.json({ error: error.message }, 500);
  }
};

/**
 * Proxy: GET /devices/:id/login (QR Code)
 */
export const proxyGetDeviceLogin = async (c: Context) => {
  try {
    const id = c.req.param("id");
    const url = `${GOWA_BASE_URL}/devices/${id}/login`;
    const resp = await fetch(url, {
      method: "GET",
      headers: getGowaHeaders(),
    });
    const data = await resp.json();
    return c.json(data, resp.status as any);
  } catch (error: any) {
    logger.error("Error proxyGetDeviceLogin:", error);
    return c.json({ error: error.message }, 500);
  }
};
