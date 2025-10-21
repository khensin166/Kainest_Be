// // src/index.ts
// import { serve } from "@hono/node-server";
// import app from "./app";

// const port = process.env.PORT ? Number(process.env.PORT) : 3000;

// console.log(`🚀 Server running at http://localhost:${port}`);

// serve({
//   fetch: app.fetch,
//   port,
// });

// index.ts
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import authRoute from './routes/auth.route'

const app = new Hono()

app.route('/auth', authRoute)

serve({
  fetch: app.fetch,
  port: 3000,
})
