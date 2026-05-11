import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from './generated/prisma-client';
import { config } from './config';
import { EventPublisher } from './events/publisher';
import { PaymentController } from './controllers/payment.controller';
import { createPaymentRoutes } from './routes/payment.routes';
import { createWalletRoutes } from './routes/wallet.routes';
import { createVoucherRoutes } from './routes/voucher.routes';
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
  app.use('/api/wallet', createWalletRoutes(prisma, eventPublisher));
  app.use('/api/voucher', createVoucherRoutes(prisma));

  // Internal: aggregate driver earnings (used by api-gateway top-drivers)
  app.get('/internal/drivers/earnings', async (req, res) => {
    try {
      const idsParam = String(req.query.ids || '').trim();
      if (!idsParam) {
        return res.json({ success: true, data: { earnings: {} } });
      }
      const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean);
      if (ids.length === 0) {
        return res.json({ success: true, data: { earnings: {} } });
      }
      const rows = await prisma.driverEarnings.groupBy({
        by: ['driverId'],
        where: { driverId: { in: ids } },
        _sum: { netEarnings: true },
      });
      const earnings: Record<string, number> = {};
      rows.forEach((r) => {
        earnings[r.driverId] = Number(r._sum.netEarnings || 0);
      });
      res.json({ success: true, data: { earnings } });
    } catch (err) {
      logger.error('internal/drivers/earnings failed:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to aggregate driver earnings' },
      });
    }
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });

  return app;
}