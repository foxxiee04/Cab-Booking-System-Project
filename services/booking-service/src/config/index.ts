import { grpcAddressFromHttpUrl } from '../../../../shared/dist';

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }

  return value;
}

export const config = {
  serviceName: 'booking-service',
  port: parseInt(process.env.PORT || '3008', 10),
  grpcPort: parseInt(process.env.GRPC_PORT || '50053', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: getRequiredEnv('DATABASE_URL'),
  },
  
  rabbitmq: {
    url: getRequiredEnv('RABBITMQ_URL'),
  },
  
  services: {
    pricing: getRequiredEnv('PRICING_SERVICE_URL'),
    ride: getRequiredEnv('RIDE_SERVICE_URL'),
  },

  grpcServices: {
    pricing: process.env.PRICING_GRPC_ADDRESS || grpcAddressFromHttpUrl(getRequiredEnv('PRICING_SERVICE_URL'), 50057),
  },
};
