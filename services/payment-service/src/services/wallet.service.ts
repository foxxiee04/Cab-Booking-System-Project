/**
 * WalletService — Driver Internal Wallet Engine
 *
 * The wallet is the financial centre for every driver.
 * All money flow (earn, commission, bonus, withdraw, refund, top-up) is
 * recorded as an immutable WalletTransaction so the full audit trail
 * is always available.
 *
 * Debt control:
 *   Initial activation requires reaching 300 000 VND once
 *   balance <= DEBT_LIMIT (-200 000 VND) → driver cannot accept new rides
 *   balance <= WARNING_THRESHOLD (-100 000 VND) → warn driver to top up soon
 *   For cash rides we also pre-check: balance - commission < DEBT_LIMIT
 */

import { PrismaClient, WalletTransactionType, TopUpStatus, PaymentStatus } from '../generated/prisma-client';
import { v4 as uuidv4 } from 'uuid';
import { momoGateway } from './momo.gateway';
import { vnpayGateway, VNPayGateway } from './vnpay.gateway';
import { config } from '../config';
import { logger } from '../utils/logger';

export const INITIAL_ACTIVATION_BALANCE = 300_000; // VND
export const WARNING_THRESHOLD = -100_000; // VND
export const DEBT_LIMIT = -200_000; // VND

export class WalletService {
  constructor(private readonly prisma: PrismaClient) {}

  private normalizeVnpayReturnUrl(rawReturnUrl: string): string {
    try {
      const parsed = new URL(rawReturnUrl);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return rawReturnUrl;
    }
  }

  // ─── Internal helpers ────────────────────────────────────────────────────

  /** Fetch or create the wallet row for a driver (idempotent). */
  async getOrCreateWallet(driverId: string) {
    return this.prisma.driverWallet.upsert({
      where: { driverId },
      update: {},
      create: { driverId, balance: 0 },
    });
  }

