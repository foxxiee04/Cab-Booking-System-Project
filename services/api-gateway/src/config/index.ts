import dotenv from 'dotenv';
import { getRequiredEnv, grpcAddressFromHttpUrl } from '../../../../shared/dist';
dotenv.config();

function envFlagTrue(raw: string | undefined): boolean {
  const v = (raw ?? '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

function readNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoundedIntEnv(name: string, fallback: number, min: number, max: number): number {
  const parsed = Math.floor(readNumberEnv(name, fallback));
  return Math.min(max, Math.max(min, parsed));
}

function readBoundedFloatEnv(name: string, fallback: number, min: number, max: number): number {
  const parsed = readNumberEnv(name, fallback);
  return Math.min(max, Math.max(min, parsed));
}

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  /** Must match auth-service: when true, expose GET /api/auth/dev/otp on gateway in production (demo only). */
  enableDevOtpEndpoint: envFlagTrue(process.env.OTP_ENABLE_DEV_ENDPOINT),
  jwtSecret: getRequiredEnv('JWT_SECRET'),
  internalServiceToken: getRequiredEnv('INTERNAL_SERVICE_TOKEN'),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  
  services: {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    user: process.env.USER_SERVICE_URL || 'http://localhost:3007',
    booking: process.env.BOOKING_SERVICE_URL || 'http://localhost:3008',
    pricing: process.env.PRICING_SERVICE_URL || 'http://localhost:3009',
    review: process.env.REVIEW_SERVICE_URL || 'http://localhost:3010',
    ride: process.env.RIDE_SERVICE_URL || 'http://localhost:3002',
    driver: process.env.DRIVER_SERVICE_URL || 'http://localhost:3003',
    payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004',
    wallet: process.env.WALLET_SERVICE_URL || 'http://localhost:3006',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005',
    ai: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  },

  grpcServices: {
    auth: process.env.AUTH_GRPC_ADDRESS || grpcAddressFromHttpUrl(process.env.AUTH_SERVICE_URL || 'http://localhost:3001', 50051),
    user: process.env.USER_GRPC_ADDRESS || grpcAddressFromHttpUrl(process.env.USER_SERVICE_URL || 'http://localhost:3007', 50052),
    booking: process.env.BOOKING_GRPC_ADDRESS || grpcAddressFromHttpUrl(process.env.BOOKING_SERVICE_URL || 'http://localhost:3008', 50053),
    ride: process.env.RIDE_GRPC_ADDRESS || grpcAddressFromHttpUrl(process.env.RIDE_SERVICE_URL || 'http://localhost:3002', 50054),
    driver: process.env.DRIVER_GRPC_ADDRESS || grpcAddressFromHttpUrl(process.env.DRIVER_SERVICE_URL || 'http://localhost:3003', 50055),
    payment: process.env.PAYMENT_GRPC_ADDRESS || grpcAddressFromHttpUrl(process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004', 50056),
    pricing: process.env.PRICING_GRPC_ADDRESS || grpcAddressFromHttpUrl(process.env.PRICING_SERVICE_URL || 'http://localhost:3009', 50057),
    notification: process.env.NOTIFICATION_GRPC_ADDRESS || grpcAddressFromHttpUrl(process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005', 50058),
    review: process.env.REVIEW_GRPC_ADDRESS || grpcAddressFromHttpUrl(process.env.REVIEW_SERVICE_URL || 'http://localhost:3010', 50059),
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  },

  map: {
    nominatimUrl: process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org',
    nominatimEmail: process.env.NOMINATIM_EMAIL || '',
    nominatimLanguage: process.env.NOMINATIM_LANGUAGE || 'vi',
    nominatimCountry: process.env.NOMINATIM_COUNTRY || 'vn',
    osrmUrl: process.env.OSRM_URL || 'http://router.project-osrm.org',
    timeoutMs: parseInt(process.env.MAP_TIMEOUT_MS || '10000'),
  },

  matching: {
    maxAttempts: readBoundedIntEnv('MATCHING_MAX_ATTEMPTS', 3, 1, 10),
    retryDelayMs: readBoundedIntEnv('MATCHING_RETRY_DELAY_MS', 2500, 2000, 10000),
    maxWaitMs: readBoundedIntEnv('MATCHING_MAX_WAIT_MS', 120000, 10000, 600000),
    // Format: radiusKm:offerCount:surgeHint,radiusKm:offerCount:surgeHint
    // Default: widen radius each round but only **one** active offer at a time (sequential).
    // Use e.g. `2:1:1.0,3:3:1.1` only if you explicitly want multi-driver broadcast waves.
    rounds: process.env.MATCHING_ROUNDS || '2:1:1.0,4:1:1.1,6:1:1.2',
    scoreLogVerbose: process.env.MATCHING_SCORE_LOG_VERBOSE === 'true',
    aiAdjustmentEnabled: process.env.MATCHING_AI_ADJUSTMENT_ENABLED === 'true',
    aiAdjustmentDeltaMax: readBoundedFloatEnv('MATCHING_AI_ADJUSTMENT_DELTA_MAX', 0.08, 0, 0.2),
    aiTimeoutMs: readBoundedIntEnv('MATCHING_AI_TIMEOUT_MS', 150, 50, 1000),
    pAcceptEnabled: process.env.MATCHING_PACCEPT_ENABLED === 'true',
    pAcceptClampMin: readBoundedFloatEnv('MATCHING_PACCEPT_CLAMP_MIN', 0.3, 0.1, 1.0),
    pAcceptClampMax: readBoundedFloatEnv('MATCHING_PACCEPT_CLAMP_MAX', 1.2, 1.0, 2.0),
    avgUrbanSpeedKmh: readBoundedFloatEnv('MATCHING_AVG_SPEED_KMH', 25, 10, 60),
    waitPredictionEnabled: process.env.MATCHING_WAIT_PREDICTION_ENABLED === 'true',
    waitThresholdMinutes: readBoundedFloatEnv('MATCHING_WAIT_THRESHOLD_MINUTES', 8, 2, 15),
    maxRadiusKm: readBoundedFloatEnv('MATCHING_MAX_RADIUS_KM', 5, 1, 20),
  },

  customer: {
    nearbyDriverMaxRadiusKm: readBoundedFloatEnv('CUSTOMER_NEARBY_DRIVER_MAX_RADIUS_KM', 3, 0.5, 10),
  },

  location: {
    databaseUrl: process.env.LOCATION_DATABASE_URL || '',
    adminCatalogRefreshMs: readBoundedIntEnv('LOCATION_ADMIN_REFRESH_MS', 15 * 60 * 1000, 60 * 1000, 24 * 60 * 60 * 1000),
  },
};
