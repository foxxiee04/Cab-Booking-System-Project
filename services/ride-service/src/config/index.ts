import dotenv from 'dotenv';
import { getRequiredEnv, grpcAddressFromHttpUrl } from '../../../../shared/dist';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3002', 10),
  grpcPort: parseInt(process.env.GRPC_PORT || '50054', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ride_db',
  },
  
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  services: {
    pricing: process.env.PRICING_SERVICE_URL || 'http://localhost:3009',
    driver: process.env.DRIVER_SERVICE_URL || 'http://localhost:3003',
    payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004',
  },

  grpcServices: {
    pricing: process.env.PRICING_GRPC_ADDRESS || grpcAddressFromHttpUrl(process.env.PRICING_SERVICE_URL || 'http://localhost:3009', 50057),
    driver: process.env.DRIVER_GRPC_ADDRESS || grpcAddressFromHttpUrl(process.env.DRIVER_SERVICE_URL || 'http://localhost:3003', 50055),
  },

  internalServiceToken: getRequiredEnv('INTERNAL_SERVICE_TOKEN'),
  
  serviceName: process.env.SERVICE_NAME || 'ride-service',
  
  // Ride configuration
  ride: {
    matchingTimeoutMs: parseInt(process.env.RIDE_MATCHING_TIMEOUT_MS || '30000', 10),
    maxMatchingRetries: parseInt(process.env.RIDE_MAX_MATCHING_RETRIES || '3', 10),
    searchRadiusKm: parseInt(process.env.RIDE_SEARCH_RADIUS_KM || '3', 10),
    searchTimeoutMs: parseInt(process.env.RIDE_SEARCH_TIMEOUT_MS || '120000', 10),
  },
};
