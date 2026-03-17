import { createApp } from './app';
import { config } from './config';
import { checkDatabaseReadiness, prisma } from './config/db';
import { logger } from './utils/logger';
import { EventPublisher } from './events/publisher';
import { AuthService } from './services/auth.service';
import { createHealthServiceRegistration, createHttpBridgeServiceRegistration, shutdownGrpcServer, startGrpcServer } from '../../../shared/dist';

export async function start() {
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL');
  } catch (error) {
    logger.error('PostgreSQL connection error:', error);
    process.exit(1);
  }

  // Initialize event publisher
  const eventPublisher = new EventPublisher();
  await eventPublisher.connect();

  const authService = new AuthService(eventPublisher);
  const getReadiness = async () => ({
    postgres: await checkDatabaseReadiness(),
    rabbitmq: eventPublisher.isConnected(),
  });
  const app = createApp({
    authService,
    getReadiness,
  });

  const grpcServer = await startGrpcServer({
    address: `0.0.0.0:${config.grpcPort}`,
    registrations: [
      createHealthServiceRegistration(config.serviceName, getReadiness),
      createHttpBridgeServiceRegistration(`http://127.0.0.1:${config.port}`),
    ],
  });

  const server = app.listen(config.port, () => {
    logger.info(`Auth Service running on port ${config.port}`);
    logger.info(`Auth gRPC Service running on port ${config.grpcPort}`);
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down...');
    await shutdownGrpcServer(grpcServer);
    await eventPublisher.close();
    await prisma.$disconnect();
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
