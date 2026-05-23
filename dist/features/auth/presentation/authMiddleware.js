import { auth } from '../../../infrastructure/auth.js';
export const authMiddleware = async (c, next) => {
    try {
        const session = await auth.api.getSession({
            headers: c.req.raw.headers,
        });
        if (!session) {
            return c.json({ success: false, message: 'Unauthorized' }, 401);
        }
        // Simpan ID pengguna di 'context' Hono agar bisa dipakai controller
        c.set('userId', session.user.id);
        await next(); // Lanjut ke controller jika session valid
    }
    catch (error) {
        console.error('Better Auth Session Error:', error);
        return c.json({ success: false, message: 'Invalid or expired session' }, 401);
    }
};
