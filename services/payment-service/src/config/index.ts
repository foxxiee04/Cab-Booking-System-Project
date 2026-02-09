import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3004', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/payment_db',
  },
  
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret',
  },
  
  serviceName: process.env.SERVICE_NAME || 'payment-service',
  
  // Fare policy (in VND)
  farePolicy: {
    baseFare: parseInt(process.env.BASE_FARE || '15000', 10),
    perKmRate: parseInt(process.env.PER_KM_RATE || '12000', 10),
    perMinuteRate: parseInt(process.env.PER_MINUTE_RATE || '2000', 10),
  },
  
  // Stripe Configuration
  stripe: {
    enabled: process.env.STRIPE_ENABLED === 'true',
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
  
  // MoMo Configuration
  momo: {
    enabled: process.env.MOMO_ENABLED === 'true',
    partnerCode: process.env.MOMO_PARTNER_CODE || '',
    accessKey: process.env.MOMO_ACCESS_KEY || '',
    secretKey: process.env.MOMO_SECRET_KEY || '',
    endpoint: process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn',
  },
  
  // ZaloPay Configuration
  zalopay: {
    enabled: process.env.ZALOPAY_ENABLED === 'true',
    appId: process.env.ZALOPAY_APP_ID || '',
    key1: process.env.ZALOPAY_KEY1 || '',
    key2: process.env.ZALOPAY_KEY2 || '',
    endpoint: process.env.ZALOPAY_ENDPOINT || 'https://sb-openapi.zalopay.vn',
  },
};
