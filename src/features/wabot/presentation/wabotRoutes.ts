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

export const wabotRoute = new Hono();

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
wabotRoute.post("/transactions", botAuthMiddleware, addBotTransactionController);

// ==========================================
// Rute Webhook dari GOWA
// ==========================================
// Endpoint ini yang akan dipanggil oleh GOWA setiap ada pesan masuk
wabotRoute.post("/webhook/gowa", gowaWebhookController);

// ==========================================
// Rute Blast Message & Active Groups (Admin Only)
// ==========================================
wabotRoute.use("/active-groups", authMiddleware);
wabotRoute.use("/blast", authMiddleware);
wabotRoute.get("/active-groups", getActiveGroupsController);
wabotRoute.post("/blast", blastMessageController);
