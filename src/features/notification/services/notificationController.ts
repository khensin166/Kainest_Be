import type { Context } from "hono";
import { prisma } from "../../../infrastructure/database/prisma.js";
import { logger } from "../../../infrastructure/logger/logger.js";

/**
 * GET /notifications
 * Ambil semua notifikasi milik user yang login, terbaru dulu.
 */
export async function getNotificationsController(c: Context) {
  try {
    const userId = c.get("userId") as string;
    const limit = Number(c.req.query("limit") ?? 20);

    const notifications = await prisma.appNotification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const unreadCount = await prisma.appNotification.count({
      where: { userId, isRead: false },
    });

    return c.json({ notifications, unreadCount });
  } catch (error: any) {
    logger.error("[Notification] Error fetching:", { error: error.message });
    return c.json({ error: "Gagal mengambil notifikasi" }, 500);
  }
}

/**
 * PATCH /notifications/:id/read
 * Tandai notifikasi sebagai sudah dibaca.
 */
export async function markReadController(c: Context) {
  try {
    const userId = c.get("userId") as string;
    const { id } = c.req.param();

    const notification = await prisma.appNotification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      return c.json({ error: "Notifikasi tidak ditemukan" }, 404);
    }

    await prisma.appNotification.update({
      where: { id },
      data: { isRead: true },
    });

    return c.json({ success: true });
  } catch (error: any) {
    logger.error("[Notification] Error marking read:", { error: error.message });
    return c.json({ error: "Gagal update status notifikasi" }, 500);
  }
}
