import { createApp } from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { EventPublisher } from './events/publisher';
import { BookingService } from './services/booking.service';
import { checkDatabaseReadiness, connectDB, disconnectDB } from './config/db';

export async function start() {
  await connectDB();

  const eventPublisher = new EventPublisher();
  await eventPublisher.connect();

  const bookingService = new BookingService(eventPublisher);

  const app = createApp({
    bookingService,
    getReadiness: async () => ({
      postgres: await checkDatabaseReadiness(),
      rabbitmq: eventPublisher.isConnected(),
    }),
  });

  const server = app.listen(config.port, () => {
    logger.info(`Booking Service running on port ${config.port}`);
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down...');
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
