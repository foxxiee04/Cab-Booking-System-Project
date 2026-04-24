import { Router } from 'express';
import { PrismaClient } from '../generated/prisma-client';
import { authMiddleware, requireRole } from '../middleware/auth';
import { AdminController } from '../controllers/admin.controller';
import { EventPublisher } from '../events/publisher';

export function createAdminRoutes(prisma: PrismaClient, eventPublisher: EventPublisher): Router {
  const router     = Router();
  const controller = new AdminController(prisma, eventPublisher);

  // All admin routes require admin or superadmin role
  router.use(authMiddleware, requireRole('admin', 'superadmin'));

  // Merchant ledger
  router.get('/merchant-balance',       controller.getMerchantBalance);
  router.get('/merchant-ledger',        controller.getMerchantLedger);
  router.get('/merchant-ledger/stats',  controller.getMerchantLedgerStats);
  router.get('/reconciliation',         controller.getReconciliation);

  // Driver wallets
  router.get('/drivers',                            controller.getAllDriverWallets);
  router.get('/drivers/:driverId/transactions',     controller.getDriverTransactions);
  router.post('/drivers/:driverId/credit-bonus',    controller.manualCreditBonus);
  router.post('/drivers/:driverId/deactivate',      controller.deactivateDriver);

  // Withdrawal requests
  router.get('/withdrawals',              controller.getWithdrawals);
  router.post('/withdrawals/:id/approve', controller.approveWithdrawal);
  router.post('/withdrawals/:id/reject',  controller.rejectWithdrawal);

  // Incentive rules
  router.get('/incentive-rules',        controller.getIncentiveRules);
  router.post('/incentive-rules',       controller.createIncentiveRule);
  router.patch('/incentive-rules/:id',  controller.updateIncentiveRule);
  router.delete('/incentive-rules/:id', controller.deleteIncentiveRule);

  // Bank simulation layer (mock bank accounts + transaction trail)
  router.get('/bank-accounts',     controller.getBankAccounts);
  router.get('/bank-transactions', controller.getBankTransactions);

  return router;
}
