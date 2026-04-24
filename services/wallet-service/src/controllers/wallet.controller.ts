import { Response } from 'express';
import { PrismaClient } from '../generated/prisma-client';
import { AuthenticatedRequest } from '../middleware/auth';
import { DriverWalletService } from '../services/driver-wallet.service';
import { BonusService } from '../services/bonus.service';
import { EventPublisher } from '../events/publisher';
import { logger } from '../utils/logger';

export class WalletController {
  private walletService: DriverWalletService;
  private bonusService:  BonusService;

  constructor(prisma: PrismaClient, eventPublisher: EventPublisher) {
    const { MerchantLedgerService } = require('../services/merchant-ledger.service');
    const ledger = new MerchantLedgerService(prisma);
    this.walletService = new DriverWalletService(prisma, eventPublisher);
    this.bonusService  = new BonusService(prisma, this.walletService, ledger);
  }

  // GET /wallet/balance
  getBalance = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const driverId = req.user!.userId;
      const balance  = await this.walletService.getBalance(driverId);
      res.json({ success: true, data: balance });
    } catch (error) {
      logger.error('getBalance error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch balance' });
    }
  };

  // GET /wallet/transactions
  getTransactions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const driverId = req.user!.userId;
      const page     = parseInt(String(req.query.page  ?? '1'),  10);
      const limit    = parseInt(String(req.query.limit ?? '20'), 10);
      const type     = req.query.type as string | undefined;

      const result = await this.walletService.getTransactions(driverId, { page, limit, type });
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('getTransactions error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch transactions' });
    }
  };

  // POST /wallet/withdraw
  withdraw = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const driverId = req.user!.userId;
      // Support both flat body { amount, bankName, ... } and nested { amount, bankInfo: { bankName, ... } }
      const nested = req.body?.bankInfo ?? {};
      const { amount } = req.body;
      const bankName      = req.body.bankName      ?? nested.bankName;
      const accountNumber = req.body.accountNumber ?? nested.accountNumber;
      const accountHolder = req.body.accountHolder ?? nested.accountHolder;

      if (typeof amount !== 'number' || amount <= 0) {
        res.status(400).json({ success: false, message: 'Invalid withdrawal amount' });
        return;
      }

      const withdrawal = await this.walletService.initiateWithdrawal({
        driverId,
        amount,
        bankName,
        accountNumber,
        accountHolder,
        idempotencyKey: req.headers['idempotency-key'] as string | undefined,
      });

      // Fetch updated balance after withdrawal (balance was debited in initiateWithdrawal)
      const balanceInfo = await this.walletService.getBalance(driverId);

      res.status(201).json({
        success: true,
        data: {
          newBalance:   balanceInfo.balance,
          withdrawalId: withdrawal.id,
          status:       withdrawal.status === 'COMPLETED' ? 'SUCCESS' : 'PENDING',
          bankInfo: withdrawal.bankName ? {
            bankName:      withdrawal.bankName,
            accountNumber: withdrawal.accountNumber,
            accountHolder: withdrawal.accountHolder,
          } : undefined,
        },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Withdrawal failed';
      logger.error('withdraw error:', error);
      res.status(400).json({ success: false, message: msg });
    }
  };

  // POST /wallet/deactivate
  deactivate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const driverId = req.user!.userId;
      const result = await this.walletService.deactivateDriver(driverId);
      res.json({ success: true, data: result });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Deactivate failed';
      logger.error('deactivate wallet error:', error);
      res.status(400).json({ success: false, message: msg });
    }
  };

  // GET /wallet/withdrawals
  getWithdrawals = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const driverId = req.user!.userId;
      const page     = parseInt(String(req.query.page  ?? '1'),  10);
      const limit    = parseInt(String(req.query.limit ?? '10'), 10);
      const result   = await this.walletService.getWithdrawals(driverId, { page, limit });
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('getWithdrawals error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch withdrawals' });
    }
  };

  // GET /wallet/can-accept-cash
  canAcceptCash = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const driverId    = req.user!.userId;
      const canAccept   = await this.walletService.canAcceptCash(driverId);
      res.json({ success: true, data: { canAcceptCash: canAccept } });
    } catch (error) {
      logger.error('canAcceptCash error:', error);
      res.status(500).json({ success: false, message: 'Failed to check cash eligibility' });
    }
  };

  // GET /wallet/daily-stats
  getDailyStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const driverId = req.user!.userId;
      const stats    = await this.bonusService.getDailyStats(driverId);
      res.json({ success: true, data: stats ?? { tripsCompleted: 0, distanceKm: 0, peakTrips: 0, bonusAwarded: 0 } });
    } catch (error) {
      logger.error('getDailyStats error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch daily stats' });
    }
  };

  // GET /wallet/incentive-rules
  getIncentiveRules = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const rules = await this.bonusService.getIncentiveRules();
      res.json({ success: true, data: rules });
    } catch (error) {
      logger.error('getIncentiveRules error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch incentive rules' });
    }
  };
}
