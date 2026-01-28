import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { logger } from './utils/logger';
import { EventPublisher } from './events/publisher';
import { BookingService } from './services/booking.service';
import { createBookingRouter } from './routes/booking.routes';
import { connectDB, disconnectDB } from './config/db';

async function main() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_, res) => {
    res.json({ status: 'ok', service: config.serviceName });
  });

  // Connect to MongoDB
  await connectDB();

  const eventPublisher = new EventPublisher();
  await eventPublisher.connect();

  const bookingService = new BookingService(eventPublisher);

  app.use('/api/bookings', createBookingRouter(bookingService));

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });

  app.listen(config.port, () => {
    logger.info(`Booking Service running on port ${config.port}`);
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down...');
    await eventPublisher.close();
    await disconnectDB();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
