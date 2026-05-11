import { Router } from 'express';
import { PaymentService } from '../services/payment.service';
import { PaymentController } from '../controllers/payment.controller';
import { authMiddleware } from '../middleware/auth';
import {
  validateCreatePaymentIntent,
  validateCreateExternalPayment,
  validateWebhook,
  validateRefund,
} from '../validators/payment.validator';

export const createPaymentRoutes = (paymentService: PaymentService) => {
  const router = Router();
  const controller = new PaymentController(paymentService);

  // ─── General ──────────────────────────────────────────────────────────────
  // Independent payment API contract
  router.post('/', validateCreateExternalPayment, controller.createPayment);

  // Create payment intent (for Stripe card flow)
  router.post('/intents', authMiddleware, validateCreatePaymentIntent, controller.createPaymentIntent);

  // Available payment methods
  router.get('/methods', authMiddleware, controller.getPaymentMethods);

  // ─── MoMo ─────────────────────────────────────────────────────────────────
  // POST /api/payments/momo/create - create MoMo payment, returns payUrl
  router.post('/momo/create', authMiddleware, controller.createMomoPayment);

  // POST /api/payments/momo/webhook - MoMo IPN callback (no auth required)
  router.post('/momo/webhook', controller.handleMomoWebhookPost);

  // POST /api/payments/ipn/momo - unified callback contract
  router.post('/ipn/momo', controller.handleUnifiedMomoIpn);

  // GET /api/payments/momo/return - MoMo browser redirect return (no auth)
  router.get('/momo/return', controller.handleMomoReturn);

  // Legacy webhook path (kept for backward compatibility)
  router.post('/webhooks/momo', controller.handleMomoWebhook);

  // ─── VNPay ────────────────────────────────────────────────────────────────
  // POST /api/payments/vnpay/create - create VNPay payment URL
  router.post('/vnpay/create', authMiddleware, controller.createVnpayPayment);

  // GET /api/payments/vnpay/ipn  - VNPay server-to-server IPN callback (no auth—VNPay server calls this)
  router.get('/vnpay/ipn', controller.handleVnpayIpn);

  // POST /api/payments/ipn/vnpay - unified callback contract
  router.post('/ipn/vnpay', controller.handleUnifiedVnpayIpn);

  // GET /api/payments/vnpay/return - VNPay redirect return (no auth—browser redirect)
  router.get('/vnpay/return', controller.handleVnpayReturn);

  // ─── Mock / Testing ───────────────────────────────────────────────────────
  router.post('/webhook/mock', validateWebhook, controller.handleWebhook);
  router.post('/webhooks/mock', validateWebhook, controller.handleWebhook);

  // ─── Queries ──────────────────────────────────────────────────────────────
  router.get('/ride/:rideId', authMiddleware, controller.getPaymentByRideId);
  router.get('/customer/history', authMiddleware, controller.getCustomerPaymentHistory);
  router.get('/driver/earnings', authMiddleware, controller.getDriverEarnings);

  // ─── Admin ────────────────────────────────────────────────────────────────
  router.get('/admin', authMiddleware, controller.getAllPayments);
  router.get('/admin/stats', authMiddleware, controller.getAdminStats);
  router.get('/admin/analytics', authMiddleware, controller.getRevenueAnalytics);
  router.post('/ride/:rideId/refund', authMiddleware, validateRefund, controller.refundPayment);

  // Query payment by paymentId (must be last to avoid route shadowing)
  router.get('/:id', controller.getPaymentById);

  return router;
};
