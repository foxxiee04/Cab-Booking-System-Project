import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from './generated/prisma-client';
import { config } from './config';
import { EventPublisher } from './events/publisher';
import { PaymentController } from './controllers/payment.controller';
import { createPaymentRoutes } from './routes/payment.routes';
import { PaymentService } from './services/payment.service';
import { logger } from './utils/logger';

interface PaymentAppOptions {
  prisma: PrismaClient;
  eventPublisher: EventPublisher;
  getReadiness: () => Promise<Record<string, boolean>>;
}

export function createApp({ prisma, eventPublisher, getReadiness }: PaymentAppOptions) {
  const app = express();
  const paymentService = new PaymentService(prisma, eventPublisher);
  const paymentController = new PaymentController(paymentService);

  app.use(helmet());
  app.use(cors());

  // Stripe requires the raw payload for signature verification.
  app.post(
    '/api/payments/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    paymentController.handleStripeWebhook,
  );

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', service: config.serviceName });
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

  app.use('/api/payments', createPaymentRoutes(paymentService));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });

  return app;
}