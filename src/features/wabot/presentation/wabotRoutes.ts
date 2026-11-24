import { Hono } from "hono";
import { authMiddleware } from "../../auth/presentation/authMiddleware.js";
import { requireAdmin } from "../../../core/middlewares/role.middleware.js";
import { botAuthMiddleware } from "../../../infrastructure/middlewares/BotAuthMiddleware.js";
import { extractClientIp } from "../../../utils/securityHelpers.js";
import {
  saveConfigController,
  getConfigController,
  saveBotInfoController,
  getBotInfoController
} from "../services/WaBotConfigController.js";
import { addBotTransactionController } from "../services/WaBotTransactionController.js";
import { gowaWebhookController } from "../services/GowaWebhookController.js";
import {
  getActiveGroupsController,
  blastMessageController,
  getMyActiveGroupsController,
  unlinkMyGroupController,
} from "../services/BlastController.js";
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
  keyGenerator: (c) => extractClientIp(c),
});
// ==========================================
// Rute Konfigurasi User (Perlu JWT Login)
// ==========================================
wabotRoute.use("/config", authMiddleware);
wabotRoute.post("/config", saveConfigController);
wabotRoute.get("/config", getConfigController);

// Rute Grup WA Terhubung milik User (Perlu Login)
wabotRoute.use("/my-groups", authMiddleware);
wabotRoute.use("/my-groups/*", authMiddleware);
wabotRoute.get("/my-groups", getMyActiveGroupsController);
wabotRoute.delete("/my-groups/:groupId", unlinkMyGroupController);

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
wabotRoute.use("/active-groups", requireAdmin);
wabotRoute.use("/blast", requireAdmin);
wabotRoute.get("/active-groups", getActiveGroupsController);
wabotRoute.post("/blast", blastMessageController);

// ==========================================
// Rute Proxy ke GOWA Device Hub (Admin Only)
// ==========================================
wabotRoute.use("/devices", requireAdmin);
wabotRoute.use("/devices/*", requireAdmin);
wabotRoute.get("/devices", proxyGetDevices);
wabotRoute.post("/devices", proxyCreateDevice);
wabotRoute.delete("/devices/:id", proxyDeleteDevice);
wabotRoute.post("/devices/:id/logout", proxyLogoutDevice);
wabotRoute.get("/devices/:id/login", proxyGetDeviceLogin);