  /**
   * Apply a signed delta to the driver's balance and record a ledger entry.
   * delta > 0 → credit; delta < 0 → debit.
   */
  private async applyDelta(
    driverId: string,
    delta: number,
    type: WalletTransactionType,
    description: string,
    rideId?: string,
  ): Promise<{ newBalance: number }> {
    return this.prisma.$transaction(async (tx) => {
      // Lock the wallet row for the duration of this transaction
      const wallet = await tx.driverWallet.upsert({
        where: { driverId },
        update: {},
        create: { driverId, balance: 0 },
      });

      const newBalance = wallet.balance + delta;

      await tx.driverWallet.update({
        where: { driverId },
        data: { balance: newBalance },
      });

      await tx.walletTransaction.create({
        data: {
          driverId,
          type,
          amount: Math.abs(delta),
          balanceAfter: newBalance,
          description,
          rideId: rideId ?? null,
        },
      });

      logger.info(
        `Wallet [${driverId}] ${type} ${delta > 0 ? '+' : ''}${delta} VND → balance ${newBalance} VND`,
        { rideId },
      );

      return { newBalance };
    });
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Credit net earnings from an online-paid ride.
   * Called after payment gateway confirms success.
   */
  async creditEarning(driverId: string, amount: number, rideId: string): Promise<number> {
    const { newBalance } = await this.applyDelta(
      driverId,
      amount,
      WalletTransactionType.EARN,
      `Thu nhập chuyến đi (online)`,
      rideId,
    );
    return newBalance;
  }

  /**
   * Debit the platform obligation for a cash ride.
   * The driver collected the full fare in cash; the platform deducts the amount
   * that still needs to be settled after any in-fare bonuses/penalties.
   * This can push the balance negative (debt).
   */
  async debitCommission(driverId: string, commission: number, rideId: string): Promise<number> {
    const { newBalance } = await this.applyDelta(
      driverId,
      -commission,
      WalletTransactionType.COMMISSION,
      `Khấu trừ công nợ chuyến tiền mặt`,
      rideId,
    );
    return newBalance;
  }

  /**
   * Credit an incentive bonus (milestone, peak-hour, etc.).
   */
  async creditBonus(driverId: string, amount: number, description: string, rideId?: string): Promise<number> {
    const { newBalance } = await this.applyDelta(
      driverId,
      amount,
      WalletTransactionType.BONUS,
      description,
      rideId,
    );
    return newBalance;
  }

  /**
   * Process a driver withdrawal request.
   * Returns a withdrawal record with PENDING status, then auto-confirms after a mock delay.
   */
  async withdraw(
    driverId: string,
    amount: number,
    bankInfo?: { bankName: string; accountNumber: string; accountHolder: string },
  ): Promise<{ newBalance: number; withdrawalId: string; status: 'PENDING' | 'SUCCESS'; bankInfo?: typeof bankInfo }> {
    const MIN_WITHDRAWAL = 50_000;
    if (amount <= 0) throw new Error('Withdrawal amount must be positive');
    if (amount < MIN_WITHDRAWAL) {
      throw new Error(`Số tiền rút tối thiểu là ${MIN_WITHDRAWAL.toLocaleString('vi-VN')} VND`);
    }

    const wallet = await this.getOrCreateWallet(driverId);
    if (wallet.balance < amount) {
      throw new Error(
        `Insufficient balance. Available: ${wallet.balance} VND, requested: ${amount} VND`,
      );
    }

    const description = bankInfo
      ? `Rút tiền → ${bankInfo.bankName} ****${bankInfo.accountNumber.slice(-4)} (${bankInfo.accountHolder})`
      : 'Rút tiền';

    const { newBalance } = await this.applyDelta(
      driverId,
      -amount,
      WalletTransactionType.WITHDRAW,
      description,
    );

    // Generate a mock withdrawal ID
    const withdrawalId = `WD_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return {
      newBalance,
      withdrawalId,
      status: 'PENDING',
      bankInfo,
    };
  }

  /**
   * Process a simulated top-up (deposit) for the driver's wallet.
   */
  async topUp(driverId: string, amount: number): Promise<{ newBalance: number }> {
    if (amount <= 0) throw new Error('Top-up amount must be positive');

    return this.applyDelta(
      driverId,
      amount,
      WalletTransactionType.EARN,
      `Nạp tiền ví (giả lập)`,
    );
  }

  /**
   * Reverse a previously credited EARN when an online ride is refunded.
   * Deducts netEarnings from the driver's wallet.
   */
  async reverseEarning(driverId: string, amount: number, rideId: string): Promise<number> {
    const { newBalance } = await this.applyDelta(
      driverId,
      -amount,
      WalletTransactionType.REFUND,
      `Hoàn tiền chuyến đi bị huỷ`,
      rideId,
    );
    return newBalance;
  }

  // ─── Debt control ────────────────────────────────────────────────────────

  async hasCompletedInitialActivation(driverId: string): Promise<boolean> {
    const wallet = await this.getOrCreateWallet(driverId);
    if (wallet.balance >= INITIAL_ACTIVATION_BALANCE) {
      return true;
    }

    const qualifyingTransaction = await this.prisma.walletTransaction.findFirst({
      where: {
        driverId,
        balanceAfter: { gte: INITIAL_ACTIVATION_BALANCE },
      },
      select: { id: true },
    });

    return Boolean(qualifyingTransaction);
  }

  async getDriverWalletStatus(driverId: string): Promise<{
    driverId: string;
    balance: number;
    initialActivationCompleted: boolean;
    activationRequired: boolean;
    warningThresholdReached: boolean;
    canAcceptRide: boolean;
    activationThreshold: number;
    warningThreshold: number;
    debtLimit: number;
    reason?: string;
  }> {
    const wallet = await this.getOrCreateWallet(driverId);
    const initialActivationCompleted = await this.hasCompletedInitialActivation(driverId);
    const activationRequired = !initialActivationCompleted && wallet.balance < INITIAL_ACTIVATION_BALANCE;
    const warningThresholdReached = initialActivationCompleted && wallet.balance <= WARNING_THRESHOLD;
    const canAcceptRide = !activationRequired && wallet.balance > DEBT_LIMIT;

    let reason: string | undefined;
    if (activationRequired) {
      reason = `Tài khoản tài xế mới cần tối thiểu ${INITIAL_ACTIVATION_BALANCE.toLocaleString('vi-VN')} VND trong ví trước khi bật nhận cuốc. Số dư hiện tại: ${wallet.balance.toLocaleString('vi-VN')} VND.`;
    } else if (wallet.balance <= DEBT_LIMIT) {
      reason = `Số dư ví (${wallet.balance.toLocaleString('vi-VN')} VND) đã chạm ngưỡng nợ ${DEBT_LIMIT.toLocaleString('vi-VN')} VND. Vui lòng nạp thêm tiền trước khi nhận cuốc mới.`;
    }

    return {
      driverId,
      balance: wallet.balance,
      initialActivationCompleted,
      activationRequired,
      warningThresholdReached,
      canAcceptRide,
      activationThreshold: INITIAL_ACTIVATION_BALANCE,
      warningThreshold: WARNING_THRESHOLD,
      debtLimit: DEBT_LIMIT,
      reason,
    };
  }

  /**
   * Check whether a driver is allowed to accept a new ride.
   * Returns false when the wallet is already past the debt limit.
   */
  async canAcceptRide(driverId: string): Promise<{ allowed: boolean; balance: number; reason?: string }> {
    const status = await this.getDriverWalletStatus(driverId);
    if (!status.canAcceptRide) {
      return {
        allowed: false,
        balance: status.balance,
        reason: status.reason,
      };
    }
    return { allowed: true, balance: status.balance };
  }

  /**
   * Check whether accepting a specific cash ride is safe.
   * Simulates the commission deduction before it happens.
   */
  async canAcceptCashRide(
    driverId: string,
    commission: number,
  ): Promise<{ allowed: boolean; balance: number; reason?: string }> {
    const status = await this.getDriverWalletStatus(driverId);
    if (status.activationRequired) {
      return {
        allowed: false,
        balance: status.balance,
        reason: status.reason,
      };
    }

    const projectedBalance = status.balance - commission;
    if (projectedBalance <= DEBT_LIMIT) {
      return {
        allowed: false,
        balance: status.balance,
        reason: `Nhận cuốc này sẽ đẩy số dư xuống ${projectedBalance} VND, vượt giới hạn nợ ${DEBT_LIMIT} VND.`,
      };
    }
    return { allowed: true, balance: status.balance };
  }

  // ─── Queries ─────────────────────────────────────────────────────────────

  async getBalance(driverId: string): Promise<{ driverId: string; balance: number }> {
    const wallet = await this.getOrCreateWallet(driverId);
    return { driverId, balance: wallet.balance };
  }

  async getCompletedRideCount(driverId: string): Promise<number> {
    return this.prisma.payment.count({
      where: {
        driverId,
        status: PaymentStatus.COMPLETED,
      },
    });
  }

  async getTransactions(
    driverId: string,
    limit = 20,
    offset = 0,
  ) {
    const [transactions, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: { driverId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.walletTransaction.count({ where: { driverId } }),
    ]);
    return { transactions, total, limit, offset };
  }

  // ─── Top-up via MoMo / VNPay ─────────────────────────────────────────────

  /**
   * Phase 1 of wallet top-up: create a pending WalletTopUpOrder and get the
   * payment redirect URL from the chosen gateway.
   *
   * @param driverId  Authenticated driver's user ID
   * @param amount    VND amount to top up
   * @param provider  'MOMO' | 'VNPAY'
   * @param returnUrl Browser redirect URL after payment (driver app callback page)
   * @param ipAddress Client IP (required by VNPay)
   */
  async initTopUpPayment(
    driverId: string,
    amount: number,
    provider: 'MOMO' | 'VNPAY',
    returnUrl: string,
    ipAddress: string,
  ): Promise<{ topUpId: string; orderId: string; payUrl: string }> {
    if (amount <= 0) throw new Error('Top-up amount must be positive');

    const MIN_TOPUP = 10_000;
    if (amount < MIN_TOPUP) {
      throw new Error(`Số tiền nạp tối thiểu là ${MIN_TOPUP.toLocaleString('vi-VN')} VND`);
    }

    const topUpId = uuidv4();
    const orderId = `TU${topUpId.replace(/-/g, '').slice(0, 14).toUpperCase()}`;
    const orderInfo = `Nạp ví tài xế ${orderId} - ${amount.toLocaleString('vi-VN')}đ`;

    let payUrl: string;

    if (provider === 'MOMO') {
      if (!momoGateway.isEnabled()) {
        throw new Error('MoMo chưa được cấu hình. Vui lòng dùng phương thức khác.');
      }

      const ipnUrl = `${config.momo.notifyUrl || 'http://localhost:3004'}/api/wallet/top-up/momo-ipn`;
      const momoReturn = `${returnUrl}?topUpId=${topUpId}&provider=MOMO`;

      const result = await momoGateway.createPayment({
        orderId,
        amount,
        orderInfo,
        returnUrl: momoReturn,
        notifyUrl: ipnUrl,
        extraData: Buffer.from(JSON.stringify({ topUpId, driverId })).toString('base64'),
      });

      payUrl = result.payUrl;
    } else {
      // VNPAY
      const gateway = new VNPayGateway();
      if (!gateway.isEnabled()) {
        throw new Error('VNPay chưa được cấu hình. Vui lòng dùng phương thức khác.');
      }

      const vnpayReturn = this.normalizeVnpayReturnUrl(returnUrl);

      const result = gateway.createPaymentUrl({
        orderId,
        amount,
        orderInfo: `wallet_topup:${topUpId}`,
        returnUrl: vnpayReturn,
        ipAddress,
      });

      payUrl = result.paymentUrl;
    }

    // Persist the pending order
    await this.prisma.walletTopUpOrder.create({
      data: {
        id: topUpId,
        driverId,
        amount,
        provider,
        orderId,
        status: TopUpStatus.PENDING,
      },
    });

    logger.info(`Wallet top-up initiated: driverId=${driverId} amount=${amount} provider=${provider} orderId=${orderId}`);

    return { topUpId, orderId, payUrl };
  }

  /**
   * Phase 2a: IPN / webhook confirmed SUCCESS.
   * Credits the driver's wallet and marks the order COMPLETED.
   * Idempotent — calling twice with the same orderId is safe.
   */
  async confirmTopUp(
    orderId: string,
    gatewayTxnId: string,
    gatewayResponse: string,
  ): Promise<{ topUpId: string; driverId: string; amount: number; newBalance: number }> {
    const order = await this.prisma.walletTopUpOrder.findUnique({ where: { orderId } });

    if (!order) throw new Error(`WalletTopUpOrder not found: orderId=${orderId}`);
    if (order.status === TopUpStatus.COMPLETED) {
      // Idempotency guard — already credited
      const wallet = await this.getOrCreateWallet(order.driverId);
      return { topUpId: order.id, driverId: order.driverId, amount: order.amount, newBalance: wallet.balance };
    }
    if (order.status === TopUpStatus.FAILED) {
      throw new Error(`Top-up order already FAILED: ${orderId}`);
    }

    // Credit wallet + update order atomically
    const { newBalance } = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.driverWallet.upsert({
        where: { driverId: order.driverId },
        update: {},
        create: { driverId: order.driverId, balance: 0 },
      });

      const newBal = wallet.balance + order.amount;

      await tx.driverWallet.update({
        where: { driverId: order.driverId },
        data: { balance: newBal },
      });

      await tx.walletTransaction.create({
        data: {
          driverId: order.driverId,
          type: WalletTransactionType.TOP_UP,
          amount: order.amount,
          balanceAfter: newBal,
          description: `Nạp ví qua ${order.provider} - ${order.orderId}`,
        },
      });

      await tx.walletTopUpOrder.update({
        where: { orderId },
        data: {
          status: TopUpStatus.COMPLETED,
          gatewayTxnId,
          gatewayResponse,
          completedAt: new Date(),
        },
      });

      return { newBalance: newBal };
    });

    logger.info(`Wallet top-up confirmed: driverId=${order.driverId} amount=${order.amount} newBalance=${newBalance}`);

    return { topUpId: order.id, driverId: order.driverId, amount: order.amount, newBalance };
  }

  /**
   * Phase 2b: IPN / webhook confirmed FAILURE.
   * Marks the order FAILED without touching the wallet balance.
   */
  async failTopUp(orderId: string, reason: string, gatewayResponse?: string): Promise<void> {
    const order = await this.prisma.walletTopUpOrder.findUnique({ where: { orderId } });

    if (!order) {
      logger.warn(`failTopUp: order not found orderId=${orderId}`);
      return;
    }
    if (order.status !== TopUpStatus.PENDING) return; // already resolved

    await this.prisma.walletTopUpOrder.update({
      where: { orderId },
      data: {
        status: TopUpStatus.FAILED,
        gatewayResponse: gatewayResponse ?? null,
        failedAt: new Date(),
      },
    });

    logger.info(`Wallet top-up failed: orderId=${orderId} reason=${reason}`);
  }

  /** Fetch a top-up order by its UUID (topUpId). */
  async getTopUpOrder(topUpId: string) {
    return this.prisma.walletTopUpOrder.findUnique({ where: { id: topUpId } });
  }

  async getTopUpOrderByOrderId(orderId: string) {
    return this.prisma.walletTopUpOrder.findUnique({ where: { orderId } });
  }

  /** Fetch the wallet row for a driver (or null if not found). */
  async getDriverWallet(driverId: string) {
    return this.prisma.driverWallet.findUnique({ where: { driverId } });
  }

  /** Adjust driver wallet balance by delta (positive = credit, negative = debit). */
  async adjustDriverWalletBalance(driverId: string, delta: number): Promise<void> {
    const type = delta >= 0 ? WalletTransactionType.TOP_UP : WalletTransactionType.COMMISSION;
    await this.applyDelta(driverId, delta, type, delta >= 0 ? 'Điều chỉnh số dư (đồng bộ)' : 'Rút tiền (đồng bộ từ ví)');
  }
}
