import dotenv from 'dotenv';
dotenv.config();

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }

  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '3004', 10),
  grpcPort: parseInt(process.env.GRPC_PORT || '50056', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: getRequiredEnv('DATABASE_URL'),
  },
  
  rabbitmq: {
    url: getRequiredEnv('RABBITMQ_URL'),
  },
  
  jwt: {
    secret: getRequiredEnv('JWT_SECRET'),
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

  // VNPay Configuration
  vnpay: {
    enabled: process.env.VNPAY_ENABLED === 'true',
    tmnCode: process.env.VNPAY_TMN_CODE || '',
    hashSecret: process.env.VNPAY_HASH_SECRET || '',
    url: process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    returnUrl: process.env.VNPAY_RETURN_URL || 'http://localhost:3000/payments/vnpay/return',
    apiUrl: process.env.VNPAY_API_URL || 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
  },
};
