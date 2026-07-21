// BlastController.ts
// Controller untuk mengelola daftar grup aktif dan mengirim blast message ke semua grup terdaftar

import { Context } from "hono";
import { prisma } from "../../../infrastructure/database/prisma.js";
import { logger } from "../../../infrastructure/logger/logger.js";

// URL & API Key GOWA (diambil dari .env)
const GOWA_BASE_URL = process.env.GOWA_BASE_URL || "http://gowa:3000";
const GOWA_API_KEY = process.env.WA_BOT_API_KEY || process.env.GOWA_API_KEY || "";
const GOWA_DEVICE_ID = process.env.WA_BOT_DEVICE_ID || process.env.GOWA_DEVICE_ID || "";

/**
 * Helper: Kirim pesan teks ke grup via GOWA
 */
async function sendGroupMessageViaGowa(groupId: string, message: string): Promise<void> {
  const url = `${GOWA_BASE_URL}/send/message`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Device-Id": GOWA_DEVICE_ID,
      ...(GOWA_API_KEY ? { Authorization: `Basic ${GOWA_API_KEY}` } : {}),
    },
    body: JSON.stringify({ phone: groupId, message }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GOWA send failed [${resp.status}]: ${text}`);
  }
}

/**
 * GET /api/wabot/active-groups
 * Mengembalikan daftar semua grup aktif beserta info user yang mendaftarkannya.
 * Hanya bisa diakses oleh Admin/Super Admin.
 */
export const getActiveGroupsController = async (c: Context) => {
  try {
    const groups = await prisma.botActiveGroup.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = groups.map((g) => ({
      id: g.id,
      groupId: g.groupId,
      createdAt: g.createdAt,
      linkedBy: g.user
        ? { id: g.user.id, name: g.user.name, email: g.user.email }
        : null,
      needsRelink: !g.userId,
    }));

    return c.json({
      success: true,
      total: result.length,
      data: result,
    });
  } catch (error: any) {
    logger.error("[GetActiveGroups] Error:", error.message);
    return c.json({ success: false, message: "Gagal mengambil data grup aktif" }, 500);
  }
};

/**
 * POST /api/wabot/blast
 * Mengirim blast message ke grup-grup yang dipilih.
 * Body: { message: string, groupIds: string[] }
 * Hanya bisa diakses oleh Admin/Super Admin.
 */
export const blastMessageController = async (c: Context) => {
  const body = await c.req.json().catch(() => null);

  if (!body || !body.message || !Array.isArray(body.groupIds) || body.groupIds.length === 0) {
    return c.json({ success: false, message: "Field 'message' dan 'groupIds' (array) wajib diisi." }, 400);
  }

  const { message, groupIds } = body as { message: string; groupIds: string[] };

  logger.info(`[Blast] Memulai blast ke ${groupIds.length} grup. Preview pesan: "${message.substring(0, 80)}..."`);

  let successCount = 0;
  let failCount = 0;
  const failedGroups: string[] = [];

  for (const groupId of groupIds) {
    try {
      await sendGroupMessageViaGowa(groupId, message);
      successCount++;
      logger.info(`[Blast] ✅ Berhasil kirim ke grup: ${groupId}`);
    } catch (err: any) {
      failCount++;
      failedGroups.push(groupId);
      logger.error(`[Blast] ❌ Gagal kirim ke grup ${groupId}: ${err.message}`);
    }

    // Jeda aman 1.5 detik antar pengiriman untuk mencegah rate-limiting WhatsApp
    if (groupIds.indexOf(groupId) < groupIds.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  logger.info(`[Blast] Selesai. Berhasil: ${successCount}, Gagal: ${failCount}`);

  return c.json({
    success: true,
    message: `Blast selesai! Berhasil: ${successCount} grup, Gagal: ${failCount} grup.`,
    summary: {
      total: groupIds.length,
      success: successCount,
      failed: failCount,
      failedGroups,
    },
  });
};
