import { createApp } from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { connectRedis, disconnectRedis, isRedisReady } from './config/redis';
import { PricingService } from './services/pricing.service';
import { startGrpcServer, shutdownGrpcServer, createHttpBridgeServiceRegistration } from '../../../shared/dist';
import { createPricingGrpcRegistrations } from './grpc/pricing.server';

export async function start() {
  await connectRedis();

  const pricingService = new PricingService();
  const getReadiness = async () => ({
    redis: await isRedisReady(),
  });

  const app = createApp({
    pricingService,
    getReadiness,
  });

  const grpcServer = await startGrpcServer({
    address: `0.0.0.0:${config.grpcPort}`,
    registrations: [
      ...createPricingGrpcRegistrations(pricingService, getReadiness),
      createHttpBridgeServiceRegistration(`http://127.0.0.1:${config.port}`),
    ],
  });

  const server = app.listen(config.port, () => {
    logger.info(`Pricing Service running on port ${config.port}`);
    logger.info(`Pricing gRPC Service running on port ${config.grpcPort}`);
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down...');
    await shutdownGrpcServer(grpcServer);
    await disconnectRedis();
    server.close();
    process.exit(0);
  });

  return { app, server };
}

if (require.main === module) {
  start().catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}
