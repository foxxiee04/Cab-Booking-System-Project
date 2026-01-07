import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '../generated/prisma-client';
import { PaymentService } from '../services/payment.service';
import { EventPublisher } from '../events/publisher';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

export const createPaymentRoutes = (prisma: PrismaClient, eventPublisher: EventPublisher) => {
  const paymentService = new PaymentService(prisma, eventPublisher);

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
