import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../services/payment.service';
import { AuthenticatedRequest } from '../middleware/auth';
import { PaymentStatus } from '../generated/prisma-client';
import { config } from '../config';
import { vnpayGateway } from '../services/vnpay.gateway';
import { logger } from '../utils/logger';

export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  createPaymentIntent = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const idempotencyKey = req.header('Idempotency-Key') || undefined;
      const { rideId, amount, currency = 'VND', paymentMethod = 'CARD' } = req.body;

      const intent = await this.paymentService.createPaymentIntent({
        rideId,
        customerId: req.user!.userId,
        amount,
        currency,
        paymentMethod,
        idempotencyKey,
      });

      res.status(intent.created ? 201 : 200).json({ success: true, data: intent });
    } catch (error) {
      next(error);
    }
  };

  handleWebhook = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { paymentIntentId, status, transactionId, failureReason } = req.body;

      await this.paymentService.handleMockWebhook({ 
        paymentIntentId, 
        status, 
        transactionId, 
        failureReason 
      });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  };

  handleStripeWebhook = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const signature = req.header('stripe-signature');

      if (!signature) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'stripe-signature header is required' },
        });
      }

      await this.paymentService.handleStripeWebhook(req.body, signature);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  };

  handleMomoWebhook = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.paymentService.handleMomoWebhook(req.body);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  };

  getPaymentByRideId = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const payment = await this.paymentService.getPaymentByRideId(req.params.rideId);
      
      if (!payment) {
        return res.status(404).json({ 
          success: false, 
          error: { code: 'NOT_FOUND', message: 'Payment not found' } 
        });
      }

      res.json({ success: true, data: payment });
    } catch (error) {
      next(error);
    }
  };

  getCustomerPaymentHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await this.paymentService.getCustomerPayments(req.user!.userId, page, limit);
      
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getDriverEarnings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await this.paymentService.getDriverEarnings(req.user!.userId, page, limit);
      
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  refundPayment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== 'ADMIN') {
        return res.status(403).json({ 
          success: false, 
          error: { code: 'FORBIDDEN', message: 'Admin access required' } 
        });
      }

      const { reason } = req.body;
      await this.paymentService.refundPayment(req.params.rideId, reason || 'Admin refund');
      
      res.json({ success: true, message: 'Refund processed' });
    } catch (error) {
      next(error);
    }
  };

  getAllPayments = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Admin access required' },
        });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const statusParam = (req.query.status as string | undefined)?.toUpperCase();
      const status = statusParam ? (statusParam as PaymentStatus) : undefined;

      const result = await this.paymentService.getAllPayments(page, limit, status);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getAdminStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Admin access required' },
        });
      }

      const stats = await this.paymentService.getAdminStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  };

  getPaymentMethods = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const methods = [
        { id: 'CASH', name: 'Tiền mặt', icon: 'cash', enabled: true },
        { id: 'MOMO', name: 'Ví MoMo', icon: 'wallet', enabled: config.momo.enabled, provider: 'MOMO' },
        { id: 'VNPAY', name: 'VNPay (ATM/VISA/QR)', icon: 'bank', enabled: config.vnpay.enabled, provider: 'VNPAY' },
        { id: 'CARD', name: 'Thẻ tín dụng/ghi nợ', icon: 'card', enabled: config.stripe.enabled, provider: 'STRIPE' },
      ];
      
      res.json({ success: true, data: { methods } });
    } catch (error) {
      next(error);
    }
  };

  // ─── MoMo ─────────────────────────────────────────────────────────────────

  /**
   * POST /api/payments/momo/create
   * Create a MoMo payment request. Returns a payUrl for the client to redirect to.
   */
  createMomoPayment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { rideId, amount, returnUrl } = req.body;

      if (!rideId || !amount) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'rideId và amount là bắt buộc' },
        });
      }

      // Amount must come from DB, not blindly trusting client
      const intent = await this.paymentService.createPaymentIntent({
        rideId,
        customerId: req.user!.userId,
        amount,
        currency: 'VND',
        paymentMethod: 'MOMO',
        returnUrl,
        idempotencyKey: req.header('Idempotency-Key'),
      });

      res.status(201).json({ success: true, data: intent });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/payments/momo/webhook
   * Handle MoMo IPN (Instant Payment Notification) callback.
   * MoMo sends this asynchronously after payment completion.
   */
  handleMomoWebhookPost = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.paymentService.handleMomoWebhook(req.body);
      // MoMo expects HTTP 204 or JSON with resultCode 0
      res.status(204).send();
    } catch (error) {
      logger.error('MoMo webhook error:', error);
      res.status(200).json({ resultCode: 1, message: 'Failed' });
    }
  };

  /**
   * GET /api/payments/momo/return
   * Handle browser redirect from MoMo sandbox and apply payment status.
   */
  handleMomoReturn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as Record<string, string>;
      const rideId = query.rideId || query.orderId || query.order_id;
      const resultCode = Number(query.resultCode ?? query.result_code ?? -1);
      const success = resultCode === 0;

      if (!rideId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Thiếu rideId/orderId từ callback MoMo' },
        });
      }

      await this.paymentService.applyGatewayReturnByRideId({
        rideId,
        paid: success,
        transactionId: query.transId || query.requestId,
        failureReason: success ? undefined : (query.message || `MoMo code: ${resultCode}`),
        gatewayMetadata: query,
      });

      res.json({
        success: true,
        data: {
          rideId,
          paid: success,
          transactionId: query.transId,
          resultCode,
          message: query.message,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // ─── VNPay ────────────────────────────────────────────────────────────────

  /**
   * POST /api/payments/vnpay/create
   * Create a VNPay payment URL. The client should redirect the user to this URL.
   */
  createVnpayPayment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { rideId, amount, bankCode, returnUrl } = req.body;

      if (!rideId || !amount) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'rideId và amount là bắt buộc' },
        });
      }

      if (!config.vnpay.enabled) {
        return res.status(503).json({
          success: false,
          error: { code: 'GATEWAY_DISABLED', message: 'VNPay chưa được kích hoạt' },
        });
      }

      // Create pending payment record first
      const intent = await this.paymentService.createPaymentIntent({
        rideId,
        customerId: req.user!.userId,
        amount,
        currency: 'VND',
        paymentMethod: 'VNPAY',
        idempotencyKey: req.header('Idempotency-Key'),
      });

      // Build VNPay redirect URL (orderId must be unique, use rideId)
      const { paymentUrl, txnRef } = vnpayGateway.createPaymentUrl({
        amount,
        orderId: rideId.replace(/-/g, '').slice(0, 8), // VNPay max 8 chars
        orderInfo: `Thanh toan chuyen xe ${rideId}`,
        ipAddress: req.ip || '127.0.0.1',
        bankCode,
        returnUrl,
      });

      res.status(201).json({
        success: true,
        data: {
          paymentId: intent.paymentId,
          paymentUrl,
          txnRef,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/payments/vnpay/return
   * Handle VNPay redirect return after user payment (user-facing).
   * Verifies hash, updates payment status, then redirects user to frontend.
   */
  handleVnpayReturn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as Record<string, string>;
      const result = vnpayGateway.verifyReturn(query);
      const rideId = query.rideId || this.extractRideIdFromOrderInfo(query.vnp_OrderInfo);

      if (!rideId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Không xác định được rideId từ callback VNPay' },
        });
      }

      if (!result.valid) {
        logger.warn('VNPay return: invalid signature', { txnRef: result.txnRef });
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_SIGNATURE', message: 'Chữ ký không hợp lệ' },
        });
      }

      await this.paymentService.applyGatewayReturnByRideId({
        rideId,
        paid: result.success,
        transactionId: result.transactionId,
        failureReason: result.success ? undefined : `VNPay code: ${result.responseCode}`,
        gatewayMetadata: query,
      });

      logger.info('VNPay return processed', {
        txnRef: result.txnRef,
        success: result.success,
        responseCode: result.responseCode,
      });

      res.json({
        success: true,
        data: {
          rideId,
          txnRef: result.txnRef,
          transactionId: result.transactionId,
          amount: result.amount,
          responseCode: result.responseCode,
          paid: result.success,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  private extractRideIdFromOrderInfo(orderInfo?: string): string {
    if (!orderInfo) {
      return '';
    }

    const uuidMatch = orderInfo.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
    return uuidMatch?.[0] || '';
  }
}
