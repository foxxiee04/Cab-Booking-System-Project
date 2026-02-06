import { Router } from 'express';
import { PrismaClient } from '../generated/prisma-client';
import { PaymentService } from '../services/payment.service';
import { PaymentController } from '../controllers/payment.controller';
import { EventPublisher } from '../events/publisher';
import { authMiddleware } from '../middleware/auth';
import {
  validateCreatePaymentIntent,
  validateWebhook,
  validateRefund,
} from '../validators/payment.validator';

const router = Router();

export const createPaymentRoutes = (prisma: PrismaClient, eventPublisher: EventPublisher) => {
  const paymentService = new PaymentService(prisma, eventPublisher);
  const controller = new PaymentController(paymentService);

  // Create card payment intent (modern flow with client secret)
  router.post('/intents', authMiddleware, validateCreatePaymentIntent, controller.createPaymentIntent);

  // Mock webhook endpoint (replace with provider-specific webhook in production)
  router.post('/webhook/mock', validateWebhook, controller.handleWebhook);

  // Get payment by ride ID
  router.get('/ride/:rideId', authMiddleware, controller.getPaymentByRideId);

  // Get customer payment history
  router.get('/customer/history', authMiddleware, controller.getCustomerPaymentHistory);

  // Get driver earnings
  router.get('/driver/earnings', authMiddleware, controller.getDriverEarnings);

  // Admin: Get all payments
  router.get('/admin', authMiddleware, controller.getAllPayments);

  // Admin: Payment stats
  router.get('/admin/stats', authMiddleware, controller.getAdminStats);

  // Refund payment (admin only)
  router.post('/ride/:rideId/refund', authMiddleware, validateRefund, controller.refundPayment);

  return router;
};
