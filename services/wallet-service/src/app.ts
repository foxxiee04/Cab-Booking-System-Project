import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from './generated/prisma-client';
import { EventPublisher } from './events/publisher';
import { DriverWalletService } from './services/driver-wallet.service';
import { createWalletRoutes } from './routes/wallet.routes';
import { createAdminRoutes } from './routes/admin.routes';
import { errorMiddleware } from './middleware/error';
import { logger } from './utils/logger';

interface AppOptions {
  prisma:         PrismaClient;
  eventPublisher: EventPublisher;
  getReadiness:   () => Promise<Record<string, boolean>>;
}

export function createApp({ prisma, eventPublisher, getReadiness }: AppOptions) {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  // ─── Health ─────────────────────────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'wallet-service' });
  });

  app.get('/ready', async (_req: Request, res: Response) => {
    try {
      const checks  = await getReadiness();
      const healthy = Object.values(checks).every(Boolean);
      res.status(healthy ? 200 : 503).json({ status: healthy ? 'ready' : 'not_ready', checks });
    } catch {
      res.status(503).json({ status: 'not_ready' });
    }
  });

  // ─── Routes ─────────────────────────────────────────────────────────────
  app.use('/api/wallet',        createWalletRoutes(prisma, eventPublisher));
  app.use('/api/admin/wallet',  createAdminRoutes(prisma, eventPublisher));

  // Alias without /api prefix (for internal gateway routing)
  app.use('/wallet',        createWalletRoutes(prisma, eventPublisher));
  app.use('/admin/wallet',  createAdminRoutes(prisma, eventPublisher));

  // ─── Internal service-to-service (no user JWT) ──────────────────────────
  // Single shared service instance for internal endpoints (stateless, safe to reuse)
  const internalSvc = new DriverWalletService(prisma, eventPublisher);
  const internalToken: string = (require('./config').config as any).internalServiceToken;

  const requireInternalToken = (req: Request, res: Response): boolean => {
    if (req.headers['x-internal-token'] !== internalToken) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return false;
    }
    return true;
  };

  // Called by payment-service after a top-up is confirmed to activate the wallet.
  // Primary synchronous activation path — more reliable than waiting for RabbitMQ event.
  app.post('/internal/topup-completed', (req: Request, res: Response) => {
    if (!requireInternalToken(req, res)) return;
    const { driverId, amount, orderId, provider, gatewayTxnId } = req.body ?? {};
    if (!driverId || !amount || !orderId) {
      res.status(400).json({ success: false, message: 'driverId, amount and orderId are required' });
      return;
    }
    internalSvc.creditTopUp({ driverId, amount, orderId, provider, gatewayTxnId })
      .then((result: any) => {
        res.json({ success: true, data: { activated: result.activated } });
      })
      .catch((err: any) => {
        res.status(500).json({ success: false, message: err.message || 'Internal error' });
      });
  });

  // Used by driver-service to check wallet status before allowing go-online.
  app.get('/internal/driver/:userId/can-accept', (req: Request, res: Response) => {
    if (!requireInternalToken(req, res)) return;
    internalSvc.getBalance(req.params.userId)
      .then((balance: any) => {
        res.json({
          success: true,
          data: {
            canAcceptRide: balance.canAcceptRide,
            reason: balance.reason,
          },
        });
      })
      .catch((err: any) => {
        res.status(500).json({ success: false, message: err.message || 'Internal error' });
      });
  });

  // ─── 404 ────────────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ success: false, message: 'Not found' });
  });

  app.use(errorMiddleware);

  logger.info('Wallet Service app configured');
  return app;
}
