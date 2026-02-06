import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  
  services: {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    user: process.env.USER_SERVICE_URL || 'http://localhost:3007',
    booking: process.env.BOOKING_SERVICE_URL || 'http://localhost:3008',
    pricing: process.env.PRICING_SERVICE_URL || 'http://localhost:3009',
    review: process.env.REVIEW_SERVICE_URL || 'http://localhost:3010',
    ride: process.env.RIDE_SERVICE_URL || 'http://localhost:3002',
    driver: process.env.DRIVER_SERVICE_URL || 'http://localhost:3003',
    payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005',
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  },

  map: {
    nominatimUrl: process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org',
    nominatimEmail: process.env.NOMINATIM_EMAIL || '',
    nominatimLanguage: process.env.NOMINATIM_LANGUAGE || 'vi',
    nominatimCountry: process.env.NOMINATIM_COUNTRY || 'vn',
    osrmUrl: process.env.OSRM_URL || 'http://router.project-osrm.org',
    timeoutMs: parseInt(process.env.MAP_TIMEOUT_MS || '10000'),
  },
};
