// app.ts
import { Hono } from 'hono';
import { auth } from './infrastructure/auth.js';
import { profileRoute } from './features/profile/presentation/profileRoute.js';
import { coupleRoute } from './features/couple/presentation/coupleRoute.js';
import { todoRoute } from './features/todos/presentation/todoRoute.js';
import { noteRoute } from './features/notes/presentation/noteRoute.js';
import { budgetRoute } from "./features/budgeting/presentation/budgetRoute.js";
import { wabotRoute } from "./features/wabot/presentation/wabotRoutes.js";
import { uploadRoute } from "./features/upload/presentation/uploadRoute.js";
import adminRoute from "./features/admin/presentation/admin.route.js";
import { cors } from 'hono/cors';
import { loggingMiddleware } from './infrastructure/middlewares/LoggingMiddleware.js';
const app = new Hono();
// Hanya izinkan request dari frontend Vue Anda (default Vite)
// Gunakan CORS dengan credentials untuk session cookie
app.use('*', cors({
    origin: ['https://kainest.kenantomfie.site', 'http://localhost:5173', 'https://staging.kainest.kenantomfie.site'],
    credentials: true,
}));
// 🔵 Global Logging Middleware — Semua request masuk akan tercatat
app.use('*', loggingMiddleware);
/**
 * Route khusus untuk social login callback (token exchange bridge).
 *
 * Kenapa dibutuhkan:
 * - Setelah OAuth selesai, cookie session di-set oleh backend.
 * - Browser langsung request ke URL ini (same-domain backend), cookie valid.
 * - Backend baca token dari session, lalu redirect ke frontend dengan token di URL hash.
 * - Frontend baca token dari hash → simpan ke localStorage → pakai Bearer token.
 * - Ini menghindari masalah cross-domain cookie (frontend ≠ domain backend).
 *
 * HARUS didaftarkan SEBELUM app.on("/auth/*") agar tidak di-override oleh Better Auth handler.
 */
app.get('/auth/social-callback', async (c) => {
    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://staging.kainest.kenantomfie.site';
    try {
        // Baca session dari cookie — browser request ini langsung ke backend (same-domain),
        // jadi cookie PASTI valid dan bisa dibaca oleh Better Auth.
        const session = await auth.api.getSession({ headers: c.req.raw.headers });
        if (!session || !session.session?.token) {
            console.warn('[social-callback] Tidak ada session ditemukan, redirect ke login.');
            return c.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
        }
        const token = session.session.token;
        console.log(`[social-callback] Token berhasil didapat, redirect ke frontend.`);
        // Kirim token via URL hash (#token=...) — hash TIDAK dikirim ke server,
        // hanya bisa dibaca oleh JavaScript di frontend (aman dari server logs).
        return c.redirect(`${FRONTEND_URL}/app/auth-callback#token=${token}`);
    }
    catch (error) {
        console.error('[social-callback] Error:', error);
        return c.redirect(`${FRONTEND_URL}/login?error=server_error`);
    }
});
app.on(["POST", "GET"], "/auth/*", (c) => auth.handler(c.req.raw));
app.route('/profile', profileRoute);
app.route('/couple', coupleRoute);
app.route('/todos', todoRoute);
app.route('/notes', noteRoute);
app.route("/budget", budgetRoute);
app.route("/wabot", wabotRoute);
app.route("/upload", uploadRoute);
app.route("/admin", adminRoute);
app.get('/', (c) => c.text('Hello from Kainest Backend! 🚀'));
export default app;
