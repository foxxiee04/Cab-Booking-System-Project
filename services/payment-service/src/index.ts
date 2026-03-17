import { createApp } from './app';
import { PrismaClient } from './generated/prisma-client';
import { config } from './config';
import { EventPublisher } from './events/publisher';
import { EventConsumer } from './events/consumer';
import { paymentGatewayManager } from './services/payment-gateway.manager';
import { logger } from './utils/logger';
import { createHealthServiceRegistration, createHttpBridgeServiceRegistration, shutdownGrpcServer, startGrpcServer } from '../../../shared/dist';

const prisma = new PrismaClient();
const eventPublisher = new EventPublisher();
const eventConsumer = new EventConsumer(prisma, eventPublisher);
let serverRef: ReturnType<ReturnType<typeof createApp>['listen']> | null = null;
let grpcServerRef: any = null;

export const start = async (): Promise<void> => {
  await prisma.$connect();
  logger.info('Connected to PostgreSQL');

  paymentGatewayManager.initialize();

  await eventPublisher.connect();
  await eventConsumer.connect();
  const getReadiness = async () => ({
    postgres: await prisma.$queryRawUnsafe('SELECT 1').then(() => true).catch(() => false),
    rabbitmqPublisher: eventPublisher.isConnected(),
    rabbitmqConsumer: eventConsumer.isConnected(),
  });

  const app = createApp({
    prisma,
    eventPublisher,
    getReadiness,
  });

  const grpcServer = await startGrpcServer({
    address: `0.0.0.0:${config.grpcPort}`,
    registrations: [
      createHealthServiceRegistration(config.serviceName, getReadiness),
      createHttpBridgeServiceRegistration(`http://127.0.0.1:${config.port}`),
    ],
  });
  grpcServerRef = grpcServer;

  const server = app.listen(config.port, () => {
    logger.info(`Payment Service running on port ${config.port}`);
    logger.info(`Payment gRPC Service running on port ${config.grpcPort}`);
  });
  serverRef = server;
};

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');
  await shutdownGrpcServer(grpcServerRef);
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
