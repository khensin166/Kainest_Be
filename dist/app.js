// app.ts
import { Hono } from 'hono';
import { authRoute } from './features/auth/presentation/authRoute.js';
import { profileRoute } from './features/profile/presentation/profileRoute.js';
import { coupleRoute } from './features/couple/presentation/coupleRoute.js';
import { cors } from 'hono/cors';
const app = new Hono();
// Hanya izinkan request dari frontend Vue Anda (default Vite)
// 2. Gunakan middleware CORS (Izinkan semua)
app.use('*', cors());
app.route('/auth', authRoute);
app.route('/profile', profileRoute);
app.route('/couple', coupleRoute);
app.get('/', (c) => c.text('Hello from Kainest Backend! 🚀'));
export default app;
