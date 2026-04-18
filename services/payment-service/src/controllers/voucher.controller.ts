import { Request, Response, NextFunction } from 'express';
import { VoucherService } from '../services/voucher.service';
import { AuthenticatedRequest } from '../middleware/auth';
import { DiscountType, VoucherAudience } from '../generated/prisma-client';

const parseOptionalNumber = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return Number(value);
};

function parseAdminVoucherPayload(body: any) {
  const {
    code,
    description,
    discountType,
    discountValue,
    audienceType,
    maxDiscount,
    minFare,
    startTime,
    endTime,
    usageLimit,
    perUserLimit,
    isActive,
  } = body ?? {};

  if (!code || !discountType || discountValue === undefined || !startTime || !endTime) {
    throw Object.assign(new Error('code, discountType, discountValue, startTime, endTime là bắt buộc'), {
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  if (!Object.values(DiscountType).includes(discountType)) {
    throw Object.assign(new Error('discountType phải là PERCENT hoặc FIXED'), {
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  if (audienceType !== undefined && !Object.values(VoucherAudience).includes(audienceType)) {
    throw Object.assign(new Error(`audienceType phải là một trong: ${Object.values(VoucherAudience).join(', ')}`), {
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  const parsedStartTime = new Date(startTime);
  const parsedEndTime = new Date(endTime);
  if (Number.isNaN(parsedStartTime.getTime()) || Number.isNaN(parsedEndTime.getTime())) {
    throw Object.assign(new Error('startTime hoặc endTime không hợp lệ'), {
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  if (parsedEndTime <= parsedStartTime) {
    throw Object.assign(new Error('Thời gian kết thúc phải sau thời gian bắt đầu'), {
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  const parsedDiscountValue = Number(discountValue);
  const parsedMaxDiscount = parseOptionalNumber(maxDiscount);
  const parsedMinFare = parseOptionalNumber(minFare);
  const parsedUsageLimit = parseOptionalNumber(usageLimit);
  const parsedPerUserLimit = parseOptionalNumber(perUserLimit);

  if (!Number.isFinite(parsedDiscountValue) || parsedDiscountValue <= 0) {
    throw Object.assign(new Error('discountValue phải là số dương'), {
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  if (parsedMaxDiscount !== undefined && (!Number.isFinite(parsedMaxDiscount) || parsedMaxDiscount <= 0)) {
    throw Object.assign(new Error('maxDiscount phải là số dương'), {
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  if (parsedMinFare !== undefined && (!Number.isFinite(parsedMinFare) || parsedMinFare < 0)) {
    throw Object.assign(new Error('minFare phải là số không âm'), {
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  if (parsedUsageLimit !== undefined && (!Number.isInteger(parsedUsageLimit) || parsedUsageLimit <= 0)) {
    throw Object.assign(new Error('usageLimit phải là số nguyên dương'), {
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  if (parsedPerUserLimit !== undefined && (!Number.isInteger(parsedPerUserLimit) || parsedPerUserLimit <= 0)) {
    throw Object.assign(new Error('perUserLimit phải là số nguyên dương'), {
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  return {
    code: String(code).trim(),
    description: typeof description === 'string' ? description.trim() || undefined : undefined,
    audienceType: audienceType as VoucherAudience | undefined,
    discountType: discountType as DiscountType,
    discountValue: parsedDiscountValue,
    maxDiscount: parsedMaxDiscount,
    minFare: parsedMinFare,
    startTime: parsedStartTime,
    endTime: parsedEndTime,
    usageLimit: parsedUsageLimit,
    perUserLimit: parsedPerUserLimit,
    isActive: typeof isActive === 'boolean' ? isActive : undefined,
  };
}

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
      const voucher = await this.voucherService.createVoucher(parseAdminVoucherPayload(req.body));

      res.status(201).json({ success: true, data: voucher });
    } catch (err: any) {
      if (err.status) {
        return res.status(err.status).json({
          success: false,
          error: { code: err.code || 'VALIDATION_ERROR', message: err.message },
        });
      }
      next(err);
    }
  };

  /**
   * PATCH /api/voucher/admin/:id
   * Body: Voucher update fields.
   * Updates an existing voucher.
   */
  adminUpdate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const voucher = await this.voucherService.updateVoucher(id, parseAdminVoucherPayload(req.body));
      res.json({ success: true, data: voucher });
    } catch (err: any) {
      if (err.status) {
        return res.status(err.status).json({
          success: false,
          error: { code: err.code || 'VALIDATION_ERROR', message: err.message },
        });
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
