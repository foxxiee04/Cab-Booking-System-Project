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
  serviceName: 'notification-service',
  port: parseInt(process.env.PORT || '3005', 10),
  grpcPort: parseInt(process.env.GRPC_PORT || '50058', 10),
  mongodbUri: getRequiredEnv('MONGODB_URI'),
  redis: {
    url: getRequiredEnv('REDIS_URL'),
  },
  rabbitmq: {
    url: getRequiredEnv('RABBITMQ_URL'),
    queue: 'notification-events',
  },
  email: {
    enabled: process.env.EMAIL_ENABLED === 'true',
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    from: process.env.EMAIL_FROM || 'noreply@cab-booking.com',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  },
  sms: {
    enabled: process.env.SMS_ENABLED === 'true',
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },
};
