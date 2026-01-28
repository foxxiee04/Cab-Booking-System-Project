import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3005'),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/notification_db',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  internalToken: process.env.INTERNAL_SERVICE_TOKEN || '',
  services: {
    auth: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
    ride: process.env.RIDE_SERVICE_URL || 'http://ride-service:3002',
    driver: process.env.DRIVER_SERVICE_URL || 'http://driver-service:3003',
  },
};
