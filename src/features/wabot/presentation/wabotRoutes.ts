import { Hono } from "hono";
import { authMiddleware } from "../../auth/presentation/authMiddleware.js";
import { botAuthMiddleware } from "../../../infrastructure/middlewares/BotAuthMiddleware.js";
import {
  saveConfigController,
  getConfigController,
} from "../services/WaBotConfigController.js";
import { addBotTransactionController } from "../services/WaBotTransactionController.js";

export const wabotRoute = new Hono();

// ==========================================
// Rute Konfigurasi User (Perlu JWT Login)
// ==========================================
wabotRoute.use("/config", authMiddleware);
wabotRoute.post("/config", saveConfigController);
wabotRoute.get("/config", getConfigController);

// ==========================================
// Rute Webhook dari n8n/Bot (Perlu API Key)
// ==========================================
wabotRoute.post("/transactions", botAuthMiddleware, addBotTransactionController);
