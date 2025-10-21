// app.ts
import { Hono } from 'hono'
import { authRoute } from './features/auth/presentation/authRoute'

export const app = new Hono()

app.route('/auth', authRoute)

app.get('/', (c) => c.text('Hello from Kainest Backend! 🚀'))
