export const config = {
  serviceName: 'booking-service',
  port: parseInt(process.env.PORT || '3008', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/booking_db',
  },
  
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  },
  
  services: {
    pricing: process.env.PRICING_SERVICE_URL || 'http://localhost:3009',
    ride: process.env.RIDE_SERVICE_URL || 'http://localhost:3002',
  },
};
