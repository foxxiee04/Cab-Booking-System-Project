import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createRequestContextMiddleware } from '../../../shared/dist';
import { config } from './config';
import { authenticate } from './middleware/auth.middleware';
import { requireInternalServiceAuth } from './middleware/internal-auth';
import { createDriverRouter } from './routes/driver.routes';
import { DriverService } from './services/driver.service';
import { logger } from './utils/logger';

interface DriverAppOptions {
  driverService: DriverService;
  getReadiness: () => Promise<Record<string, boolean>>;
}

export function createApp({ driverService, getReadiness }: DriverAppOptions) {
  const app = express();

  app.use(createRequestContextMiddleware() as express.RequestHandler);
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '15mb' }));

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

  app.use('/internal', requireInternalServiceAuth);

  app.get('/internal/drivers/by-user/:userId', async (req, res) => {
    try {
      const driver = await driverService.getDriverByUserId(req.params.userId);
      if (!driver) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Driver not found' },
        });
      }

      return res.json({ success: true, data: { driver } });
    } catch (err) {
      logger.error('Internal get driver by user error:', err);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get driver' },
      });
    }
  });

  app.get('/internal/drivers/:driverId', async (req, res) => {
    try {
      const driver = await driverService.getEnrichedDriverById(req.params.driverId);
      if (!driver) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Driver not found' },
        });
      }

      return res.json({ success: true, data: { driver } });
    } catch (err) {
      logger.error('Internal get driver error:', err);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get driver' },
      });
    }
  });

  app.post('/internal/drivers/:driverId/rating', async (req, res) => {
    try {
      const rating = Number(req.body?.rating);

      if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_RATING', message: 'Rating must be between 1 and 5' },
        });
      }

      await driverService.updateRating(req.params.driverId, rating);
      const driver = await driverService.getDriverById(req.params.driverId);

      return res.json({ success: true, data: { driver } });
    } catch (err) {
      logger.error('Internal update driver rating error:', err);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update driver rating' },
      });
    }
  });

  app.use('/api/drivers', authenticate, createDriverRouter(driverService));

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });

  return app;
}