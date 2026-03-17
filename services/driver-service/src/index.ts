import Redis from 'ioredis';
import { createApp } from './app';
import { config } from './config';
import { checkDatabaseReadiness, prisma } from './config/db';
import { logger } from './utils/logger';
import { EventPublisher } from './events/publisher';
import { DriverService } from './services/driver.service';
import { startGrpcServer, shutdownGrpcServer, createHttpBridgeServiceRegistration } from '../../../shared/dist';
import { createDriverGrpcRegistrations } from './grpc/driver.server';

export async function start() {
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL');
  } catch (error) {
    logger.error('PostgreSQL connection error:', error);
    process.exit(1);
  }

  // Connect to Redis
  const redis = new Redis(config.redis.url);
  redis.on('connect', () => logger.info('Connected to Redis'));
  redis.on('error', (err) => logger.error('Redis error:', err));

  // Initialize event publisher
  const eventPublisher = new EventPublisher();
  await eventPublisher.connect();

  const driverService = new DriverService(redis, eventPublisher);
  const getReadiness = async () => ({
    postgres: await checkDatabaseReadiness(),
    redis: (await redis.ping()) === 'PONG',
    rabbitmq: eventPublisher.isConnected(),
  });
  const app = createApp({
    driverService,
    getReadiness,
  });

  const grpcServer = await startGrpcServer({
    address: `0.0.0.0:${config.grpcPort}`,
    registrations: [
      ...createDriverGrpcRegistrations(driverService, getReadiness),
      createHttpBridgeServiceRegistration(`http://127.0.0.1:${config.port}`),
    ],
  });

  const server = app.listen(config.port, () => {
    logger.info(`Driver Service running on port ${config.port}`);
    logger.info(`Driver gRPC Service running on port ${config.grpcPort}`);
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down...');
    await shutdownGrpcServer(grpcServer);
    await eventPublisher.close();
    await prisma.$disconnect();
    redis.disconnect();
    server.close();
    process.exit(0);
  });

  return { app, server };
}

if (require.main === module) {
  start().catch((error) => {
    logger.error('Failed to start service:', error);
    process.exit(1);
  });
}
