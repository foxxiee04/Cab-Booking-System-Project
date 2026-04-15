import { Request, Response, NextFunction } from 'express';
import { VoucherService } from '../services/voucher.service';
import { AuthenticatedRequest } from '../middleware/auth';
import { DiscountType } from '../generated/prisma-client';

export class VoucherController {
  constructor(private readonly voucherService: VoucherService) {}

  // ─── Customer endpoints ──────────────────────────────────────────────────

  /**
   * POST /api/voucher/collect
   * Body: { code: string }
   * Saves a voucher to the authenticated customer's account.
   */
  collect = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const code = String(req.body?.code ?? '').trim();

      if (!code) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'code là bắt buộc' },
        });
      }

      const result = await this.voucherService.collectVoucher(userId, code);
      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      if (err.status) {
        return res.status(err.status).json({ success: false, error: { message: err.message } });
      }
      next(err);
    }
  };

  /**
   * GET /api/voucher/my
   * Returns all vouchers saved by the authenticated customer with usability status.
   */
  listMy = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const data = await this.voucherService.listMyVouchers(userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/voucher/public
   * Returns all active, in-window vouchers for discovery.
   * Optional JWT — if provided, each voucher is annotated with `collected`.
   */
  listPublic = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      const data = await this.voucherService.listPublicVouchers(userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/voucher/apply
   * Body: { code: string, fare: number }
   * Previews discount without consuming the voucher.
   * Returns discount_amount and final_price.
   */
  apply = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const code = String(req.body?.code ?? '').trim();
      const fare = Number(req.body?.fare);

      if (!code) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'code là bắt buộc' },
        });
      }
      if (!fare || fare <= 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'fare phải là số dương' },
        });
      }

      const result = await this.voucherService.applyVoucher(userId, code, fare);
      res.json({ success: true, data: result });
    } catch (err: any) {
      if (err.status) {
        return res.status(err.status).json({ success: false, error: { message: err.message } });
      }
      next(err);
    }
  };

  // ─── Admin endpoints ─────────────────────────────────────────────────────

  /**
   * GET /api/voucher/admin
   * Lists all vouchers in the system.
   */
  adminList = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.voucherService.listVouchers();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/voucher/admin
   * Body: Voucher creation fields.
   * Creates a new voucher.
   */
  adminCreate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        code,
        description,
        discountType,
        discountValue,
        maxDiscount,
        minFare,
        startTime,
        endTime,
        usageLimit,
        perUserLimit,
        isActive,
      } = req.body ?? {};

      if (!code || !discountType || discountValue === undefined || !startTime || !endTime) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'code, discountType, discountValue, startTime, endTime là bắt buộc',
          },
        });
      }

      if (!Object.values(DiscountType).includes(discountType)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: `discountType phải là PERCENT hoặc FIXED` },
        });
      }

      const voucher = await this.voucherService.createVoucher({
        code,
        description,
        discountType: discountType as DiscountType,
        discountValue: Number(discountValue),
        maxDiscount: maxDiscount !== undefined ? Number(maxDiscount) : undefined,
        minFare: minFare !== undefined ? Number(minFare) : undefined,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        usageLimit: usageLimit !== undefined ? Number(usageLimit) : undefined,
        perUserLimit: perUserLimit !== undefined ? Number(perUserLimit) : undefined,
        isActive,
      });

      res.status(201).json({ success: true, data: voucher });
    } catch (err: any) {
      if (err.status) {
        return res.status(err.status).json({ success: false, error: { message: err.message } });
      }
      next(err);
    }
  };

  /**
   * PATCH /api/voucher/admin/:id/toggle
   * Body: { isActive: boolean }
   */
  adminToggle = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const isActive = Boolean(req.body?.isActive);
      const voucher = await this.voucherService.toggleVoucher(id, isActive);
      res.json({ success: true, data: voucher });
    } catch (err) {
      next(err);
    }
  };
}
