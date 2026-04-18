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
      MOTORBIKE: 10000,
      SCOOTER: 14000,
      CAR_4: 24000,
      CAR_7: 32000,
    },
    // Per km (VND)
    perKmRate: {
      MOTORBIKE: 6200,
      SCOOTER: 8400,
      CAR_4: 15000,
      CAR_7: 18500,
    },
    // Per minute (VND)
    perMinuteRate: {
      MOTORBIKE: 450,
      SCOOTER: 700,
      CAR_4: 1900,
      CAR_7: 2400,
    },
    // Fixed fee to reflect comfort / operating cost of each vehicle tier.
    vehicleServiceFee: {
      MOTORBIKE: 0,
      SCOOTER: 1500,
      CAR_4: 6000,
      CAR_7: 10000,
    },
    // Short trips disproportionately consume driver pickup time, especially for cars.
    shortTripThresholdKm: 2.5,
    shortTripFee: {
      MOTORBIKE: 0,
      SCOOTER: 1500,
      CAR_4: 6000,
      CAR_7: 9000,
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
