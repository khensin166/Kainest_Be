// app.ts
import { Hono } from 'hono'
import { authRoute } from './features/auth/presentation/authRoute.js'
import { cors } from 'hono/cors'

export const app = new Hono()

// Hanya izinkan request dari frontend Vue Anda (default Vite)
// 2. Gunakan middleware CORS (Izinkan semua)
app.use('*', cors())

app.route('/auth', authRoute)

app.get('/', (c) => c.text('Hello from Kainest Backend! 🚀'))
