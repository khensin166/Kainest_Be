import { Hono } from "hono";
import { authMiddleware } from "../../auth/presentation/authMiddleware.js";
import { getUploadSignatureController } from "../services/uploadController.js";
export const uploadRoute = new Hono();
// Lindungi semua endpoint upload dengan authMiddleware
uploadRoute.use("*", authMiddleware);
// POST /upload/signature
// Body: { "folder": "kainest_notes" }
uploadRoute.post("/signature", getUploadSignatureController);
