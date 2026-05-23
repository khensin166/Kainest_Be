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
import { cors } from 'hono/cors';
const app = new Hono();
// Hanya izinkan request dari frontend Vue Anda (default Vite)
// Gunakan CORS dengan credentials untuk session cookie
app.use('*', cors({
    origin: ['https://kainest.kenantomfie.site', 'http://localhost:5173'],
    credentials: true,
}));
app.on(["POST", "GET"], "/auth/*", (c) => auth.handler(c.req.raw));
app.route('/profile', profileRoute);
app.route('/couple', coupleRoute);
app.route('/todos', todoRoute);
app.route('/notes', noteRoute);
app.route("/budget", budgetRoute);
app.route("/wabot", wabotRoute);
app.route("/upload", uploadRoute);
app.get('/', (c) => c.text('Hello from Kainest Backend! 🚀'));
export default app;
