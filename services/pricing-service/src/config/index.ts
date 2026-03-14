function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }

  return value;
}

export const config = {
  serviceName: 'pricing-service',
  port: parseInt(process.env.PORT || '3009', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  ai: {
    baseUrl: getRequiredEnv('AI_SERVICE_URL'),
    timeoutMs: parseInt(process.env.AI_SERVICE_TIMEOUT_MS || '1500', 10),
  },
  
  redis: {
    url: getRequiredEnv('REDIS_URL'),
  },

  osrm: {
    baseUrl: getRequiredEnv('OSRM_BASE_URL'),
  },
  
  rabbitmq: {
    url: getRequiredEnv('RABBITMQ_URL'),
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
