import axios from 'axios';
import { Request, Response, NextFunction } from 'express';
import { WalletService } from '../services/wallet.service';
import { IncentiveService } from '../services/incentive.service';
import { AuthenticatedRequest } from '../middleware/auth';
import { IncentiveRuleType, TopUpStatus } from '../generated/prisma-client';
import { momoGateway } from '../services/momo.gateway';
import { vnpayGateway } from '../services/vnpay.gateway';
import { logger } from '../utils/logger';
import { resolveDriverId } from '../utils/resolve-driver-id';
import { EventPublisher } from '../events/publisher';
import { config } from '../config';

export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly incentiveService: IncentiveService,
    private readonly eventPublisher?: EventPublisher,
  ) {}

  /**
   * Activate wallet-service (wallet_db) after a top-up is confirmed.
   * Uses a direct HTTP call as the primary path (reliable), with RabbitMQ as backup.
   * Both paths are idempotent — calling twice with the same orderId is safe.
   */
  private async publishTopUpCompleted(
    driverId: string,
    amount: number,
    orderId: string,
    provider: string,
    gatewayTxnId?: string,
  ): Promise<void> {
    // Primary: direct synchronous HTTP call to wallet-service
    try {
      await axios.post(
        `${config.services.wallet}/internal/topup-completed`,
        { driverId, amount, orderId, provider, gatewayTxnId },
        {
          timeout: 5000,
          headers: { 'x-internal-token': config.internalServiceToken },
        },
      );
      logger.info(`wallet-service activated directly for orderId=${orderId} driverId=${driverId}`);
    } catch (err: any) {
      logger.error('Direct wallet activation failed (will fall back to event):', err?.message);
    }

    // Secondary: RabbitMQ event for eventual consistency / redundancy
    if (!this.eventPublisher) return;
    try {
      await this.eventPublisher.publish('wallet.topup.completed', {
        orderId, driverId, amount, provider, gatewayTxnId,
      }, orderId);
    } catch (err) {
      logger.error('Failed to publish wallet.topup.completed event:', err);
    }
  }

  private extractTopUpIdFromVnpayOrderInfo(orderInfo?: string): string {
    if (!orderInfo) {
      return '';
    }

    const match = orderInfo.match(/^wallet_topup:([0-9a-fA-F-]{36})$/);
    return match?.[1] || '';
  }

  private async finalizeTopUpBrowserReturn(
    order: {
      id: string;
      driverId: string;
      orderId: string;
      amount: number;
      provider: string;
      status: TopUpStatus;
    },
    paid: boolean,
    transactionId: string,
    failureReason: string | undefined,
    gatewayMetadata: Record<string, string>,
  ): Promise<{
    paid: boolean;
    status: TopUpStatus;
    newBalance?: number;
    activated?: boolean;
    initialActivationCompleted?: boolean;
    warningThresholdReached?: boolean;
  }> {
    if (order.status === TopUpStatus.COMPLETED) {
      const walletStatus = await this.walletService.getDriverWalletStatus(order.driverId);
      return {
        paid: true,
        status: TopUpStatus.COMPLETED,
        newBalance: walletStatus.balance,
        activated: false,
        initialActivationCompleted: walletStatus.initialActivationCompleted,
        warningThresholdReached: walletStatus.warningThresholdReached,
      };
    }

    if (order.status === TopUpStatus.FAILED) {
      return { paid: false, status: TopUpStatus.FAILED };
    }

    if (paid) {
      const wasInitiallyActivated = await this.walletService.hasCompletedInitialActivation(order.driverId);
      const confirmed = await this.walletService.confirmTopUp(
        order.orderId,
        transactionId || `${order.provider}_RETURN_${Date.now()}`,
        JSON.stringify(gatewayMetadata),
      );
      // Publish event so wallet-service (wallet_db) credits the driver's balance.
      // IPN handlers do the same — publishTopUpCompleted uses orderId as idempotency key
      // so a duplicate event (if IPN also fires) is safely de-duped by the consumer.
      await this.publishTopUpCompleted(order.driverId, confirmed.amount, order.orderId, order.provider, transactionId);
      const walletStatus = await this.walletService.getDriverWalletStatus(order.driverId);
      return {
        paid: true,
        status: TopUpStatus.COMPLETED,
        newBalance: confirmed.newBalance,
        activated: !wasInitiallyActivated && walletStatus.initialActivationCompleted,
        initialActivationCompleted: walletStatus.initialActivationCompleted,
        warningThresholdReached: walletStatus.warningThresholdReached,
      };
    }

    await this.walletService.failTopUp(
      order.orderId,
      failureReason || `${order.provider} return failed`,
      JSON.stringify(gatewayMetadata),
    );

    return { paid: false, status: TopUpStatus.FAILED };
  }

  // ─── Driver endpoints (requires auth) ───────────────────────────────────

  /**
   * GET /api/wallet
   * Returns the authenticated driver's current balance.
   */
  getWallet = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const driverId = await resolveDriverId(req.user!.userId);
      const data = await this.walletService.getDriverWalletStatus(driverId);
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
      // NOTE: wallet-service (wallet_db) is keyed by auth userId (JWT sub) today.
      // Using resolveDriverId() here would credit a different wallet row and make
      // the driver-app balance look "stuck" after top-up.
      const driverId = req.user!.userId;
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
        const confirmed = await this.walletService.confirmTopUp(
          orderId,
          transId,
          JSON.stringify(body),
        );
        await this.publishTopUpCompleted(confirmed.driverId, confirmed.amount, orderId, 'MOMO', transId);
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
   * GET /api/wallet/top-up/momo/return
   * Browser callback for MoMo wallet top-up.
   */
  handleMomoTopUpReturn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as Record<string, string>;
      const topUpId = query.topUpId || '';
      const orderId = String(query.orderId || query.order_id || '');
      const resultCode = Number(query.resultCode ?? query.result_code ?? -1);
      const paid = resultCode === 0;

      if (!topUpId && !orderId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Thiếu topUpId/orderId từ callback MoMo' },
        });
      }

      const order = topUpId
        ? await this.walletService.getTopUpOrder(topUpId)
        : await this.walletService.getTopUpOrderByOrderId(orderId);
      if (!order) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Top-up order not found' },
        });
      }

      const returnedAmount = Number(query.amount ?? 0);
      if (Number.isFinite(returnedAmount) && returnedAmount > 0 && Math.round(order.amount) !== Math.round(returnedAmount)) {
        logger.warn('MoMo top-up return: amount mismatch', { topUpId, expected: order.amount, received: returnedAmount });
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_AMOUNT', message: 'Số tiền trả về không hợp lệ' },
        });
      }

      const finalResult = await this.finalizeTopUpBrowserReturn(
        order,
        paid,
        String(query.transId ?? query.requestId ?? ''),
        paid ? undefined : (query.message || `MoMo code: ${resultCode}`),
        query,
      );

      return res.json({
        success: true,
        data: {
          topUpId: order.id,
          paid: finalResult.paid,
          status: finalResult.status,
          amount: order.amount,
          provider: order.provider,
          newBalance: finalResult.newBalance,
          activated: finalResult.activated,
          initialActivationCompleted: finalResult.initialActivationCompleted,
          warningThresholdReached: finalResult.warningThresholdReached,
          transactionId: query.transId || query.requestId || '',
          resultCode,
          message: finalResult.paid
            ? (finalResult.activated
              ? 'Nạp ví thành công qua MoMo. Tài khoản tài xế đã được kích hoạt.'
              : finalResult.initialActivationCompleted === false
                ? 'Nạp ví thành công qua MoMo nhưng ví vẫn chưa đạt mốc kích hoạt 300.000 đ.'
                : finalResult.warningThresholdReached
                  ? 'Nạp ví thành công qua MoMo. Tài khoản vẫn hoạt động nhưng số dư còn thấp, nên nạp thêm để tránh bị khóa nhận cuốc.'
              : (query.message || 'Nạp ví thành công qua MoMo'))
            : (query.message || 'Giao dịch MoMo không thành công'),
        },
      });
    } catch (err) {
      next(err);
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
        const confirmed = await this.walletService.confirmTopUp(
          order.orderId,
          result.transactionId,
          JSON.stringify(query),
        );
        await this.publishTopUpCompleted(confirmed.driverId, confirmed.amount, order.orderId, 'VNPAY', result.transactionId);
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
   * GET /api/wallet/top-up/vnpay/return
   * Browser callback for VNPay wallet top-up.
   */
  handleVnpayTopUpReturn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as Record<string, string>;
      const result = vnpayGateway.verifyReturn(query);
      const topUpId = query.topUpId || this.extractTopUpIdFromVnpayOrderInfo(query.vnp_OrderInfo);

      if (!topUpId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Không xác định được topUpId từ callback VNPay' },
        });
      }

      if (!result.valid) {
        logger.warn('VNPay top-up return: invalid signature', { topUpId, txnRef: result.txnRef });
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_SIGNATURE', message: 'Chữ ký không hợp lệ' },
        });
      }

      const order = await this.walletService.getTopUpOrder(topUpId);
      if (!order) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Top-up order not found' },
        });
      }

      if (Math.round(order.amount) !== Math.round(result.amount)) {
        logger.warn('VNPay top-up return: amount mismatch', {
          topUpId,
          expected: order.amount,
          received: result.amount,
        });
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_AMOUNT', message: 'Số tiền trả về không hợp lệ' },
        });
      }

      const finalResult = await this.finalizeTopUpBrowserReturn(
        order,
        result.success,
        result.transactionId,
        result.success ? undefined : `VNPay code: ${result.responseCode}`,
        query,
      );

      return res.json({
        success: true,
        data: {
          topUpId: order.id,
          paid: finalResult.paid,
          status: finalResult.status,
          amount: order.amount,
          provider: order.provider,
          newBalance: finalResult.newBalance,
          activated: finalResult.activated,
          initialActivationCompleted: finalResult.initialActivationCompleted,
          warningThresholdReached: finalResult.warningThresholdReached,
          transactionId: result.transactionId,
          responseCode: result.responseCode,
          message: finalResult.paid
            ? (finalResult.activated
              ? 'Nạp ví thành công qua VNPay. Tài khoản tài xế đã được kích hoạt.'
              : finalResult.initialActivationCompleted === false
                ? 'Nạp ví thành công qua VNPay nhưng ví vẫn chưa đạt mốc kích hoạt 300.000 đ.'
                : finalResult.warningThresholdReached
                  ? 'Nạp ví thành công qua VNPay. Tài khoản vẫn hoạt động nhưng số dư còn thấp, nên nạp thêm để tránh bị khóa nhận cuốc.'
              : 'Nạp ví thành công qua VNPay')
            : `Giao dịch VNPay không thành công (${result.responseCode})`,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/wallet/top-up/sandbox-confirm
   * Body: { topUpId: string, success: boolean }
   * Sandbox-only endpoint to simulate gateway IPN for wallet top-up.
   * Only works in non-production environments.
   */
  sandboxConfirmTopUp = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SANDBOX_ENDPOINT !== 'true') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Sandbox endpoint not available in production' },
        });
      }

      const driverId = req.user!.userId; // wallet orders are keyed by userId, not driverId
      const { topUpId, success: paid } = req.body;

      if (!topUpId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'topUpId là bắt buộc' },
        });
      }

      const order = await this.walletService.getTopUpOrder(topUpId);
      if (!order) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Top-up order not found' },
        });
      }
      if (order.driverId !== driverId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied' },
        });
      }

      if (paid !== false) {
        // Confirm top-up (credit wallet)
        const result = await this.walletService.confirmTopUp(
          order.orderId,
          `SANDBOX_MOCK_${Date.now()}`,
          JSON.stringify({ sandbox: true, confirmedAt: new Date().toISOString() }),
        );
        await this.publishTopUpCompleted(result.driverId, result.amount, order.orderId, order.provider, result.topUpId);
        logger.info(`Sandbox top-up confirmed: topUpId=${topUpId} amount=${order.amount}`);
        return res.json({ success: true, data: result });
      } else {
        // Fail the top-up
        await this.walletService.failTopUp(order.orderId, 'Sandbox: user declined', '{}');
        logger.info(`Sandbox top-up declined: topUpId=${topUpId}`);
        return res.json({ success: true, data: { topUpId, status: 'FAILED' } });
      }
    } catch (err) {
      next(err);
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

      // Only the owning driver can check status; orders are keyed by userId
      const driverId = req.user!.userId;
      if (order.driverId !== driverId) {
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

  /**
   * GET /api/wallet/driver/:driverId/status
   * Internal status endpoint used by driver-service before allowing a driver
   * to go online and receive rides.
   */
  internalGetDriverWalletStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { driverId } = req.params;
      const [walletStatus, completedRideCount] = await Promise.all([
        this.walletService.getDriverWalletStatus(driverId),
        this.walletService.getCompletedRideCount(driverId),
      ]);

      res.json({
        success: true,
        data: {
          driverId,
          balance: walletStatus.balance,
          completedRideCount,
          canAcceptRide: walletStatus.canAcceptRide,
          reason: walletStatus.reason,
          initialActivationCompleted: walletStatus.initialActivationCompleted,
          activationRequired: walletStatus.activationRequired,
          warningThresholdReached: walletStatus.warningThresholdReached,
          activationThreshold: walletStatus.activationThreshold,
          warningThreshold: walletStatus.warningThreshold,
          debtLimit: walletStatus.debtLimit,
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
