import { Router } from 'express';
import { PrismaClient } from '../generated/prisma-client';
import { WalletService } from '../services/wallet.service';
import { IncentiveService } from '../services/incentive.service';
import { WalletController } from '../controllers/wallet.controller';
import { authMiddleware } from '../middleware/auth';

export function createWalletRoutes(prisma: PrismaClient): Router {
  const router = Router();

  const walletService = new WalletService(prisma);
  const incentiveService = new IncentiveService(prisma, walletService);
  const controller = new WalletController(walletService, incentiveService);

  // ─── Driver self-service (JWT required) ─────────────────────────────────
  router.get('/', authMiddleware, controller.getWallet);
  router.get('/transactions', authMiddleware, controller.getTransactions);
  router.post('/withdraw', authMiddleware, controller.withdraw);
  router.post('/top-up', authMiddleware, controller.topUp);
  router.get('/can-accept-cash', authMiddleware, controller.canAcceptCash);
  router.get('/daily-stats', authMiddleware, controller.getDailyStats);

  // ─── Real gateway top-up (MoMo / VNPay) ─────────────────────────────────
  // Initiate payment — authenticated
  router.post('/top-up/init', authMiddleware, controller.initTopUp);
  // Check order status — authenticated
  router.get('/top-up/status/:topUpId', authMiddleware, controller.getTopUpStatus);
  // MoMo IPN — called server-to-server by MoMo (no auth)
  router.post('/top-up/momo-ipn', controller.handleMomoTopUpIpn);
  // VNPay IPN — called server-to-server by VNPay (GET, no auth)
  router.get('/top-up/vnpay-ipn', controller.handleVnpayTopUpIpn);

  // ─── Internal service-to-service (no user JWT needed) ───────────────────
  // Used by ride-service to check debt limit before dispatching a cash ride.
  router.get('/driver/:driverId/can-accept-cash', controller.internalCanAcceptCash);

  // ─── Admin endpoints ─────────────────────────────────────────────────────
  // All admin routes require auth; role enforcement is the API-gateway's job.
  router.get('/admin/rules', authMiddleware, controller.getRules);
  router.post('/admin/incentive-rule', authMiddleware, controller.createRule);
  router.patch('/admin/incentive-rule/:id', authMiddleware, controller.updateRule);
  router.delete('/admin/incentive-rule/:id', authMiddleware, controller.deleteRule);
  router.get('/admin/driver/:driverId', authMiddleware, controller.adminGetDriverWallet);

  return router;
}
