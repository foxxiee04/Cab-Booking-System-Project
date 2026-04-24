import winston from 'winston';
import { config } from '../config';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length) {
      try {
        metaStr = JSON.stringify(meta);
      } catch {
        // Circular references in meta (e.g. Axios errors) — log safely
        metaStr = JSON.stringify({ _error: String(meta?.message ?? meta) });
      }
    }
    return `${timestamp} [${level.toUpperCase()}] ${message} ${metaStr}`;
  })
);

export const logger = winston.createLogger({
  level: config.nodeEnv === 'development' ? 'debug' : 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      ),
    }),
  ],
});
