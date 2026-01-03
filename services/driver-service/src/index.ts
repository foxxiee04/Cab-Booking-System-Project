import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { config } from './config';
import { logger } from './utils/logger';
import { EventPublisher } from './events/publisher';
import { EventConsumer } from './events/consumer';
import { DriverService } from './services/driver.service';
import { createDriverRouter } from './routes/driver.routes';
import { authenticate } from './middleware/auth.middleware';

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

  // Connect to MongoDB
  try {
    await mongoose.connect(config.mongodb.uri);
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }

  // Connect to Redis
  const redis = new Redis(config.redis.url);
  redis.on('connect', () => logger.info('Connected to Redis'));
  redis.on('error', (err) => logger.error('Redis error:', err));

  // Initialize event publisher
  const eventPublisher = new EventPublisher();
  await eventPublisher.connect();

  // Initialize services
  const driverService = new DriverService(redis, eventPublisher);

  // Initialize event consumer
  const eventConsumer = new EventConsumer(driverService);
  await eventConsumer.connect();

  // Routes
  app.use('/api/drivers', authenticate, createDriverRouter(driverService));

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
    logger.info(`Driver Service running on port ${config.port}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down...');
    await eventPublisher.close();
    await eventConsumer.close();
    await mongoose.connection.close();
    redis.disconnect();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error('Failed to start service:', error);
  process.exit(1);
});
