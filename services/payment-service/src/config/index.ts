import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3004', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cab_booking_payments',
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
};
