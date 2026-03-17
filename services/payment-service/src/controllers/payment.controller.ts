import { Response, NextFunction } from 'express';
import { PaymentService } from '../services/payment.service';
import { AuthenticatedRequest } from '../middleware/auth';
import { PaymentStatus } from '../generated/prisma-client';
import { config } from '../config';

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
        { id: 'CARD', name: 'Thẻ tín dụng/ghi nợ', icon: 'card', enabled: config.stripe.enabled, provider: 'STRIPE' },
        { id: 'MOMO', name: 'MoMo', icon: 'wallet', enabled: config.momo.enabled, provider: 'MOMO' },
        { id: 'ZALOPAY', name: 'ZaloPay', icon: 'wallet', enabled: config.zalopay.enabled, provider: 'ZALOPAY' },
      ];
      
      res.json({ success: true, data: { methods } });
    } catch (error) {
      next(error);
    }
  };
}
