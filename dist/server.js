// server.ts
import 'dotenv/config';
import { serve } from '@hono/node-server';
import app from './app.js';
import { logger } from './infrastructure/logger/logger.js';
import { startShiftScheduler } from './features/wabot/services/ShiftSchedulerService.js';
const PORT = Number(process.env.PORT) || 3000;
serve({
    fetch: app.fetch,
    port: PORT
}, (info) => {
    logger.info(`🚀 Server running at http://localhost:${info.port}`);
    // Aktifkan scheduler blast jadwal shift (hanya jika ENABLE_SCHEDULER=true)
    startShiftScheduler();
});
