// server.ts
import { serve } from '@hono/node-server'
import  app  from './app.js'
import 'dotenv/config'

const PORT = 3000

serve({
  fetch: app.fetch,
  port: PORT,
})

// console log
console.log(`🚀 Server running at http://localhost:${PORT}`)
