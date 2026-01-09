import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '../generated/prisma-client';
import { PaymentService } from '../services/payment.service';
import { EventPublisher } from '../events/publisher';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

export const createPaymentRoutes = (prisma: PrismaClient, eventPublisher: EventPublisher) => {
  const paymentService = new PaymentService(prisma, eventPublisher);

  // Create card payment intent (modern flow with client secret)
  router.post(
    '/intents',
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const idempotencyKey = req.header('Idempotency-Key') || undefined;
        const { rideId, amount, currency = 'VND', paymentMethod = 'CARD' } = req.body;

        if (!rideId || typeof amount !== 'number') {
          return res.status(400).json({ success: false, message: 'rideId and amount are required' });
        }

        const intent = await paymentService.createPaymentIntent({
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
    }
  );

  // Mock webhook endpoint (replace with provider-specific webhook in production)
  router.post(
    '/webhook/mock',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { paymentIntentId, status, transactionId, failureReason } = req.body;
        if (!paymentIntentId || !status) {
          return res.status(400).json({ success: false, message: 'paymentIntentId and status are required' });
        }

        await paymentService.handleMockWebhook({ paymentIntentId, status, transactionId, failureReason });
        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  // Get payment by ride ID
  router.get(
    '/ride/:rideId',
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const payment = await paymentService.getPaymentByRideId(req.params.rideId);
        if (!payment) {
          return res.status(404).json({ success: false, message: 'Payment not found' });
        }
        res.json({ success: true, data: payment });
      } catch (error) {
        next(error);
      }
    }
  );

  // Get customer payment history
  router.get(
    '/customer/history',
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const result = await paymentService.getCustomerPayments(req.user!.userId, page, limit);
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // Get driver earnings
  router.get(
    '/driver/earnings',
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const result = await paymentService.getDriverEarnings(req.user!.userId, page, limit);
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // Refund payment (admin only)
  router.post(
    '/ride/:rideId/refund',
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (req.user!.role !== 'admin') {
          return res.status(403).json({ success: false, message: 'Admin access required' });
        }
        const { reason } = req.body;
        await paymentService.refundPayment(req.params.rideId, reason || 'Admin refund');
        res.json({ success: true, message: 'Refund processed' });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
};
