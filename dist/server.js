// server.ts
import 'dotenv/config';
import { serve } from '@hono/node-server';
import app from './app.js';
import { logger } from './infrastructure/logger/logger.js';
const PORT = Number(process.env.PORT) || 3000;
serve({
    fetch: app.fetch,
    port: PORT
}, (info) => {
    logger.info(`🚀 Server running at http://localhost:${info.port}`);
});
