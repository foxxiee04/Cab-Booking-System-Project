import dotenv from 'dotenv';
import { getRequiredEnv } from '../../../../shared/dist';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3003', 10),
  grpcPort: parseInt(process.env.GRPC_PORT || '50055', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/driver_db',
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  },
  
  jwt: {
    secret: getRequiredEnv('JWT_SECRET'),
  },
  
  internalServiceToken: getRequiredEnv('INTERNAL_SERVICE_TOKEN'),
  
  services: {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    ride: process.env.RIDE_SERVICE_URL || 'http://localhost:3002',
    payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004',
    wallet: process.env.WALLET_SERVICE_URL || 'http://localhost:3006',
    user: process.env.USER_SERVICE_URL || 'http://localhost:3007',
  },
  
  serviceName: process.env.SERVICE_NAME || 'driver-service',
  
  // Driver configuration
  driver: {
    locationTTL: 30, // seconds - remove from geo set if no update
    searchRadiusKm: 5,
  },
};
