import { createApp } from './app';
import { PrismaClient } from './generated/prisma-client';
import { config } from './config';
import { logger } from './utils/logger';
import { EventPublisher } from './events/publisher';
import { EventConsumer } from './events/consumer';
import { RideService } from './services/ride.service';
import { DriverOfferManager } from './services/driver-offer-manager';

const prisma = new PrismaClient();

export async function start() {
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL');
  } catch (error) {
    logger.error('Database connection error:', error);
    process.exit(1);
  }

  // Initialize event publisher
  const eventPublisher = new EventPublisher();
  await eventPublisher.connect();

  // Initialize driver offer manager
  const offerManager = new DriverOfferManager();
  await offerManager.setupExpirationNotifications();

  // Initialize services
  const rideService = new RideService(prisma, eventPublisher, offerManager);

  // Subscribe to offer expirations (Redis keyspace notifications)
  await offerManager.subscribeToExpirations(async (rideId: string) => {
    logger.info(`Offer expired for ride ${rideId}, triggering timeout handler`);
    await rideService.handleOfferTimeout(rideId);
  });

  // Initialize event consumer
  const eventConsumer = new EventConsumer(rideService);
  await eventConsumer.connect();
  const app = createApp({
    rideService,
    getReadiness: async () => ({
      postgres: await prisma.$queryRawUnsafe('SELECT 1').then(() => true).catch(() => false),
      redis: await offerManager.ping(),
      rabbitmqPublisher: eventPublisher.isConnected(),
      rabbitmqConsumer: eventConsumer.isConnected(),
    }),
  });

  const server = app.listen(config.port, () => {
    logger.info(`Ride Service running on port ${config.port}`);
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down...');
    await eventConsumer.close();
    await eventPublisher.close();
    await offerManager.close();
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
