import dotenv from 'dotenv';
import { getRequiredEnv, grpcAddressFromHttpUrl } from '../../../../shared/dist';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: getRequiredEnv('JWT_SECRET'),
  internalServiceToken: getRequiredEnv('INTERNAL_SERVICE_TOKEN'),
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

  grpcServices: {
    auth: process.env.AUTH_GRPC_ADDRESS || grpcAddressFromHttpUrl(process.env.AUTH_SERVICE_URL || 'http://localhost:3001', 50051),
    user: process.env.USER_GRPC_ADDRESS || grpcAddressFromHttpUrl(process.env.USER_SERVICE_URL || 'http://localhost:3007', 50052),
    booking: process.env.BOOKING_GRPC_ADDRESS || grpcAddressFromHttpUrl(process.env.BOOKING_SERVICE_URL || 'http://localhost:3008', 50053),
    ride: process.env.RIDE_GRPC_ADDRESS || grpcAddressFromHttpUrl(process.env.RIDE_SERVICE_URL || 'http://localhost:3002', 50054),
    driver: process.env.DRIVER_GRPC_ADDRESS || grpcAddressFromHttpUrl(process.env.DRIVER_SERVICE_URL || 'http://localhost:3003', 50055),
    payment: process.env.PAYMENT_GRPC_ADDRESS || grpcAddressFromHttpUrl(process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004', 50056),
    pricing: process.env.PRICING_GRPC_ADDRESS || grpcAddressFromHttpUrl(process.env.PRICING_SERVICE_URL || 'http://localhost:3009', 50057),
    notification: process.env.NOTIFICATION_GRPC_ADDRESS || grpcAddressFromHttpUrl(process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005', 50058),
    review: process.env.REVIEW_GRPC_ADDRESS || grpcAddressFromHttpUrl(process.env.REVIEW_SERVICE_URL || 'http://localhost:3010', 50059),
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
