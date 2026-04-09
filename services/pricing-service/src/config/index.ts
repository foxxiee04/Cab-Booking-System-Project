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
  grpcPort: parseInt(process.env.GRPC_PORT || '50057', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  ai: {
    baseUrl: getRequiredEnv('AI_SERVICE_URL'),
    timeoutMs: parseInt(process.env.AI_SERVICE_TIMEOUT_MS || '150', 10),
    surgeMin: parseFloat(process.env.AI_SURGE_MIN || '1.0'),
    surgeMax: parseFloat(process.env.AI_SURGE_MAX || '2.0'),
    radiusMinKm: parseFloat(process.env.AI_RADIUS_MIN_KM || '2.0'),
    radiusMaxKm: parseFloat(process.env.AI_RADIUS_MAX_KM || '5.0'),
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
      MOTORBIKE: 9000,
      SCOOTER: 11000,
      CAR_4: 17000,
      CAR_7: 22000,
    },
    // Per km (VND)
    perKmRate: {
      MOTORBIKE: 6500,
      SCOOTER: 7800,
      CAR_4: 12500,
      CAR_7: 15500,
    },
    // Per minute (VND)
    perMinuteRate: {
      MOTORBIKE: 500,
      SCOOTER: 650,
      CAR_4: 1500,
      CAR_7: 1900,
    },
    // Minimum fare
    minimumFare: 15000,
    // Surge pricing configuration
    surgeThresholds: {
      low: 1.0,
      medium: 1.3,
      high: 1.5,
      peak: 2.0,
    },
  },
};
