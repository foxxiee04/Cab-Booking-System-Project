import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  services: {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    ride: process.env.RIDE_SERVICE_URL || 'http://localhost:3002',
    driver: process.env.DRIVER_SERVICE_URL || 'http://localhost:3003',
    payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005',
    ai: process.env.AI_SERVICE_URL || 'http://localhost:3006',
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  },
};
