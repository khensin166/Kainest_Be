// app.ts
import { Hono } from 'hono';
import * as fs from 'fs';
import * as path from 'path';
import { auth } from './infrastructure/auth.js';
import { profileRoute } from './features/profile/presentation/profileRoute.js';
import { coupleRoute } from './features/couple/presentation/coupleRoute.js';
import { todoRoute } from './features/todos/presentation/todoRoute.js';
import { noteRoute } from './features/notes/presentation/noteRoute.js';
import { budgetRoute } from "./features/budgeting/presentation/budgetRoute.js";
import { wabotRoute } from "./features/wabot/presentation/wabotRoutes.js";
import { uploadRoute } from "./features/upload/presentation/uploadRoute.js";
import adminRoute from "./features/admin/presentation/admin.route.js";
import { notificationRoute } from "./features/notification/presentation/notificationRoute.js";
import { feedbackRoute } from "./features/feedback/presentation/feedbackRoute.js";
import { systemUpdateRoute } from "./features/systemUpdate/presentation/systemUpdateRoute.js";
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { loggingMiddleware } from './infrastructure/middlewares/LoggingMiddleware.js';
const app = new Hono();
// Security Hardening: Tambahkan HTTP Security Headers
app.use('*', secureHeaders());
// Hanya izinkan request dari frontend Vue Anda (default Vite)
// Gunakan CORS dengan credentials untuk session cookie
app.use('*', cors({
    origin: ['https://kainest.kenantomfie.site', 'http://localhost:5173', 'https://staging.kainest.kenantomfie.site', 'https://gowa.kenantomfie.com',],
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
app.route("/notifications", notificationRoute);
app.route("/feedbacks", feedbackRoute);
app.route("/system-updates", systemUpdateRoute);
app.get('/', (c) => c.text('Hello from Kainest Backend! 🚀'));
app.get('/doc', (c) => {
    try {
        const docPath = path.resolve(process.cwd(), 'doc', 'kainest_system_flow.md');
        const mdContent = fs.readFileSync(docPath, 'utf8');
        // Render HTML sederhana dengan marked.js dan mermaid.js dari CDN
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kainest System Flow</title>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; padding: 2rem; max-width: 900px; margin: 0 auto; color: #333; background: #fafafa; }
      pre { background: #f6f8fa; padding: 1rem; border-radius: 6px; overflow-x: auto; }
      code { font-family: Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace; background: #eee; padding: 0.2em 0.4em; border-radius: 3px; }
      pre code { background: none; padding: 0; }
      .mermaid { margin: 2rem 0; background: white; padding: 1rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
      h1, h2, h3 { border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    </style>
</head>
<body>
    <div id="content"></div>
    <script type="module">
      import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
      
      const rawMd = \`${mdContent.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
      
      // 1. Render Markdown ke HTML dengan fungsi parse dasar
      document.getElementById('content').innerHTML = marked.parse(rawMd);
      
      // 2. Ubah blok kode markdown (pre > code.language-mermaid) menjadi <div class="mermaid"> 
      document.querySelectorAll('code.language-mermaid').forEach((el) => {
          const pre = el.parentElement;
          const div = document.createElement('div');
          div.className = 'mermaid';
          div.textContent = el.textContent; // Masukkan teks mentah script diagram
          pre.parentNode.replaceChild(div, pre); // Ganti <pre> dengan <div>
      });
      
      // 3. Jalankan renderer Mermaid pada semua div yang baru dibuat
      mermaid.initialize({ startOnLoad: false, theme: 'default' });
      await mermaid.run({ querySelector: '.mermaid' });
    </script>
</body>
</html>
    `;
        return c.html(html);
    }
    catch (error) {
        console.error("Error serving doc:", error);
        return c.text('Document not found', 404);
    }
});
export default app;
