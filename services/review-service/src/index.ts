import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { config } from './config';
import { logger } from './utils/logger';
import { EventPublisher } from './events/publisher';
import { ReviewService } from './services/review.service';
import { createReviewRouter } from './routes/review.routes';

async function main() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

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

  const eventPublisher = new EventPublisher();
  await eventPublisher.connect();

  const reviewService = new ReviewService(eventPublisher);

  app.use('/api/reviews', createReviewRouter(reviewService));

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });

  app.listen(config.port, () => {
    logger.info(`Review Service running on port ${config.port}`);
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down...');
    await eventPublisher.close();
    await mongoose.disconnect();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
