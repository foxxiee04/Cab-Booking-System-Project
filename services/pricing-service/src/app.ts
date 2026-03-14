import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createRequestContextMiddleware } from '../../../shared/dist';
import { config } from './config';
import { createPricingRouter } from './routes/pricing.routes';
import { PricingService } from './services/pricing.service';
import { logger } from './utils/logger';

interface PricingAppOptions {
  pricingService: PricingService;
  getReadiness: () => Promise<Record<string, boolean>>;
}

export function createApp({ pricingService, getReadiness }: PricingAppOptions) {
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

  app.use('/api/pricing', createPricingRouter(pricingService));

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });

  return app;
}