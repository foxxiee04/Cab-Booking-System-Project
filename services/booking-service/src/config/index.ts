export const config = {
  serviceName: 'booking-service',
  port: parseInt(process.env.PORT || '3008', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/booking_db',
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  },
  
  services: {
    pricing: process.env.PRICING_SERVICE_URL || 'http://localhost:3009',
    ride: process.env.RIDE_SERVICE_URL || 'http://localhost:3002',
  },
};
