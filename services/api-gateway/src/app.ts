import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import path from 'node:path';
import fs from 'node:fs';
import { createRequestContextMiddleware } from '../../../shared/dist';
import { config } from './config';
import { authMiddleware } from './middleware/auth';
import { generalLimiter } from './middleware/rate-limit';
import proxyRoutes from './routes/proxy';
import mapRoutes from './routes/map';
import adminRoutes from './routes/admin';
import locationRoutes from './location/location.controller';
import { logger } from './utils/logger';
import { swaggerSpec } from './swagger';
import { collectMetricsText, getMetricsContentType } from './metrics/matching-ai.metrics';

interface GatewayAppOptions {
  getReadiness: () => Promise<Record<string, boolean>>;
  fetchImpl?: typeof fetch;
  serviceHealthChecker?: () => Promise<Record<string, string>>;
  enableRateLimit?: boolean;
}

export function createApp({
  getReadiness,
  fetchImpl = fetch,
  serviceHealthChecker,
  enableRateLimit = false,
}: GatewayAppOptions) {
  const app = express();

  morgan.token('request-id', (req) => req.headers['x-request-id'] as string || '-');

  app.use(createRequestContextMiddleware() as express.RequestHandler);
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(cors({
    origin: '*',
    credentials: true,
  }));
  app.use(morgan(':method :url :status :response-time ms request_id=:request-id', {
    stream: { write: (message) => logger.info(message.trim()) },
  }));
  app.use(express.json({ limit: '25mb' }));

  if (enableRateLimit) {
    app.use(generalLimiter);
  }

  const candidateImageDirs = [
    path.resolve(process.cwd(), 'assets', 'vehicle-images'),
    path.resolve(process.cwd(), '..', '..', 'assets', 'vehicle-images'),
    path.resolve(__dirname, '..', '..', '..', '..', 'assets', 'vehicle-images'),
    // Backward-compatible fallbacks for older workspace layouts.
    path.resolve(process.cwd(), 'img'),
    path.resolve(process.cwd(), '..', '..', 'img'),
    path.resolve(__dirname, '..', '..', '..', '..', 'img'),
  ];
  const vehicleImageDir = candidateImageDirs.find((dirPath) => fs.existsSync(dirPath)) || candidateImageDirs[0];
  app.use('/vehicle-images', express.static(vehicleImageDir));

  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/ready', async (_req, res) => {
    const dependencies = await getReadiness();
    const ready = Object.values(dependencies).every(Boolean);

    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      service: 'api-gateway',
      dependencies,
    });
  });

  app.get('/metrics', async (_req, res) => {
    try {
      res.setHeader('Content-Type', getMetricsContentType());
      res.status(200).send(await collectMetricsText());
    } catch (error) {
      logger.error('Failed to collect Prometheus metrics', error);
      res.status(500).send('metrics_unavailable');
    }
  });

  app.get('/health/services', async (_req, res) => {
    let results: Record<string, string>;

    if (serviceHealthChecker) {
      results = await serviceHealthChecker();
    } else {
      const services = config.services;
      results = {};

      for (const [name, url] of Object.entries(services)) {
        try {
          const response = await fetchImpl(`${url}/health`);
          results[name] = response.ok ? 'healthy' : 'unhealthy';
        } catch {
          results[name] = 'unreachable';
        }
      }
    }

    res.json({
      gateway: 'healthy',
      services: results,
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Cab Booking System API',
  }));

  app.use('/api/location', locationRoutes);
  app.use('/api/map', mapRoutes);
  app.use(authMiddleware);
  app.use('/api/admin', adminRoutes);
  app.use(proxyRoutes);

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: 'Endpoint not found',
      path: req.path,
    });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  });

  return app;
}