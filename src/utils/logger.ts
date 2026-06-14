import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';

// Format khusus untuk JSON Terstruktur (Pretty Print)
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.prettyPrint()
);

// Tentukan direktori log
const logDir = path.join(process.cwd(), 'logs');

// Transport untuk Daily Rotate File
const fileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logDir, 'kainest-be-%DATE%.log'),
  datePattern: 'YYYYMMDD',
  zippedArchive: false,
  maxSize: '20m',
  maxFiles: '5d', // Otomatis hapus setelah 5 hari
  level: 'info',
});

// Logger Instance
export const logger = winston.createLogger({
  level: 'info',
  format: jsonFormat,
  transports: [
    fileTransport,
    // (Opsional) Tambahkan ke Console jika ingin lihat di terminal VPS juga:
    new winston.transports.Console({
      format: jsonFormat,
    })
  ],
});
