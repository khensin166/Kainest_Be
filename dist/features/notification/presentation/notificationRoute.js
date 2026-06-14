import { Hono } from "hono";
import { authMiddleware } from "../../auth/presentation/authMiddleware.js";
import { getNotificationsController, markReadController } from "../services/notificationController.js";
export const notificationRoute = new Hono();
notificationRoute.use("*", authMiddleware);
// GET /notifications - ambil notifikasi user
notificationRoute.get("/", getNotificationsController);
// PATCH /notifications/:id/read - tandai satu notifikasi sudah dibaca
notificationRoute.patch("/:id/read", markReadController);
