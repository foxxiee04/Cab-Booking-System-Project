import { createApp } from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { connectRedis, disconnectRedis, isRedisReady } from './config/redis';
import { PricingService } from './services/pricing.service';

export async function start() {
  await connectRedis();

  const pricingService = new PricingService();

  const app = createApp({
    pricingService,
    getReadiness: async () => ({
      redis: await isRedisReady(),
    }),
  });

  const server = app.listen(config.port, () => {
    logger.info(`Pricing Service running on port ${config.port}`);
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down...');
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
