import { Router } from 'express';
import { PaymentService } from '../services/payment.service';
import { PaymentController } from '../controllers/payment.controller';
import { authMiddleware } from '../middleware/auth';
import {
  validateCreatePaymentIntent,
  validateWebhook,
  validateRefund,
} from '../validators/payment.validator';

export const createPaymentRoutes = (paymentService: PaymentService) => {
  const router = Router();
  const controller = new PaymentController(paymentService);

  // Create card payment intent (modern flow with client secret)
  router.post('/intents', authMiddleware, validateCreatePaymentIntent, controller.createPaymentIntent);

  // Webhook endpoints for provider callbacks and local smoke tests.
  router.post('/webhook/mock', validateWebhook, controller.handleWebhook);
  router.post('/webhooks/mock', validateWebhook, controller.handleWebhook);
  router.post('/webhooks/momo', controller.handleMomoWebhook);

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

  // Get available payment methods
  router.get('/methods', authMiddleware, controller.getPaymentMethods);

  return router;
};
