import { Hono } from "hono";
import { authMiddleware } from "../../auth/presentation/authMiddleware.js";
import { botAuthMiddleware } from "../../../infrastructure/middlewares/BotAuthMiddleware.js";
import {
  saveConfigController,
  getConfigController,
  saveBotInfoController,
  getBotInfoController
} from "../services/WaBotConfigController.js";
import { addBotTransactionController } from "../services/WaBotTransactionController.js";
import { gowaWebhookController } from "../services/GowaWebhookController.js";
import { getActiveGroupsController, blastMessageController } from "../services/BlastController.js";
import {
  proxyGetDevices,
  proxyCreateDevice,
  proxyDeleteDevice,
  proxyLogoutDevice,
  proxyGetDeviceLogin
} from "../services/DeviceProxyController.js";

import { rateLimiter } from 'hono-rate-limiter';
export const wabotRoute = new Hono();

// Rate limiter khusus webhook (100 request per menit)
const webhookRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 menit
  limit: 100, // Limit 100 request
  standardHeaders: "draft-6",
  keyGenerator: (c) => {
    return c.req.header('x-forwarded-for') || (c.env as any)?.REMOTE_ADDR || "anonymous";
  }
});
// ==========================================
// Rute Konfigurasi User (Perlu JWT Login)
// ==========================================
wabotRoute.use("/config", authMiddleware);
wabotRoute.post("/config", saveConfigController);
wabotRoute.get("/config", getConfigController);

// ==========================================
// Rute Info Bot Global
// ==========================================
// GET info bersifat publik / tidak butuh auth ketat agar frontend mudah akses
wabotRoute.get("/info", getBotInfoController);
// POST info butuh API key karena diakses oleh bot
wabotRoute.post("/info", botAuthMiddleware, saveBotInfoController);

// ==========================================
// Rute Webhook dari n8n/Bot (Perlu API Key)
// ==========================================
wabotRoute.post("/transactions", webhookRateLimiter, botAuthMiddleware, addBotTransactionController);

// ==========================================
// Rute Webhook dari GOWA
// ==========================================
// Endpoint ini yang akan dipanggil oleh GOWA setiap ada pesan masuk
wabotRoute.post("/webhook/gowa", webhookRateLimiter, gowaWebhookController);

// ==========================================
// Rute Blast Message & Active Groups (Admin Only)
// ==========================================
wabotRoute.use("/active-groups", authMiddleware);
wabotRoute.use("/blast", authMiddleware);
wabotRoute.get("/active-groups", getActiveGroupsController);
wabotRoute.post("/blast", blastMessageController);

// ==========================================
// Rute Proxy ke GOWA Device Hub (Admin Only)
// ==========================================
wabotRoute.use("/devices", authMiddleware);
wabotRoute.use("/devices/*", authMiddleware);
wabotRoute.get("/devices", proxyGetDevices);
wabotRoute.post("/devices", proxyCreateDevice);
wabotRoute.delete("/devices/:id", proxyDeleteDevice);
wabotRoute.post("/devices/:id/logout", proxyLogoutDevice);
wabotRoute.get("/devices/:id/login", proxyGetDeviceLogin);
