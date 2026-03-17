import { createApp } from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { EventPublisher } from './events/publisher';
import { BookingService } from './services/booking.service';
import { checkDatabaseReadiness, connectDB, disconnectDB } from './config/db';
import { createHealthServiceRegistration, createHttpBridgeServiceRegistration, shutdownGrpcServer, startGrpcServer } from '../../../shared/dist';

export async function start() {
  await connectDB();

  const eventPublisher = new EventPublisher();
  await eventPublisher.connect();

  const bookingService = new BookingService(eventPublisher);
  const getReadiness = async () => ({
    postgres: await checkDatabaseReadiness(),
    rabbitmq: eventPublisher.isConnected(),
  });

  const app = createApp({
    bookingService,
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
    logger.info(`Booking Service running on port ${config.port}`);
    logger.info(`Booking gRPC Service running on port ${config.grpcPort}`);
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down...');
    await shutdownGrpcServer(grpcServer);
    await eventPublisher.close();
    await disconnectDB();
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
