import { Context, Next } from "hono";
import { auth } from "../../infrastructure/auth.js";

/**
 * Middleware untuk memastikan user yang mengakses route memiliki role 'admin'
 */
export const requireAdmin = async (c: Context, next: Next) => {
  // Gunakan better-auth untuk mendapatkan session saat ini
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session || !session.user) {
    return c.json({ success: false, message: "Sesi tidak valid atau telah kadaluarsa" }, 401);
  }

  // Cek apakah user memiliki role 'admin'
  if (session.user.role !== "admin") {
    return c.json({ success: false, message: "Akses ditolak: Hanya Administrator yang diizinkan mengakses resource ini" }, 403);
  }

  // Jika perlu, simpan session ke context agar tidak perlu getSession lagi di controller
  c.set("session", session);
  c.set("user", session.user);

  await next();
};
