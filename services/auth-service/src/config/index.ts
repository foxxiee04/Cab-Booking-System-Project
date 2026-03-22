import dotenv from 'dotenv';
import { getRequiredEnv } from '../../../../shared/dist';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  grpcPort: parseInt(process.env.GRPC_PORT || '50051', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/auth_db',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  jwt: {
    secret: getRequiredEnv('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: getRequiredEnv('REFRESH_TOKEN_SECRET'),
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  },

  // OTP configuration
  otp: {
    ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS || '300', 10),      // 5 minutes
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10),
    length: 6,
    rateLimit: {
      maxOtpPerPhone: parseInt(process.env.OTP_RATE_MAX_PER_PHONE || '3', 10),     // max 3 OTP per 10 min
      phoneWindowSeconds: parseInt(process.env.OTP_RATE_PHONE_WINDOW || '600', 10),
      maxPerIp: parseInt(process.env.OTP_RATE_MAX_PER_IP || '10', 10),              // max 10 req per min per IP
      ipWindowSeconds: parseInt(process.env.OTP_RATE_IP_WINDOW || '60', 10),
    },
    resendDelays: [0, 30, 60], // seconds: 1st send immediately, 2nd after 30s, 3rd+ after 60s
  },

  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  },

  internalServiceToken: getRequiredEnv('INTERNAL_SERVICE_TOKEN'),
  
  serviceName: process.env.SERVICE_NAME || 'auth-service',
};
