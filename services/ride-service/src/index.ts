import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from './generated/prisma-client';
import { config } from './config';
import { logger } from './utils/logger';
import { EventPublisher } from './events/publisher';
import { EventConsumer } from './events/consumer';
import { RideService } from './services/ride.service';
import { DriverOfferManager } from './services/driver-offer-manager';
import { createRideRouter } from './routes/ride.routes';
import { authenticate } from './middleware/auth.middleware';

const prisma = new PrismaClient();

async function main() {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/health', (_, res) => {
    res.json({ status: 'ok', service: config.serviceName });
  });

  // Connect to database
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

  // Internal routes (service-to-service) protected by INTERNAL_SERVICE_TOKEN
  app.use('/internal', (req, res, next) => {
    const required = process.env.INTERNAL_SERVICE_TOKEN;
    if (!required) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_TOKEN_NOT_CONFIGURED', message: 'INTERNAL_SERVICE_TOKEN not configured' },
      });
    }

    const provided = req.header('x-internal-token');
    if (provided !== required) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Invalid internal token' },
      });
    }

    next();
  });

  app.get('/internal/rides/:rideId', async (req, res) => {
    try {
      const ride = await rideService.getRideById(req.params.rideId);
      if (!ride) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Ride not found' },
        });
      }

      res.json({ success: true, data: { ride } });
    } catch (err) {
      logger.error('Internal get ride error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get ride' },
      });
    }
  });

  app.post('/internal/rides/:rideId/assign', async (req, res) => {
    try {
      const { driverId } = req.body;
      if (!driverId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'driverId required' },
        });
      }

      const ride = await rideService.assignDriver(req.params.rideId, driverId);
      res.json({ success: true, data: { ride } });
    } catch (err) {
      logger.error('Internal assign driver error:', err);
      const message = err instanceof Error ? err.message : 'Failed to assign driver';
      res.status(400).json({
        success: false,
        error: { code: 'ASSIGN_FAILED', message },
      });
    }
  });

  // Routes
  app.use('/api/rides', authenticate, createRideRouter(rideService));

  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });

  // Start server
  app.listen(config.port, () => {
    logger.info(`Ride Service running on port ${config.port}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down...');
    await eventPublisher.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error('Failed to start service:', error);
  process.exit(1);
});
