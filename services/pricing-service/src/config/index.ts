export const config = {
  serviceName: 'pricing-service',
  port: parseInt(process.env.PORT || '3009', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  },
  
  pricing: {
    // Base fare (VND)
    baseFare: {
      ECONOMY: 10000,
      COMFORT: 15000,
      PREMIUM: 25000,
    },
    // Per km (VND)
    perKmRate: {
      ECONOMY: 12000,
      COMFORT: 18000,
      PREMIUM: 30000,
    },
    // Per minute (VND)
    perMinuteRate: {
      ECONOMY: 2000,
      COMFORT: 3000,
      PREMIUM: 5000,
    },
    // Minimum fare
    minimumFare: 25000,
    // Surge pricing configuration
    surgeThresholds: {
      low: 1.0,
      medium: 1.3,
      high: 1.5,
      peak: 2.0,
    },
  },
};
