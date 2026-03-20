import dotenv from 'dotenv';

dotenv.config();

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }

  return value;
}

export const config = {
  serviceName: 'review-service',
  port: parseInt(process.env.PORT || '3010', 10),
  grpcPort: parseInt(process.env.GRPC_PORT || '50059', 10),
  mongodbUri: getRequiredEnv('MONGODB_URI'),
  driverServiceUrl: process.env.DRIVER_SERVICE_URL || 'http://driver-service:3003',
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN || 'test-internal-token',
};
