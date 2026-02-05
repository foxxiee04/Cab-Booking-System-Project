import dotenv from 'dotenv';

dotenv.config();

export const config = {
  serviceName: 'notification-service',
  port: parseInt(process.env.PORT || '3005', 10),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/notification_db',
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
};
