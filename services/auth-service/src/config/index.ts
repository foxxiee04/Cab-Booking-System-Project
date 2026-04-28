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
    ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS || '120', 10),      // 2 minutes
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

  sms: {
    // OTP_SMS_MODE: 'mock' | 'twilio' | 'speedsms' | 'sns'
    mode: (process.env.OTP_SMS_MODE || 'mock').toLowerCase(),
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken:  process.env.TWILIO_AUTH_TOKEN  || '',
      fromPhone:  process.env.TWILIO_FROM_PHONE  || '',
    },
    speedsms: {
      // Lay API key tai: https://speedsms.vn — muc Account > API
      apiKey:     process.env.SPEEDSMS_API_KEY   || '',
      senderName: process.env.SPEEDSMS_SENDER    || '',  // ten hien thi (neu co)
    },
    // SNS mode tu dong dung IAM role khi chay tren EC2/ECS — khong can key
    // Neu chay local: set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
  },

  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  },

  internalServiceToken: getRequiredEnv('INTERNAL_SERVICE_TOKEN'),
  
  serviceName: process.env.SERVICE_NAME || 'auth-service',
};
