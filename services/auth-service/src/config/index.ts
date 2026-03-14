import dotenv from 'dotenv';
import { getRequiredEnv } from '../../../../shared/dist';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/auth_db',
  },
  
  jwt: {
    secret: getRequiredEnv('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: getRequiredEnv('REFRESH_TOKEN_SECRET'),
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  },
  
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  },

  internalServiceToken: getRequiredEnv('INTERNAL_SERVICE_TOKEN'),
  
  serviceName: process.env.SERVICE_NAME || 'auth-service',
};
