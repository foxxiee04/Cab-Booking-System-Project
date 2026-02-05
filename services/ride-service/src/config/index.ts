import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3002', 10),
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
  },
  
  serviceName: process.env.SERVICE_NAME || 'ride-service',
  
  // Ride configuration
  ride: {
    matchingTimeoutMs: 30000,  // 30 seconds to find driver
    maxMatchingRetries: 3,
    searchRadiusKm: 5,
  },
};
