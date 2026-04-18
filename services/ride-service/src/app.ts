import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createRequestContextMiddleware } from '../../../shared/dist';
import { config } from './config';
import { requireInternalServiceAuth } from './middleware/internal-auth';
import { authenticate } from './middleware/auth.middleware';
import { createRideRouter } from './routes/ride.routes';
import { RideService } from './services/ride.service';
import { logger } from './utils/logger';

interface RideAppOptions {
  rideService: RideService;
  getReadiness: () => Promise<Record<string, boolean>>;
}

export function createApp({ rideService, getReadiness }: RideAppOptions) {
  const app = express();

  app.use(createRequestContextMiddleware() as express.RequestHandler);
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

  app.use('/internal', requireInternalServiceAuth);

  app.get('/internal/rides/:rideId', async (req, res) => {
    try {
      const ride = await rideService.getRideById(req.params.rideId);
      if (!ride) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Ride not found' },
        });
      }

      return res.json({ success: true, data: { ride } });
    } catch (err) {
      logger.error('Internal get ride error:', err);
      return res.status(500).json({
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
      return res.json({ success: true, data: { ride } });
    } catch (err) {
      logger.error('Internal assign driver error:', err);
      const message = err instanceof Error ? err.message : 'Failed to assign driver';
      return res.status(400).json({
        success: false,
        error: { code: 'ASSIGN_FAILED', message },
      });
    }
  });

  app.get('/internal/drivers/:driverId/stats', async (req, res) => {
    try {
      const totalCompletedRides = await rideService.countCompletedRidesForDriver(req.params.driverId);

      return res.json({
        success: true,
        data: {
          totalCompletedRides,
        },
      });
    } catch (err) {
      logger.error('Internal get driver stats error:', err);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get driver stats' },
      });
    }
  });

  app.use('/api/rides', authenticate, createRideRouter(rideService));

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });

  return app;
}