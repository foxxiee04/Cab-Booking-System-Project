/**
 * VoucherService — Customer Voucher / Promo Engine
 *
 * Business rules (mirrors Grab):
 *  - Driver is NEVER affected by a voucher; commission always uses gross fare.
 *  - The discount is a cost borne by the platform.
 *  - A voucher can be collected (saved) by a user then applied at booking time.
 *  - On refund the voucher is NOT restored (configurable via RESTORE_ON_REFUND).
 */

import { PrismaClient, DiscountType } from '../generated/prisma-client';
import { logger } from '../utils/logger';

const RESTORE_ON_REFUND = false; // set true to allow reuse after refund

export interface ApplyVoucherResult {
  voucherId: string;
  code: string;
  discountType: DiscountType;
  discountAmount: number; // VND deducted from customer's bill
  finalAmount: number;    // fare - discountAmount (≥ 0)
}

export class VoucherService {
  constructor(private readonly prisma: PrismaClient) {}

  // ─── Collection ──────────────────────────────────────────────────────────

  /**
   * Customer enters a code to save it to their account.
   * Validates the voucher is active and not expired before saving.
   */
  async collectVoucher(userId: string, code: string): Promise<{ message: string; voucherId: string }> {
    const voucher = await this.prisma.voucher.findUnique({ where: { code: code.trim().toUpperCase() } });

    if (!voucher || !voucher.isActive) {
      throw Object.assign(new Error('Mã giảm giá không tồn tại hoặc đã bị vô hiệu'), { status: 404 });
    }

    const now = new Date();
    if (now < voucher.startTime || now > voucher.endTime) {
      throw Object.assign(new Error('Mã giảm giá đã hết hạn hoặc chưa có hiệu lực'), { status: 400 });
    }

    // Check total usage cap
    if (voucher.usageLimit !== null) {
      const totalUsed = await this.prisma.userVoucher.aggregate({
        where: { voucherId: voucher.id },
        _sum: { usedCount: true },
      });
      if ((totalUsed._sum.usedCount ?? 0) >= voucher.usageLimit) {
        throw Object.assign(new Error('Mã giảm giá đã hết lượt sử dụng'), { status: 400 });
      }
    }

    // Upsert: if already saved, just return success
    await this.prisma.userVoucher.upsert({
      where: { userId_voucherId: { userId, voucherId: voucher.id } },
      update: {},
      create: { userId, voucherId: voucher.id, usedCount: 0 },
    });

    logger.info(`User ${userId} collected voucher ${code}`);
    return { message: 'Mã giảm giá đã được lưu vào tài khoản', voucherId: voucher.id };
  }

  // ─── Listing ─────────────────────────────────────────────────────────────

  /**
   * Returns all vouchers saved by a user, annotated with usability status.
   */
  async listMyVouchers(userId: string) {
    const now = new Date();

    const rows = await this.prisma.userVoucher.findMany({
      where: { userId },
      include: { voucher: true },
      orderBy: { savedAt: 'desc' },
    });

    return rows.map((uv) => {
      const v = uv.voucher;
      let status: 'USABLE' | 'EXPIRED' | 'USED_UP';

      if (now < v.startTime || now > v.endTime || !v.isActive) {
        status = 'EXPIRED';
      } else if (uv.usedCount >= v.perUserLimit) {
        status = 'USED_UP';
      } else {
        status = 'USABLE';
      }

      return {
        voucherId: v.id,
        code: v.code,
        description: v.description,
        discountType: v.discountType,
        discountValue: v.discountValue,
        maxDiscount: v.maxDiscount,
        minFare: v.minFare,
        endTime: v.endTime,
        usedCount: uv.usedCount,
        perUserLimit: v.perUserLimit,
        status,
      };
    });
  }

  // ─── Validation & discount calculation ───────────────────────────────────

