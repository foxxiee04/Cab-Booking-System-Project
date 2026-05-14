import { Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma-client';
import { DriverWalletService } from '../services/driver-wallet.service';
import { MerchantLedgerService } from '../services/merchant-ledger.service';
import { EventPublisher } from '../events/publisher';
import { logger } from '../utils/logger';

export class AdminController {
  private walletService:  DriverWalletService;
  private ledgerService:  MerchantLedgerService;
  private prisma:         PrismaClient;

  constructor(prisma: PrismaClient, eventPublisher: EventPublisher) {
    this.prisma         = prisma;
    this.ledgerService  = new MerchantLedgerService(prisma);
    this.walletService  = new DriverWalletService(prisma, eventPublisher);
  }

  // GET /admin/wallet/merchant-ledger
  getMerchantLedger = async (req: Request, res: Response): Promise<void> => {
    try {
      const page      = parseInt(String(req.query.page     ?? '1'),  10);
      const limit     = parseInt(String(req.query.limit    ?? '50'), 10);
      const type      = req.query.type     as string | undefined;
      const category  = req.query.category as string | undefined;
      const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : undefined;
      const endDate   = req.query.endDate   ? new Date(String(req.query.endDate))   : undefined;

      const result = await this.ledgerService.getEntries({ page, limit, type, category, startDate, endDate });
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('getMerchantLedger error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch merchant ledger' });
    }
  };

  // GET /admin/wallet/merchant-ledger/stats
  getMerchantLedgerStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : undefined;
      const endDate   = req.query.endDate   ? new Date(String(req.query.endDate))   : undefined;

      const stats = await this.ledgerService.getStats({ startDate, endDate });
      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('getMerchantLedgerStats error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch merchant ledger stats' });
    }
  };

  // GET /admin/wallet/merchant-balance
  getMerchantBalance = async (_req: Request, res: Response): Promise<void> => {
    try {
      const balance = await this.ledgerService.getBalance();
      res.json({ success: true, data: balance });
    } catch (error) {
      logger.error('getMerchantBalance error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch merchant balance' });
    }
  };

  // GET /admin/wallet/reconciliation
  getReconciliation = async (_req: Request, res: Response): Promise<void> => {
    try {
      const reconciliation = await this.ledgerService.getReconciliation();
      res.json({ success: true, data: reconciliation });
    } catch (error) {
      logger.error('getReconciliation error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch reconciliation' });
    }
  };

  // GET /admin/wallet/drivers
  getAllDriverWallets = async (req: Request, res: Response): Promise<void> => {
    try {
      const page   = parseInt(String(req.query.page   ?? '1'),  10);
      const limit  = parseInt(String(req.query.limit  ?? '20'), 10);
      const status = req.query.status as string | undefined;

      const result = await this.walletService.getAllWallets({ page, limit, status });
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('getAllDriverWallets error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch driver wallets' });
    }
  };

  // GET /admin/wallet/drivers/:driverId/transactions
  getDriverTransactions = async (req: Request, res: Response): Promise<void> => {
    try {
      const { driverId } = req.params;
      const page  = parseInt(String(req.query.page  ?? '1'),  10);
      const limit = parseInt(String(req.query.limit ?? '20'), 10);

      const result = await this.walletService.getTransactions(driverId, { page, limit });
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('getDriverTransactions error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch transactions' });
    }
  };

  // GET /admin/wallet/withdrawals
  getWithdrawals = async (req: Request, res: Response): Promise<void> => {
    try {
      const page   = parseInt(String(req.query.page   ?? '1'),  10);
      const limit  = parseInt(String(req.query.limit  ?? '20'), 10);
      const status = req.query.status as string | undefined;
      const result = await this.walletService.getAllWithdrawals({ page, limit, status });
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('getWithdrawals error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch withdrawals' });
    }
  };

  // POST /admin/wallet/withdrawals/:id/approve
  approveWithdrawal = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await this.walletService.completeWithdrawal(id);
      res.json({ success: true, message: 'Withdrawal approved' });
    } catch (error) {
      logger.error('approveWithdrawal error:', error);
      res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Failed to approve withdrawal' });
    }
  };

  // POST /admin/wallet/withdrawals/:id/reject
  rejectWithdrawal = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      await this.walletService.cancelWithdrawal(id, reason || 'Bị từ chối bởi admin');
      res.json({ success: true, message: 'Withdrawal rejected' });
    } catch (error) {
      logger.error('rejectWithdrawal error:', error);
      res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Failed to reject withdrawal' });
    }
  };

  // ─── Bank Simulation ─────────────────────────────────────────────────────

  // GET /admin/wallet/bank-accounts
  getBankAccounts = async (_req: Request, res: Response): Promise<void> => {
    try {
      const accounts = await (this.prisma as any).systemBankAccount.findMany({
        orderBy: { createdAt: 'asc' },
      });
      res.json({ success: true, data: accounts });
    } catch (error) {
      logger.error('getBankAccounts error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch bank accounts' });
    }
  };

  // GET /admin/wallet/bank-transactions
  getBankTransactions = async (req: Request, res: Response): Promise<void> => {
    try {
      const page        = parseInt(String(req.query.page        ?? '1'),  10);
      const limit       = Math.min(parseInt(String(req.query.limit ?? '30'), 10), 100);
      const type        = req.query.type        as string | undefined;
      const referenceId = req.query.referenceId as string | undefined;

      const where: Record<string, unknown> = {
        createdAt: { lte: new Date() },
      };
      if (type)        where['type']        = type;
      if (referenceId) where['referenceId'] = referenceId;

      const [total, transactions] = await Promise.all([
        (this.prisma as any).bankTransaction.count({ where }),
        (this.prisma as any).bankTransaction.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip:    (page - 1) * limit,
          take:    limit,
        }),
      ]);

      res.json({ success: true, total, page, limit, transactions });
    } catch (error) {
      logger.error('getBankTransactions error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch bank transactions' });
    }
  };

  // POST /admin/wallet/drivers/:driverId/deactivate
  deactivateDriver = async (req: Request, res: Response): Promise<void> => {
    try {
      const { driverId } = req.params;
      const result = await this.walletService.deactivateDriver(driverId);

      logger.info(`Driver ${driverId} deactivated by admin. Refunded ${result.refundedAmount} VND.`);
      res.json({
        success: true,
        message: `Tài xế đã bị ngừng hoạt động. Hệ thống đã đối soát và hoàn trả ${result.refundedAmount.toLocaleString('vi-VN')} VND.`,
        ...result,
      });
    } catch (error) {
      logger.error('deactivateDriver error:', error);
      res.status(500).json({ success: false, message: 'Failed to deactivate driver' });
    }
  };
}
