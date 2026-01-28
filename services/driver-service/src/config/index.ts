import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3003', 10),
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
    secret: process.env.JWT_SECRET || 'default-secret',
  },
  
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN || 'default-internal-token',
  
  services: {
    ride: process.env.RIDE_SERVICE_URL || 'http://localhost:3002',
  },
  
  serviceName: process.env.SERVICE_NAME || 'driver-service',
  
  // Driver configuration
  driver: {
    locationTTL: 30, // seconds - remove from geo set if no update
    searchRadiusKm: 5,
  },
};