  /**
   * Preview discount without consuming the voucher.
   * Used by the booking form to show discount in real-time.
   */
  async applyVoucher(userId: string, code: string, fare: number): Promise<ApplyVoucherResult> {
    const normalizedCode = code.trim().toUpperCase();
    const voucher = await this.prisma.voucher.findUnique({ where: { code: normalizedCode } });

    if (!voucher || !voucher.isActive) {
      throw Object.assign(new Error('Mã giảm giá không tồn tại'), { status: 404 });
    }

    const now = new Date();
    if (now < voucher.startTime || now > voucher.endTime) {
      throw Object.assign(new Error('Mã giảm giá đã hết hạn'), { status: 400 });
    }

    if (fare < voucher.minFare) {
      throw Object.assign(
        new Error(`Cuốc xe phải có giá tối thiểu ${voucher.minFare.toLocaleString()} VND để dùng mã này`),
        { status: 400 },
      );
    }

    // Check total usage cap
    if (voucher.usageLimit !== null) {
      const totalUsed = await this.prisma.userVoucher.aggregate({
        where: { voucherId: voucher.id },
        _sum: { usedCount: true },
      });
      if ((totalUsed._sum.usedCount ?? 0) >= voucher.usageLimit) {
        throw Object.assign(new Error('Mã giảm giá đã hết lượt sử dụng'), { status: 400 });
      }
    }

    // Check per-user usage
    const userVoucher = await this.prisma.userVoucher.findUnique({
      where: { userId_voucherId: { userId, voucherId: voucher.id } },
    });

    const usedCount = userVoucher?.usedCount ?? 0;
    if (usedCount >= voucher.perUserLimit) {
      throw Object.assign(new Error('Bạn đã dùng hết lượt cho mã giảm giá này'), { status: 400 });
    }

    // Calculate discount
    let discountAmount: number;
    if (voucher.discountType === DiscountType.PERCENT) {
      discountAmount = (fare * voucher.discountValue) / 100;
      if (voucher.maxDiscount !== null && discountAmount > voucher.maxDiscount) {
        discountAmount = voucher.maxDiscount;
      }
    } else {
      discountAmount = voucher.discountValue;
    }

    // Clamp to fare (can't discount more than the fare itself)
    discountAmount = Math.min(discountAmount, fare);
    const finalAmount = Math.max(0, fare - discountAmount);

    return {
      voucherId: voucher.id,
      code: normalizedCode,
      discountType: voucher.discountType,
      discountAmount,
      finalAmount,
    };
  }

  // ─── Redemption (called after ride/payment completes) ────────────────────

  /**
   * Mark a voucher as used for a user.
   * Called inside the ride-complete / payment-success flow.
   * Returns the discount amount for ledger recording.
   *
   * If the user hasn't collected the voucher yet (code entered directly at
   * booking) we create the UserVoucher row on-the-fly.
   */
  async redeemVoucher(userId: string, voucherId: string): Promise<void> {
    await this.prisma.userVoucher.upsert({
      where: { userId_voucherId: { userId, voucherId } },
      update: { usedCount: { increment: 1 } },
      create: { userId, voucherId, usedCount: 1 },
    });
    logger.info(`Voucher ${voucherId} redeemed by user ${userId}`);
  }

  // ─── Public discovery ──────────────────────────────────────────────────────

  /**
   * Returns all active, in-window vouchers for the discovery screen.
   * No auth required on the route, but user ID is used when provided
   * to annotate whether the voucher is already collected.
   */
  async listPublicVouchers(userId?: string) {
    const now = new Date();
    const vouchers = await this.prisma.voucher.findMany({
      where: { isActive: true, startTime: { lte: now }, endTime: { gte: now } },
      orderBy: { createdAt: 'desc' },
    });

    let collectedIds = new Set<string>();
    if (userId) {
      const uvs = await this.prisma.userVoucher.findMany({ where: { userId }, select: { voucherId: true } });
      collectedIds = new Set(uvs.map((uv) => uv.voucherId));
    }

    return vouchers.map((v) => ({
      voucherId: v.id,
      code: v.code,
      description: v.description,
      discountType: v.discountType,
      discountValue: v.discountValue,
      maxDiscount: v.maxDiscount,
      minFare: v.minFare,
      startTime: v.startTime,
      endTime: v.endTime,
      usageLimit: v.usageLimit,
      perUserLimit: v.perUserLimit,
      collected: collectedIds.has(v.id),
    }));
  }

  // ─── Admin ───────────────────────────────────────────────────────────────

  async createVoucher(data: {
    code: string;
    description?: string;
    discountType: DiscountType;
    discountValue: number;
    maxDiscount?: number;
    minFare?: number;
    startTime: Date;
    endTime: Date;
    usageLimit?: number;
    perUserLimit?: number;
    isActive?: boolean;
  }) {
    const code = data.code.trim().toUpperCase();
    const exists = await this.prisma.voucher.findUnique({ where: { code } });
    if (exists) {
      throw Object.assign(new Error(`Mã ${code} đã tồn tại`), { status: 409 });
    }

    return this.prisma.voucher.create({
      data: {
        code,
        description: data.description,
        discountType: data.discountType,
        discountValue: data.discountValue,
        maxDiscount: data.maxDiscount ?? null,
        minFare: data.minFare ?? 0,
        startTime: data.startTime,
        endTime: data.endTime,
        usageLimit: data.usageLimit ?? null,
        perUserLimit: data.perUserLimit ?? 1,
        isActive: data.isActive ?? true,
      },
    });
  }

  async listVouchers() {
    return this.prisma.voucher.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async toggleVoucher(id: string, isActive: boolean) {
    return this.prisma.voucher.update({ where: { id }, data: { isActive } });
  }
}
