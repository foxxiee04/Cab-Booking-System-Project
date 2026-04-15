import { Request, Response, NextFunction } from 'express';
import { WalletService } from '../services/wallet.service';
import { IncentiveService } from '../services/incentive.service';
import { AuthenticatedRequest } from '../middleware/auth';
import { IncentiveRuleType } from '../generated/prisma-client';
import { momoGateway } from '../services/momo.gateway';
import { vnpayGateway } from '../services/vnpay.gateway';
import { logger } from '../utils/logger';
import { resolveDriverId } from '../utils/resolve-driver-id';

export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly incentiveService: IncentiveService,
  ) {}

  // ─── Driver endpoints (requires auth) ───────────────────────────────────

  /**
   * GET /api/wallet
   * Returns the authenticated driver's current balance.
   */
  getWallet = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const driverId = await resolveDriverId(req.user!.userId);
      const data = await this.walletService.getBalance(driverId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/wallet/transactions?limit=20&offset=0
   * Returns paginated wallet transaction history for the authenticated driver.
   */
  getTransactions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const driverId = await resolveDriverId(req.user!.userId);
      const limit = Math.min(parseInt(String(req.query.limit ?? '20')), 100);
      const offset = parseInt(String(req.query.offset ?? '0'));
      const data = await this.walletService.getTransactions(driverId, limit, offset);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/wallet/withdraw
   * Body: { amount: number }
   * Processes a withdrawal request for the authenticated driver.
   */
  withdraw = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const driverId = await resolveDriverId(req.user!.userId);
      const amount = Number(req.body?.amount);
      const bankInfo = req.body?.bankInfo;

      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'amount phải là số dương' },
        });
      }

      const result = await this.walletService.withdraw(driverId, amount, bankInfo);
      res.json({
        success: true,
        data: {
          newBalance: result.newBalance,
          withdrawalId: result.withdrawalId,
          status: result.status,
          bankInfo: result.bankInfo,
        },
      });
    } catch (err: any) {
      if (err.message?.includes('Insufficient')) {
        return res.status(422).json({
          success: false,
          error: { code: 'INSUFFICIENT_BALANCE', message: err.message },
        });
      }
      next(err);
    }
  };

  /**
   * GET /api/wallet/can-accept-cash?commission=X
   * Query whether the authenticated driver can accept a specific cash ride.
   */
  canAcceptCash = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const driverId = await resolveDriverId(req.user!.userId);
      const commission = parseFloat(String(req.query.commission ?? '0'));
      const result = await this.walletService.canAcceptCashRide(driverId, commission);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/wallet/top-up
   * Body: { amount: number }
   * Simulated top-up for the authenticated driver's wallet.
   */
  topUp = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const driverId = await resolveDriverId(req.user!.userId);
      const amount = Number(req.body?.amount);

      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'amount phải là số dương' },
        });
      }

      const result = await this.walletService.topUp(driverId, amount);
      res.json({ success: true, data: { newBalance: result.newBalance } });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/wallet/daily-stats?days=7
   * Returns incentive statistics for the last N days.
   */
  getDailyStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const driverId = await resolveDriverId(req.user!.userId);
      const days = parseInt(String(req.query.days ?? '7'));
      const data = await this.incentiveService.getDailyStats(driverId, days);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  // ─── Top-up via MoMo / VNPay ─────────────────────────────────────────────

  /**
   * POST /api/wallet/top-up/init
   * Body: { amount: number, provider: 'MOMO' | 'VNPAY', returnUrl: string }
   * Initiates a real gateway payment. Returns { topUpId, payUrl }.
   * The driver app should redirect to payUrl.
   */
  initTopUp = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const driverId = await resolveDriverId(req.user!.userId);
      const amount = Number(req.body?.amount);
      const provider = String(req.body?.provider ?? '').toUpperCase() as 'MOMO' | 'VNPAY';
      const returnUrl = String(req.body?.returnUrl ?? '');

      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'amount phải là số dương' },
        });
      }
      if (!['MOMO', 'VNPAY'].includes(provider)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'provider phải là MOMO hoặc VNPAY' },
        });
      }
      if (!returnUrl) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'returnUrl là bắt buộc' },
        });
      }

      const ipAddress = (req.ip || req.socket?.remoteAddress || '127.0.0.1').replace(/^::ffff:/, '');

      const result = await this.walletService.initTopUpPayment(
        driverId,
        amount,
        provider,
        returnUrl,
        ipAddress,
      );

      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      if (err.message?.includes('chưa được cấu hình') || err.message?.includes('tối thiểu')) {
        return res.status(422).json({
          success: false,
          error: { code: 'GATEWAY_ERROR', message: err.message },
        });
      }
      next(err);
    }
  };

  /**
   * POST /api/wallet/top-up/momo-ipn
   * MoMo server-to-server IPN callback (no auth required).
   * Must respond with HTTP 204 on success.
   */
  handleMomoTopUpIpn = async (req: Request, res: Response) => {
    const body = req.body as Record<string, any>;
    const orderId = String(body?.orderId ?? '');
    const resultCode = Number(body?.resultCode ?? -1);

    try {
      // Verify MoMo signature
      const { signature, ...rest } = body;
      const valid = momoGateway.verifyWebhookSignature(rest, signature);
      if (!valid) {
        logger.warn('MoMo top-up IPN: invalid signature', { orderId });
        return res.status(200).json({ resultCode: 1, message: 'Invalid signature' });
      }

      if (resultCode === 0) {
        // Success
        const transId = String(body?.transId ?? body?.requestId ?? '');
        await this.walletService.confirmTopUp(
          orderId,
          transId,
          JSON.stringify(body),
        );
        logger.info(`MoMo top-up IPN: success orderId=${orderId} transId=${transId}`);
      } else {
        // Failure
        await this.walletService.failTopUp(
          orderId,
          `MoMo resultCode=${resultCode}: ${body?.message}`,
          JSON.stringify(body),
        );
        logger.info(`MoMo top-up IPN: failed orderId=${orderId} code=${resultCode}`);
      }

      return res.status(204).send();
    } catch (err: any) {
      logger.error('MoMo top-up IPN error:', err);
      return res.status(200).json({ resultCode: 1, message: 'Internal error' });
    }
  };

  /**
   * GET /api/wallet/top-up/vnpay-ipn
   * VNPay server-to-server IPN (no auth required, GET with query params).
   * Must respond within 5 s with { RspCode, Message }.
   */
  handleVnpayTopUpIpn = async (req: Request, res: Response) => {
    const query = req.query as Record<string, string>;
    const orderInfo = query.vnp_OrderInfo ?? '';
    // orderInfo format: "wallet_topup:{topUpId}"
    const topUpIdMatch = orderInfo.match(/^wallet_topup:([0-9a-fA-F-]{36})$/);

    try {
      // Verify HMAC-SHA512 signature
      const result = vnpayGateway.verifyReturn(query);
      if (!result.valid) {
        logger.warn('VNPay top-up IPN: invalid signature', { txnRef: query.vnp_TxnRef });
        return res.json({ RspCode: '97', Message: 'Fail checksum' });
      }

      if (!topUpIdMatch) {
        logger.warn('VNPay top-up IPN: cannot resolve topUpId', { orderInfo });
        return res.json({ RspCode: '01', Message: 'Order not found' });
      }

      // Find order by topUpId (id) to get orderId
      const topUpId = topUpIdMatch[1];
      const order = await this.walletService.getTopUpOrder(topUpId);
      if (!order) {
        return res.json({ RspCode: '01', Message: 'Order not found' });
      }
      if (order.status === 'COMPLETED') {
        return res.json({ RspCode: '02', Message: 'Order already confirmed' });
      }

      if (result.success) {
        await this.walletService.confirmTopUp(
          order.orderId,
          result.transactionId,
          JSON.stringify(query),
        );
        logger.info(`VNPay top-up IPN: success orderId=${order.orderId} transId=${result.transactionId}`);
      } else {
        await this.walletService.failTopUp(
          order.orderId,
          `VNPay responseCode=${result.responseCode}`,
          JSON.stringify(query),
        );
        logger.info(`VNPay top-up IPN: failed orderId=${order.orderId} code=${result.responseCode}`);
      }

      return res.json({ RspCode: '00', Message: 'Confirm Success' });
    } catch (err) {
      logger.error('VNPay top-up IPN error:', err);
      return res.json({ RspCode: '99', Message: 'Unknown error' });
    }
  };

  /**
   * GET /api/wallet/top-up/status/:topUpId
   * Returns the current status of a wallet top-up order.
   * Used by the driver app callback page to show the result.
   */
  getTopUpStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { topUpId } = req.params;
      const order = await this.walletService.getTopUpOrder(topUpId);

      if (!order) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Top-up order not found' },
        });
      }

      // Only the owning driver can check status
      if (order.driverId !== req.user!.userId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied' },
        });
      }

      res.json({
        success: true,
        data: {
          topUpId: order.id,
          status: order.status,
          amount: order.amount,
          provider: order.provider,
          createdAt: order.createdAt,
          completedAt: order.completedAt,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  // ─── Internal / service-to-service endpoints ────────────────────────────

  /**
   * GET /api/wallet/driver/:driverId/can-accept-cash?commission=X
   * Called by ride-service to validate debt limit before dispatching a cash ride.
   * No user auth required; uses a service secret header instead.
   */
  internalCanAcceptCash = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { driverId } = req.params;
      const commission = parseFloat(String(req.query.commission ?? '0'));
      const result = await this.walletService.canAcceptCashRide(driverId, commission);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  // ─── Admin endpoints ─────────────────────────────────────────────────────

  /**
   * GET /api/wallet/admin/rules
   * List all incentive rules.
   */
  getRules = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.incentiveService.getRules();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/wallet/admin/incentive-rule
   * Body: { type, conditionValue, rewardAmount, description?, isActive? }
   * Creates a new incentive rule.
   */
  createRule = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, conditionValue, rewardAmount, description, isActive } = req.body ?? {};

      if (!Object.values(IncentiveRuleType).includes(type)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `type phải là một trong: ${Object.values(IncentiveRuleType).join(', ')}`,
          },
        });
      }
      if (typeof conditionValue !== 'number' || typeof rewardAmount !== 'number') {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'conditionValue và rewardAmount phải là số' },
        });
      }

      const data = await this.incentiveService.createRule({
        type,
        conditionValue,
        rewardAmount,
        description,
        isActive: isActive !== false,
      });
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /**
   * PATCH /api/wallet/admin/incentive-rule/:id
   * Body: { conditionValue?, rewardAmount?, description?, isActive? }
   */
  updateRule = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { conditionValue, rewardAmount, description, isActive } = req.body ?? {};
      const data = await this.incentiveService.updateRule(id, {
        conditionValue,
        rewardAmount,
        description,
        isActive,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /**
   * DELETE /api/wallet/admin/incentive-rule/:id
   */
  deleteRule = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.incentiveService.deleteRule(req.params.id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/wallet/admin/driver/:driverId
   * Admin view of a specific driver's wallet + recent transactions.
   */
  adminGetDriverWallet = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { driverId } = req.params;
      const limit = Math.min(parseInt(String(req.query.limit ?? '50')), 200);
      const offset = parseInt(String(req.query.offset ?? '0'));
      const [balance, history] = await Promise.all([
        this.walletService.getBalance(driverId),
        this.walletService.getTransactions(driverId, limit, offset),
      ]);
      res.json({ success: true, data: { ...balance, ...history } });
    } catch (err) {
      next(err);
    }
  };
}
