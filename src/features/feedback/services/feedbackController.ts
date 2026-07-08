import type { Context } from "hono";
import { prisma } from "../../../infrastructure/database/prisma.js";
import { logger } from "../../../infrastructure/logger/logger.js";

/**
 * GET /feedbacks
 * Ambil semua feedback yang isVisible = true, untuk ditampilkan di Dashboard.
 */
export async function getFeedbacksController(c: Context) {
  try {
    const limit = Number(c.req.query("limit") ?? 50);

    const feedbacks = await prisma.userFeedback.findMany({
      where: { isVisible: true },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: {
          select: {
            name: true,
            image: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    return c.json({ feedbacks });
  } catch (error: any) {
    logger.error("[Feedback] Error fetching:", { error: error.message });
    return c.json({ error: "Gagal mengambil feedback" }, 500);
  }
}

/**
 * POST /feedbacks
 * User mengirimkan feedback baru.
 */
export async function createFeedbackController(c: Context) {
  try {
    const userId = c.get("userId") as string;
    const body = await c.req.json<{ message: string; rating?: number }>();

    if (!body.message || body.message.trim().length < 3) {
      return c.json({ error: "Pesan feedback terlalu pendek" }, 400);
    }

    const feedback = await prisma.userFeedback.create({
      data: {
        userId,
        message: body.message.trim(),
        rating: body.rating ?? null,
        isVisible: true,
      },
    });

    return c.json({ feedback }, 201);
  } catch (error) {
    console.error("[Feedback] Error creating:", error);
    return c.json({ error: "Gagal menyimpan feedback" }, 500);
  }
}

/**
 * PATCH /feedbacks/:id/visibility
 * Admin toggle apakah feedback ditampilkan.
 */
export async function toggleFeedbackVisibilityController(c: Context) {
  try {
    const { id } = c.req.param();

    const existing = await prisma.userFeedback.findUnique({ where: { id } });

    if (!existing) {
      return c.json({ error: "Feedback tidak ditemukan" }, 404);
    }

    const updated = await prisma.userFeedback.update({
      where: { id },
      data: { isVisible: !existing.isVisible },
    });

    return c.json({ feedback: updated });
  } catch (error) {
    console.error("[Feedback] Error toggling visibility:", error);
    return c.json({ error: "Gagal memperbarui feedback" }, 500);
  }
}
