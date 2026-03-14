import { createApp } from './app';
import { PrismaClient } from './generated/prisma-client';
import { config } from './config';
import { EventPublisher } from './events/publisher';
import { EventConsumer } from './events/consumer';
import { paymentGatewayManager } from './services/payment-gateway.manager';
import { logger } from './utils/logger';

const prisma = new PrismaClient();
const eventPublisher = new EventPublisher();
const eventConsumer = new EventConsumer(prisma, eventPublisher);
let serverRef: ReturnType<ReturnType<typeof createApp>['listen']> | null = null;

export const start = async () => {
  await prisma.$connect();
  logger.info('Connected to PostgreSQL');

  paymentGatewayManager.initialize();

  await eventPublisher.connect();
  await eventConsumer.connect();

  const app = createApp({
    prisma,
    eventPublisher,
    getReadiness: async () => ({
      postgres: await prisma.$queryRawUnsafe('SELECT 1').then(() => true).catch(() => false),
      rabbitmqPublisher: eventPublisher.isConnected(),
      rabbitmqConsumer: eventConsumer.isConnected(),
    }),
  });

  const server = app.listen(config.port, () => {
    logger.info(`Payment Service running on port ${config.port}`);
  });
  serverRef = server;

  return { app, server };
};

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');
  await eventConsumer.close();
  await eventPublisher.close();
  await prisma.$disconnect();
  serverRef?.close();
  process.exit(0);
});

if (require.main === module) {
  start().catch((error) => {
    logger.error('Failed to start Payment Service:', error);
    process.exit(1);
  });
}
