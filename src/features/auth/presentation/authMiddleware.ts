import { Context, Next } from 'hono'
import { auth } from '../../../infrastructure/auth.js'

export const authMiddleware = async (c: Context, next: Next) => {
  try {
    // Debug logging untuk memeriksa ketersediaan auth di production/staging
    if (process.env.NODE_ENV === "production") {
      const cookieHeader = c.req.raw.headers.get("cookie");
      const authHeader = c.req.raw.headers.get("authorization");
      const hasCookie = cookieHeader && (
        cookieHeader.includes("better-auth.session_token") ||
        cookieHeader.includes("__Secure-better-auth.session_token")
      );
      const hasBearer = !!authHeader && authHeader.startsWith("Bearer ");
      if (!hasCookie && !hasBearer) {
        console.warn("[AuthMiddleware] Peringatan: Cookie sesi DAN Bearer token tidak ditemukan dalam header request.");
      } else {
        console.log(`[AuthMiddleware] Auth found via: ${hasBearer ? 'Bearer token' : 'Cookie'}`);
      }
    }

    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session) {
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }

    // Simpan ID pengguna di 'context' Hono agar bisa dipakai controller
    c.set('userId', session.user.id); 

    await next(); // Lanjut ke controller jika session valid

  } catch (error) {
    console.error('Better Auth Session Error:', error);
    return c.json({ success: false, message: 'Invalid or expired session' }, 401);
  }
}