import dotenv from 'dotenv';

dotenv.config();

export const config = {
  serviceName: 'notification-service',
  port: parseInt(process.env.PORT || '3005', 10),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/notification_db',
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://rabbitmq_user:rabbitmq_password@localhost:5672',
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
