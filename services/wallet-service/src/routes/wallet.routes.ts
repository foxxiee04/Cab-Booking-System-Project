import { Router } from 'express';
import { PrismaClient } from '../generated/prisma-client';
import { authMiddleware } from '../middleware/auth';
import { WalletController } from '../controllers/wallet.controller';
import { EventPublisher } from '../events/publisher';

export function createWalletRoutes(prisma: PrismaClient, eventPublisher: EventPublisher): Router {
  const router     = Router();
  const controller = new WalletController(prisma, eventPublisher);

  // All wallet routes require authentication
  router.use(authMiddleware);

  router.get('/balance',          controller.getBalance);
  router.get('/transactions',     controller.getTransactions);
  router.post('/withdraw',        controller.withdraw);
  router.post('/deactivate',      controller.deactivate);
  router.get('/withdrawals',      controller.getWithdrawals);
  router.get('/can-accept-cash',  controller.canAcceptCash);
  router.get('/daily-stats',      controller.getDailyStats);
  router.get('/incentive-rules',  controller.getIncentiveRules);

  return router;
}
