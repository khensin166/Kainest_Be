import { Hono } from "hono";
import { authMiddleware } from "../../auth/presentation/authMiddleware.js";
import {
  saveConfigController,
  getConfigController,
} from "../services/WaBotConfigController.js";

export const wabotRoute = new Hono();

// Lindungi semua rute wabot dengan authMiddleware
wabotRoute.use("*", authMiddleware);

// POST /wabot/config -> Simpan/Update konfigurasi
wabotRoute.post("/config", saveConfigController);

// GET /wabot/config -> Ambil konfigurasi
wabotRoute.get("/config", getConfigController);
