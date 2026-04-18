import { Router } from 'express';
import { PrismaClient } from '../generated/prisma-client';
import { VoucherService } from '../services/voucher.service';
import { VoucherController } from '../controllers/voucher.controller';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';

export function createVoucherRoutes(prisma: PrismaClient): Router {
  const router = Router();

  const voucherService = new VoucherService(prisma);
  const controller = new VoucherController(voucherService);

  // ─── Public endpoints (optional JWT) ────────────────────────────────────
  router.get('/public', optionalAuthMiddleware, controller.listPublic);

  // ─── Customer endpoints (JWT required) ──────────────────────────────────
  router.post('/collect', authMiddleware, controller.collect);
  router.get('/my', authMiddleware, controller.listMy);
  router.post('/apply', authMiddleware, controller.apply);

  // ─── Admin endpoints (auth required; role enforcement at API gateway) ────
  router.get('/admin', authMiddleware, controller.adminList);
  router.post('/admin', authMiddleware, controller.adminCreate);
  router.patch('/admin/:id', authMiddleware, controller.adminUpdate);
  router.patch('/admin/:id/toggle', authMiddleware, controller.adminToggle);

  return router;
}
