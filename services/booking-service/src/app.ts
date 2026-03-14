import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { createBookingRouter } from './routes/booking.routes';
import { BookingService } from './services/booking.service';
import { logger } from './utils/logger';

interface BookingAppOptions {
  bookingService: BookingService;
  getReadiness: () => Promise<Record<string, boolean>>;
}

export function createApp({ bookingService, getReadiness }: BookingAppOptions) {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: config.serviceName });
  });

  app.get('/ready', async (_req, res) => {
    const dependencies = await getReadiness();
    const ready = Object.values(dependencies).every(Boolean);

    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      service: config.serviceName,
      dependencies,
    });
  });

  app.use('/api/bookings', createBookingRouter(bookingService));

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });

  return app;
}