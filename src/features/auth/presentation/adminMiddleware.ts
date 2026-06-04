import { Context, Next } from 'hono';
import { prisma } from '../../../infrastructure/database/prisma.js';

/**
 * Middleware untuk memastikan user memiliki role 'admin'.
 * Harus digunakan SETELAH authMiddleware.
 */
export const adminMiddleware = async (c: Context, next: Next) => {
  const userId = c.get("userId") as string;
  
  if (!userId) {
    return c.json({ success: false, message: "Unauthorized" }, 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user || user.role !== "admin") {
    return c.json({ success: false, message: "Forbidden: Admin only" }, 403);
  }

  await next();
};
