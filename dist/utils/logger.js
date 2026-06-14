import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
// Format khusus untuk JSON Terstruktur (Pretty Print)
const jsonFormat = winston.format.combine(winston.format.timestamp(), winston.format.prettyPrint());
// Tentukan direktori log
const logDir = path.join(process.cwd(), 'logs');
const transportsList = [
    new winston.transports.Console({
        format: jsonFormat,
    })
];
// Jangan gunakan file transport di Vercel Serverless Functions karena sistem file read-only
if (!process.env.VERCEL) {
    transportsList.push(new winston.transports.DailyRotateFile({
        filename: path.join(logDir, 'kainest-be-%DATE%.log'),
        datePattern: 'YYYYMMDD',
        zippedArchive: false,
        maxSize: '20m',
        maxFiles: '5d',
        level: 'info',
    }));
}
// Logger Instance
export const logger = winston.createLogger({
    level: 'info',
    format: jsonFormat,
    transports: transportsList,
});
