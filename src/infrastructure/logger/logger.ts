import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

// Format khusus untuk membedakan level log dengan warna di console
const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  printf(({ level, message, timestamp, ...meta }) => {
    let log = `[${timestamp}] ${level}: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    return log;
  })
);

// Format khusus untuk file log (tanpa warna ASCII)
const fileFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  printf(({ level, message, timestamp, ...meta }) => {
    let log = `[${timestamp}] ${level}: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` - ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

export const logger = winston.createLogger({
  level: 'info',
  format: fileFormat,
  transports: [
    // Output ke terminal
    new winston.transports.Console({
      format: consoleFormat,
    }),
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
    }),
  ],
});
