import winston from 'winston';
import { asyncContext } from './asyncContext.js';
const { combine, timestamp, printf, colorize } = winston.format;
// Plugin untuk otomatis menyisipkan Trace ID dari context
const traceIdFormat = winston.format((info) => {
    const store = asyncContext.getStore();
    if (store && store.has('traceId')) {
        info.traceId = store.get('traceId');
    }
    return info;
});
// Format khusus untuk membedakan level log dengan warna di console
const consoleFormat = combine(traceIdFormat(), colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), printf(({ level, message, timestamp, traceId, ...meta }) => {
    let log = `[${timestamp}]`;
    if (traceId)
        log += ` [${traceId}]`;
    log += ` ${level}: ${message}`;
    if (Object.keys(meta).length > 0) {
        // Hilangkan meta.correlation_id dari objek jika sudah ditampilkan di TraceID, biar rapi
        if (meta.correlation_id === traceId)
            delete meta.correlation_id;
        if (Object.keys(meta).length > 0) {
            log += `\n${JSON.stringify(meta, null, 2)}`;
        }
    }
    return log;
}));
// Format khusus untuk file log (tanpa warna ASCII)
const fileFormat = combine(traceIdFormat(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), printf(({ level, message, timestamp, traceId, ...meta }) => {
    let log = `[${timestamp}]`;
    if (traceId)
        log += ` [${traceId}]`;
    log += ` ${level}: ${message}`;
    if (Object.keys(meta).length > 0) {
        if (meta.correlation_id === traceId)
            delete meta.correlation_id;
        if (Object.keys(meta).length > 0) {
            log += ` - ${JSON.stringify(meta)}`;
        }
    }
    return log;
}));
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL;
const transportsList = [
    // Output ke terminal
    new winston.transports.Console({
        format: consoleFormat,
    }),
];
// File logging hanya aktif jika BUKAN di Vercel (karena Vercel itu serverless read-only filesystem)
if (!isVercel) {
    transportsList.push(
    // Output ke file error terpisah
    new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
    }), 
    // Output webhook (incoming/outgoing) khusus untuk GOWA
    new winston.transports.File({
        filename: 'logs/wabot-webhook.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
    }));
}
export const logger = winston.createLogger({
    level: 'info',
    format: fileFormat,
    transports: transportsList,
});
