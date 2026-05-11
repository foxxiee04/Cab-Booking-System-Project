import { PrismaClient, WalletStatus, TransactionType, TransactionDirection, MerchantLedgerType, MerchantLedgerCategory } from '../generated/prisma-client';
import { config } from '../config';
import { logger } from '../utils/logger';
import { EventPublisher } from '../events/publisher';
import { MerchantLedgerService } from './merchant-ledger.service';
import { BankSimulationService } from './bank-simulation.service';

// ─── Constants ─────────────────────────────────────────────────────────────

const { debtLimit, warningThreshold, initialActivationBalance, minWithdrawal } = config.wallet;
const INACTIVE_WALLET_STATUS = 'INACTIVE' as any;

// ─── Input types ───────────────────────────────────────────────────────────

interface CreditEarningInput {
  driverId: string;
  netEarnings: number;
  grossFare: number;
  platformFee: number;
  voucherDiscount: number;
  rideId: string;
}

interface DebitCommissionInput {
  driverId: string;
  commission: number;
  rideId: string;
}

interface CreditBonusInput {
  driverId: string;
  amount: number;
  description: string;
  rideId?: string;
}

interface CreditTopUpInput {
  driverId: string;
  amount: number;
  orderId: string;
  provider?: string;
  gatewayTxnId?: string;
}

interface InitiateWithdrawalInput {
  driverId: string;
  amount: number;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  idempotencyKey?: string;
}

interface ProcessRefundInput {
  driverId: string;
  netEarnings: number;
  rideId: string;
  reason?: string;
}

interface WalletLedgerState {
  balance: number;
  availableBalance: number;
  pendingBalance: number;
  lockedBalance: number;
  debt: number;
  initialActivationCompleted: boolean;
}

// ─── Merchant balance helper (cast to any until prisma generate runs in container) ──
type PrismaAny = any;

// ─── Service ───────────────────────────────────────────────────────────────

export class DriverWalletService {
  private prisma: PrismaClient;
  private eventPublisher: EventPublisher;
  private ledgerService: MerchantLedgerService;
  private bankSim: BankSimulationService;

  constructor(prisma: PrismaClient, eventPublisher: EventPublisher) {
    this.prisma         = prisma;
    this.eventPublisher = eventPublisher;
    this.ledgerService  = new MerchantLedgerService(prisma);
    this.bankSim        = new BankSimulationService(prisma);
  }

  private toLedgerState(wallet: PrismaAny | null): WalletLedgerState {
    return {
      balance: Math.max(0, Number(wallet?.balance ?? 0)),
      availableBalance: Math.max(0, Number(wallet?.availableBalance ?? 0)),
      pendingBalance: Math.max(0, Number(wallet?.pendingBalance ?? 0)),
      lockedBalance: Math.max(0, Number(wallet?.lockedBalance ?? 0)),
      debt: Math.max(0, Number(wallet?.debt ?? 0)),
      initialActivationCompleted: Boolean(wallet?.initialActivationCompleted),
    };
  }

  private getOperationalBalance(state: Pick<WalletLedgerState, 'availableBalance' | 'debt'>): number {
    return state.availableBalance - state.debt;
  }

  private getSettlementBalance(state: WalletLedgerState, inactiveBalanceOverride?: number): number {
    if (!state.initialActivationCompleted) {
      return Math.max(0, inactiveBalanceOverride ?? state.balance);
    }

    return state.lockedBalance + state.availableBalance + state.pendingBalance - state.debt;
  }

  private getWalletStatus(initialActivationCompleted: boolean, operationalBalance: number): WalletStatus {
    if (!initialActivationCompleted) {
      return INACTIVE_WALLET_STATUS;
    }

    return operationalBalance <= debtLimit ? WalletStatus.BLOCKED : WalletStatus.ACTIVE;
  }

  private applyDebtPaydown(state: WalletLedgerState, amount: number) {
    const debtPaid = Math.min(state.debt, amount);
    state.debt -= debtPaid;
    state.availableBalance += amount - debtPaid;
  }

  /** Settle DebtRecord rows FIFO (oldest first) against a payment amount inside a transaction. */
  private async settleDebtRecordsFifo(tx: PrismaAny, driverId: string, maxAmount: number): Promise<void> {
    if (maxAmount <= 0) return;
    const records = await tx.debtRecord.findMany({
      where: { driverId, status: { not: 'SETTLED' } },
      orderBy: { createdAt: 'asc' },
    });
    let remaining = maxAmount;
    for (const rec of records) {
      if (remaining <= 0) break;
      const pay = Math.min(rec.remaining, remaining);
      remaining -= pay;
      const newRemaining = rec.remaining - pay;
      await tx.debtRecord.update({
        where: { id: rec.id },
        data: {
          remaining: newRemaining,
          status:    newRemaining <= 0 ? 'SETTLED' : rec.status,
          settledAt: newRemaining <= 0 ? new Date() : rec.settledAt,
        },
      });
    }
  }

  // ─── Settle Pending Earnings (T+24h → available) ─────────────────────────

  /**
   * Move eligible pending earnings (> 24h old) into availableBalance.
   * Auto-settles oldest DebtRecords first. Called lazily on getBalance()
   * and also by the background job every hour.
   */
  async settlePendingEarnings(driverId: string): Promise<void> {
    const wallet = await (this.prisma as any).driverWallet.findUnique({ where: { driverId } });
    if (!wallet || Number(wallet.pendingBalance ?? 0) <= 0) return;

    const now = new Date();
    const eligible = await (this.prisma as any).pendingEarning.findMany({
      where: { driverId, settleAt: { lte: now }, settledAt: null },
      orderBy: { settleAt: 'asc' },
    });
    if (eligible.length === 0) return;

    const totalToSettle = eligible.reduce((s: number, e: any) => s + Number(e.amount), 0);
    if (totalToSettle <= 0) return;

    await this.prisma.$transaction(async (tx: PrismaAny) => {
      const fresh = await tx.driverWallet.findUnique({ where: { driverId } });
      if (!fresh) return;

      const state = this.toLedgerState(fresh);
      const settleAmount = Math.min(state.pendingBalance, totalToSettle);
      if (settleAmount <= 0) return;

      // Move from pending to available, paying down debt first
      this.applyDebtPaydown(state, settleAmount);
      state.pendingBalance = Math.max(0, state.pendingBalance - settleAmount);

      const operationalBalance = this.getOperationalBalance(state);
      const newBalance = this.getSettlementBalance(state);
      const newStatus = this.getWalletStatus(state.initialActivationCompleted, operationalBalance);

      await tx.driverWallet.update({
        where: { driverId },
        data: {
          balance:          newBalance,
          availableBalance: state.availableBalance,
          pendingBalance:   state.pendingBalance,
          debt:             state.debt,
          status:           newStatus,
        },
      });

      // Settle debt records FIFO for the amount that paid down debt
      const debtPaid = Math.min(fresh.debt, settleAmount);
      if (debtPaid > 0) {
        await this.settleDebtRecordsFifo(tx, driverId, debtPaid);
      }

      // Mark pending earnings as settled
      const ids = eligible.map((e: any) => e.id);
      await tx.pendingEarning.updateMany({
        where: { id: { in: ids } },
        data:  { settledAt: now },
      });
    });

    logger.info(`Settled ${totalToSettle} VND pending earnings for driver ${driverId}`);
  }

  private applyOperationalDebit(state: WalletLedgerState, amount: number) {
    const fromAvailable = Math.min(state.availableBalance, amount);
    state.availableBalance -= fromAvailable;
    state.debt += amount - fromAvailable;
  }

  private async getBusinessAccounts() {
    try {
      const accounts = await (this.prisma as any).systemBankAccount.findMany({
        where: {
          isActive: true,
          type: { in: ['SETTLEMENT_ACCOUNT', 'PAYOUT_ACCOUNT'] },
        },
      });

      const topUpAccount = accounts.find((account: any) => account.type === 'SETTLEMENT_ACCOUNT') ?? null;
      const payoutAccount = accounts.find((account: any) => account.type === 'PAYOUT_ACCOUNT') ?? topUpAccount ?? null;

      return {
        topUpAccount: topUpAccount
          ? {
              bankName: topUpAccount.bankName,
              accountNumber: topUpAccount.accountNumber,
              accountHolder: topUpAccount.accountHolder,
              description: topUpAccount.description ?? 'Tài khoản doanh nghiệp nhận tiền nạp ví và ký quỹ tài xế.',
              note: 'NAPKYQUY [SO_DIEN_THOAI_TAI_XE]',
            }
          : null,
        payoutAccount: payoutAccount
          ? {
              bankName: payoutAccount.bankName,
              accountNumber: payoutAccount.accountNumber,
              accountHolder: payoutAccount.accountHolder,
              description: payoutAccount.description ?? 'Tài khoản doanh nghiệp dùng để chuyển tiền rút ví cho tài xế.',
            }
          : null,
      };
    } catch (error) {
      logger.warn('Unable to load system bank accounts, using fallback business account info.', error);
    }

    return {
      topUpAccount: {
        bankName: 'Techcombank',
        accountNumber: '8000511204',
        accountHolder: 'Cab Booking System Co., Ltd.',
        description: 'Tài khoản doanh nghiệp nhận tiền nạp ví và ký quỹ tài xế.',
        note: 'NAPKYQUY [SO_DIEN_THOAI_TAI_XE]',
      },
      payoutAccount: {
        bankName: 'Techcombank',
        accountNumber: '8000511204',
        accountHolder: 'Cab Booking System Co., Ltd.',
        description: 'Tài khoản doanh nghiệp dùng để chuyển tiền rút ví cho tài xế.',
      },
    };
  }

  // ─── Wallet Initialisation ───────────────────────────────────────────────

  /**
   * Get or create a driver wallet.
   * New wallets start empty — driver must top-up 300,000 VND to activate.
   * The 300,000 VND becomes lockedBalance (ký quỹ / security deposit).
   */
  async getOrCreateWallet(driverId: string) {
    const existing = await this.prisma.driverWallet.findUnique({ where: { driverId } });
    if (existing) return existing;

    return this.prisma.$transaction(async (tx: any) => {
      const wallet = await tx.driverWallet.create({
        data: {
          driverId,
          balance:          0,
          availableBalance: 0,
          pendingBalance:   0,
          lockedBalance:    0,
          debt:             0,
          status:           INACTIVE_WALLET_STATUS,
          initialActivationCompleted: false,
        },
      });

      logger.info(`Created new wallet for driver ${driverId} — pending activation top-up of ${initialActivationBalance} VND`);
      return wallet;
    });
  }

  // ─── Core Delta Application ──────────────────────────────────────────────

  /**
   * Apply a signed delta to the driver wallet inside a DB transaction.
   * Handles balance, availableBalance, debt, and status updates atomically.
   * Returns the updated wallet and the created transaction record.
   */
  private async applyDelta(params: {
    driverId: string;
    delta: number;          // positive = credit, negative = debit
    type: TransactionType;
    direction: TransactionDirection;
    description?: string;
    referenceId?: string;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
  }) {
    const { driverId, delta, type, direction, description, referenceId, idempotencyKey, metadata } = params;

    // Idempotency check: if key already exists, return existing record
    if (idempotencyKey) {
      const existing = await this.prisma.walletTransaction.findUnique({
        where: { idempotencyKey },
        include: { wallet: true },
      });
      if (existing) {
        logger.warn(`Duplicate idempotencyKey=${idempotencyKey} — skipping`);
        return { wallet: existing.wallet, transaction: existing, alreadyExisted: true as const, newBalance: existing.balanceAfter, newStatus: existing.wallet.status };
      }
    }

    return this.prisma.$transaction(async (tx: any) => this.applyDeltaInTx(tx, params));
  }

  /**
   * Core delta logic executed within a provided transaction client (tx).
   * Does NOT start a new transaction — caller must be inside prisma.$transaction.
   */
  private async applyDeltaInTx(tx: PrismaAny, params: {
    driverId: string;
    delta: number;
    type: TransactionType;
    direction: TransactionDirection;
    description?: string;
    referenceId?: string;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
  }) {
    const { driverId, delta, type, direction, description, referenceId, idempotencyKey, metadata } = params;

    // Idempotency check inside transaction
    if (idempotencyKey) {
      const existing = await tx.walletTransaction.findUnique({
        where: { idempotencyKey },
        include: { wallet: true },
      });
      if (existing) {
        logger.warn(`Duplicate idempotencyKey=${idempotencyKey} — skipping`);
        return { wallet: existing.wallet, transaction: existing, alreadyExisted: true as const, newBalance: existing.balanceAfter, newStatus: existing.wallet.status };
      }
    }

    const wallet = await tx.driverWallet.upsert({
      where: { driverId },
      create: {
        driverId,
        balance:          0,
        availableBalance: 0,
        pendingBalance:   0,
        lockedBalance:    0,
        debt:             0,
        status:           INACTIVE_WALLET_STATUS,
        initialActivationCompleted: false,
      },
      update: {},
    });

    const amount = Math.abs(delta);
    const state = this.toLedgerState(wallet);
    let inactiveBalance = Math.max(0, Number(wallet.balance ?? 0));

    if (!state.initialActivationCompleted) {
      inactiveBalance = Math.max(0, inactiveBalance + delta);

      if (direction === TransactionDirection.CREDIT && type === TransactionType.TOP_UP && inactiveBalance >= initialActivationBalance) {
        state.initialActivationCompleted = true;
        state.lockedBalance = initialActivationBalance;
        state.availableBalance = Math.max(0, inactiveBalance - initialActivationBalance);
        state.debt = 0;
      } else {
        state.availableBalance = 0;
        state.lockedBalance = 0;
        state.debt = 0;
      }
    } else if (direction === TransactionDirection.CREDIT) {
      if (type === TransactionType.REFUND) {
        state.availableBalance += amount;
      } else if (type === TransactionType.EARN) {
        // Online ride earnings go to pendingBalance (T+24h hold before available)
        state.pendingBalance += amount;
      } else {
        // TOP_UP, BONUS: pay down debt first, rest to available
        this.applyDebtPaydown(state, amount);
      }
    } else {
      switch (type) {
        case TransactionType.COMMISSION:
          state.debt += amount;
          break;
        case TransactionType.WITHDRAW:
          state.availableBalance = Math.max(0, state.availableBalance - amount);
          break;
        case TransactionType.REFUND:
        default:
          this.applyOperationalDebit(state, amount);
          break;
      }
    }

    const operationalBalance = this.getOperationalBalance(state);
    const newBalance = this.getSettlementBalance(state, inactiveBalance);
    const newStatus = this.getWalletStatus(state.initialActivationCompleted, operationalBalance);

    const updatedWallet = await tx.driverWallet.update({
      where: { driverId },
      data: {
        balance:          newBalance,
        availableBalance: state.availableBalance,
        pendingBalance:   state.pendingBalance,
        lockedBalance:    state.lockedBalance,
        debt:             state.debt,
        status:           newStatus,
        initialActivationCompleted: state.initialActivationCompleted,
      },
    });

    const transaction = await tx.walletTransaction.create({
      data: {
        driverId,
        type,
        direction,
        amount:        Math.abs(delta),
        balanceAfter:  newBalance,
        description,
        referenceId,
        idempotencyKey,
        metadata:      metadata as any,
      },
    });

    if (state.initialActivationCompleted && operationalBalance <= warningThreshold && operationalBalance > debtLimit) {
      logger.warn(`Driver ${driverId} wallet approaching debt limit: ${operationalBalance} VND`);
    }
    if (newStatus === WalletStatus.BLOCKED) {
      logger.warn(`Driver ${driverId} wallet BLOCKED: operational balance ${operationalBalance} VND`);
    }

    return { wallet: updatedWallet, transaction, alreadyExisted: false as const, newBalance, newStatus };
  }

  /** Upsert the singleton merchant_balance row inside an open transaction. */
  private async upsertMerchantBalance(tx: PrismaAny, deltaIn: number, deltaOut: number) {
    const net = deltaIn - deltaOut;
    await tx.merchantBalance.upsert({
      where:  { id: 1 },
      create: { id: 1, balance: net,          totalIn: deltaIn,             totalOut: deltaOut },
      update: { balance: { increment: net }, totalIn: { increment: deltaIn }, totalOut: { increment: deltaOut } },
    });
  }

  // ─── Case 1: Online Ride Completed ──────────────────────────────────────

  /**
   * Credit driver net earnings from an online-paid ride.
   * Merchant records the full gross fare IN, then pays out the net earnings.
   */
  async creditEarning(input: CreditEarningInput): Promise<void> {
    const { driverId, netEarnings, grossFare, platformFee, voucherDiscount, rideId } = input;

    if (netEarnings <= 0) {
      logger.warn(`Skipping creditEarning for ride ${rideId}: netEarnings=${netEarnings}`);
      return;
    }

    // — all three merchant ledger writes + balance snapshot in one atomic tx —
    const result = await this.prisma.$transaction(async (tx: PrismaAny) => {
      const deltaResult = await this.applyDeltaInTx(tx, {
        driverId,
        delta:         netEarnings,
        type:          TransactionType.EARN,
        direction:     TransactionDirection.CREDIT,
        description:   `Thu nhập chuyến đi (online) - ${rideId}`,
        referenceId:   rideId,
        idempotencyKey: `earn_${rideId}_${driverId}`,
      });

      if (deltaResult.alreadyExisted) return deltaResult;

      // Track individual pending earning for T+24h settlement
      const settleAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await tx.pendingEarning.create({
        data: { driverId, amount: netEarnings, rideId, settleAt },
      });

      // Merchant IN: full gross fare from customer (before voucher)
      await tx.merchantLedger.create({
        data: {
          type:          MerchantLedgerType.IN,
          category:      MerchantLedgerCategory.PAYMENT,
          amount:        grossFare,
          referenceId:   rideId,
          description:   `Thanh toán chuyến đi (online)`,
          idempotencyKey: `ledger_payment_${rideId}`,
          metadata:      { grossFare, platformFee, netEarnings, voucherDiscount } as any,
        },
      });

      // Merchant OUT: net earnings committed to driver (actual fund release at T+24h)
      await tx.merchantLedger.create({
        data: {
          type:          MerchantLedgerType.OUT,
          category:      MerchantLedgerCategory.PAYOUT,
          amount:        netEarnings,
          referenceId:   rideId,
          description:   `Thu nhập tài xế đang giữ (giải ngân sau 24h kể từ hoàn thành chuyến)`,
          idempotencyKey: `ledger_payout_${rideId}`,
        },
      });

      // Merchant OUT: voucher cost absorbed by platform
      if (voucherDiscount > 0) {
        await tx.merchantLedger.create({
          data: {
            type:          MerchantLedgerType.OUT,
            category:      MerchantLedgerCategory.VOUCHER,
            amount:        voucherDiscount,
            referenceId:   rideId,
            description:   `Giảm giá voucher`,
            idempotencyKey: `ledger_voucher_${rideId}`,
          },
        });
      }

      // Snapshot: merchant nets platformFee - voucherCost
      await this.upsertMerchantBalance(tx, grossFare, netEarnings + voucherDiscount);

      return deltaResult;
    });

    // Publish wallet-blocked event outside the transaction
    if (!result.alreadyExisted && result.newStatus === WalletStatus.BLOCKED) {
      await this.eventPublisher.publish('driver.wallet.blocked', { driverId, balance: result.newBalance }).catch(() => {});
    }

    // Bank simulation: customer → MAIN_ACCOUNT (fire-and-forget, non-blocking)
    if (!result.alreadyExisted) {
      await this.bankSim.recordPaymentReceived(rideId, grossFare);
    }

    logger.info(`Credited ${netEarnings} VND to driver ${driverId} for ride ${rideId} (gross: ${grossFare}, fee: ${platformFee})`);
  }

  // ─── Case 2: Cash Ride — Commission Debit ────────────────────────────────

  /**
   * Debit the platform commission from a cash-ride driver.
   * Driver collected the fare in cash; this deducts what is owed to the platform.
   * Balance may go negative (debt) up to the configured limit.
   */
  async debitCommission(input: DebitCommissionInput): Promise<void> {
    const { driverId, commission, rideId } = input;

    if (commission <= 0) return;

    const result = await this.prisma.$transaction(async (tx: PrismaAny) => {
      const deltaResult = await this.applyDeltaInTx(tx, {
        driverId,
        delta:         -commission,
        type:          TransactionType.COMMISSION,
        direction:     TransactionDirection.DEBIT,
        description:   `Khấu trừ phí nền tảng (cuốc tiền mặt)`,
        referenceId:   rideId,
        idempotencyKey: `commission_${rideId}_${driverId}`,
      });

      if (deltaResult.alreadyExisted) return deltaResult;

      // Create a debt record with T+2 day due date
      const dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      await tx.debtRecord.create({
        data: { driverId, amount: commission, remaining: commission, rideId, dueDate },
      });

      // Merchant IN: platform earns commission from cash ride
      await tx.merchantLedger.create({
        data: {
          type:          MerchantLedgerType.IN,
          category:      MerchantLedgerCategory.COMMISSION,
          amount:        commission,
          referenceId:   rideId,
          description:   `Phí nền tảng (cuốc tiền mặt)`,
          idempotencyKey: `ledger_commission_${rideId}`,
        },
      });

      await this.upsertMerchantBalance(tx, commission, 0);
      return deltaResult;
    });

    if (!result.alreadyExisted && result.newStatus === WalletStatus.BLOCKED) {
      await this.eventPublisher.publish('driver.wallet.blocked', { driverId, balance: result.newBalance }).catch(() => {});
    }

    logger.info(`Debited commission ${commission} VND from driver ${driverId} for cash ride ${rideId}`);
  }

  // ─── Case 3: Wallet Top-Up ───────────────────────────────────────────────

  /**
   * Credit the driver wallet after a gateway top-up is confirmed.
   * On first top-up that brings balance >= initialActivationBalance (300K):
   * - sets initialActivationCompleted = true
   * - locks 300K as lockedBalance (security deposit / ký quỹ)
   */
  async creditTopUp(input: CreditTopUpInput): Promise<{ activated: boolean }> {
    const { driverId, amount, orderId, provider, gatewayTxnId } = input;

    if (amount <= 0) return { activated: false };

    let activated = false;
    let alreadyProcessed = false;

    await this.prisma.$transaction(async (tx: PrismaAny) => {
      // Mark top-up order as completed
      await tx.walletTopUpOrder.updateMany({
        where: { orderId, driverId, status: 'PENDING' },
        data:  { status: 'COMPLETED', completedAt: new Date() },
      });

      const beforeWallet = await tx.driverWallet.findUnique({ where: { driverId } });
      const topUpDescription = (beforeWallet?.initialActivationCompleted ?? false)
        ? (provider ? `Nạp tiền ví (${String(provider).toUpperCase()})` : 'Nạp tiền ví')
        : (provider ? `Nạp ký quỹ kích hoạt tài khoản (${String(provider).toUpperCase()})` : 'Nạp ký quỹ kích hoạt tài khoản');
      const merchantDescription = (beforeWallet?.initialActivationCompleted ?? false)
        ? `Nạp tiền ví tài xế${provider ? ` (${String(provider).toUpperCase()})` : ''}`
        : `Nạp tiền ký quỹ tài xế${provider ? ` (${String(provider).toUpperCase()})` : ''}`;

      const deltaResult = await this.applyDeltaInTx(tx, {
        driverId,
        delta:          amount,
        type:           TransactionType.TOP_UP,
        direction:      TransactionDirection.CREDIT,
        description:    topUpDescription,
        referenceId:    orderId,
        idempotencyKey: `topup_${orderId}`,
      });

      if (deltaResult.alreadyExisted) {
        alreadyProcessed = true;
        return;
      }

      activated = !(beforeWallet?.initialActivationCompleted ?? false) && Boolean(deltaResult.wallet.initialActivationCompleted);
      if (activated) {
        logger.info(`Driver ${driverId} wallet ACTIVATED — locked ${initialActivationBalance} VND as security deposit`);
      }

      // Settle debt records FIFO for however much the top-up paid toward debt
      const prevDebt = Math.max(0, Number(beforeWallet?.debt ?? 0));
      if (prevDebt > 0) {
        const debtPaid = Math.min(prevDebt, amount);
        await this.settleDebtRecordsFifo(tx, driverId, debtPaid);
      }

      // Merchant IN: top-up received from driver
      await tx.merchantLedger.create({
        data: {
          type:           MerchantLedgerType.IN,
          category:       MerchantLedgerCategory.TOP_UP,
          amount,
          referenceId:    orderId,
          description:    merchantDescription,
          idempotencyKey: `ledger_topup_${orderId}`,
        },
      });

      await this.upsertMerchantBalance(tx, amount, 0);
    });

    if (alreadyProcessed) {
      logger.debug(`creditTopUp: orderId=${orderId} already processed — skipping bank simulation`);
      return { activated: false };
    }

    // Bank simulation: <PROVIDER> → MAIN_ACCOUNT (fire-and-forget)
    await this.bankSim.recordTopUp(orderId, driverId, amount, { provider, gatewayTxnId });

    logger.info(`Topped up ${amount} VND for driver ${driverId} via order ${orderId}${activated ? ' [ACTIVATED]' : ''}`);
    return { activated };
  }

  // ─── Case 4: Withdrawal ──────────────────────────────────────────────────

  /**
   * Initiate a withdrawal for a driver.
   * Validates balance, creates a WithdrawalRequest, and debits the wallet.
   */
  async initiateWithdrawal(input: InitiateWithdrawalInput) {
    const { driverId, amount, bankName, accountNumber, accountHolder, idempotencyKey } = input;

    if (amount <= 0) throw new Error('Withdrawal amount must be positive');
    if (amount < minWithdrawal) {
      throw new Error(`Số tiền rút tối thiểu là ${minWithdrawal.toLocaleString('vi-VN')} VND`);
    }

    // Idempotency
    if (idempotencyKey) {
      const existing = await this.prisma.withdrawalRequest.findUnique({ where: { idempotencyKey } });
      if (existing) return existing;
    }

    const wallet = await this.getOrCreateWallet(driverId);
    if (!wallet.initialActivationCompleted) {
      throw new Error('Tài khoản chưa được kích hoạt. Vui lòng nạp tiền ký quỹ 300.000 VND trước.');
    }
    const lockedBal = (wallet as any).lockedBalance ?? 0;
    const withdrawable = Math.max(0, (wallet as any).availableBalance ?? 0);
    if (withdrawable < amount) {
      throw new Error(
        `Số dư khả dụng không đủ để rút. Số dư khả dụng: ${withdrawable.toLocaleString('vi-VN')} VND (không bao gồm tiền ký quỹ ${lockedBal.toLocaleString('vi-VN')} VND).`,
      );
    }

    const result = await this.prisma.$transaction(async (tx: any) => {
      const withdrawal = await tx.withdrawalRequest.create({
        data: {
          driverId,
          amount,
          status:        'PENDING',
          bankName,
          accountNumber,
          accountHolder,
          idempotencyKey,
        },
      });

      const newAvailable = Math.max(0, ((wallet as any).availableBalance ?? 0) - amount);
      const newDebt = Math.max(0, (wallet as any).debt ?? 0);
      const newBalance = lockedBal + newAvailable - newDebt;
      const newStatus = this.getWalletStatus(
        Boolean(wallet.initialActivationCompleted),
        this.getOperationalBalance({ availableBalance: newAvailable, debt: newDebt }),
      );

      await tx.driverWallet.update({
        where: { driverId },
        data: {
          balance:          newBalance,
          availableBalance: newAvailable,
          debt:             newDebt,
          status:           newStatus,
        },
      });

      await tx.walletTransaction.create({
        data: {
          driverId,
          type:          TransactionType.WITHDRAW,
          direction:     TransactionDirection.DEBIT,
          amount,
          balanceAfter:  newBalance,
          description:   bankName
            ? `Rút tiền → ${bankName} ****${(accountNumber ?? '').slice(-4)}`
            : 'Rút tiền',
          referenceId:   withdrawal.id,
          idempotencyKey: idempotencyKey ? `txn_withdraw_${idempotencyKey}` : undefined,
        },
      });

      // Merchant pays out
      await tx.merchantLedger.create({
        data: {
          type:          MerchantLedgerType.OUT,
          category:      MerchantLedgerCategory.WITHDRAW,
          amount,
          referenceId:   withdrawal.id,
          description:   'Rút tiền ví tài xế',
          idempotencyKey: `ledger_withdraw_${withdrawal.id}`,
        },
      });

      await this.upsertMerchantBalance(tx, 0, amount);

      logger.info(`Withdrawal initiated: ${amount} VND for driver ${driverId} (id: ${withdrawal.id})`);

      // Bank simulation: PAYOUT_ACCOUNT → driver bank (fire-and-forget)
      await this.bankSim.recordPayout(withdrawal.id, amount, { bankName, accountNumber, accountHolder });

      // Auto-complete in development (mock payout)
      if (config.nodeEnv !== 'production') {
        setTimeout(() => this.completeWithdrawal(withdrawal.id).catch(() => {}), 2000);
      }

      return withdrawal;
    });

    // Publish event so payment-service can sync its simplified wallet balance
    await this.eventPublisher.publish('driver.wallet.withdrawn', { driverId, amount }).catch(() => {});

    return result;
  }

  async completeWithdrawal(withdrawalId: string): Promise<void> {
    await this.prisma.withdrawalRequest.update({
      where: { id: withdrawalId },
      data:  { status: 'COMPLETED', processedAt: new Date() },
    });
    logger.info(`Withdrawal ${withdrawalId} completed`);
  }

  async cancelWithdrawal(withdrawalId: string, reason: string): Promise<void> {
    const withdrawal = await this.prisma.withdrawalRequest.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal || withdrawal.status !== 'PENDING') {
      throw new Error('Withdrawal not found or not cancellable');
    }

    await this.prisma.$transaction(async (tx: any) => {
      await tx.withdrawalRequest.update({
        where: { id: withdrawalId },
        data:  { status: 'CANCELLED', failureReason: reason, processedAt: new Date() },
      });

      // Refund the debited amount
      await this.applyDeltaInTx(tx, {
        driverId:  withdrawal.driverId,
        delta:     withdrawal.amount,
        type:      TransactionType.REFUND,
        direction: TransactionDirection.CREDIT,
        description: `Hoàn tiền yêu cầu rút bị huỷ`,
        referenceId: withdrawalId,
      });
    });

    logger.info(`Withdrawal ${withdrawalId} cancelled: ${reason}`);
  }

  // ─── Case 6: Bonus Credit ────────────────────────────────────────────────

  async creditBonus(input: CreditBonusInput): Promise<void> {
    const { driverId, amount, description, rideId } = input;

    if (amount <= 0) return;

    const result = await this.prisma.$transaction(async (tx: PrismaAny) => {
      const deltaResult = await this.applyDeltaInTx(tx, {
        driverId,
        delta:         amount,
        type:          TransactionType.BONUS,
        direction:     TransactionDirection.CREDIT,
        description,
        referenceId:   rideId,
        idempotencyKey: rideId ? `bonus_${rideId}_${driverId}` : undefined,
      });

      if (deltaResult.alreadyExisted) return deltaResult;

      await tx.merchantLedger.create({
        data: {
          type:          MerchantLedgerType.OUT,
          category:      MerchantLedgerCategory.BONUS,
          amount,
          referenceId:   rideId,
          description:   `Thưởng tài xế: ${description}`,
          idempotencyKey: rideId ? `ledger_bonus_${rideId}_${driverId}` : undefined,
        },
      });

      await this.upsertMerchantBalance(tx, 0, amount);
      return deltaResult;
    });

    if (!result.alreadyExisted && result.newStatus === WalletStatus.BLOCKED) {
      await this.eventPublisher.publish('driver.wallet.blocked', { driverId, balance: result.newBalance }).catch(() => {});
    }

    logger.info(`Credited bonus ${amount} VND to driver ${driverId}: ${description}`);
  }

  // ─── Case 7: Refund ──────────────────────────────────────────────────────

  /**
   * Process a refund reversal: debit back the previously credited net earnings
   * from the driver wallet when an online ride is cancelled after payment.
   */
  async processRefund(input: ProcessRefundInput): Promise<void> {
    const { driverId, netEarnings, rideId, reason } = input;

    if (netEarnings <= 0) return;

    const result = await this.prisma.$transaction(async (tx: PrismaAny) => {
      const deltaResult = await this.applyDeltaInTx(tx, {
        driverId,
        delta:         -netEarnings,
        type:          TransactionType.REFUND,
        direction:     TransactionDirection.DEBIT,
        description:   reason ? `Hoàn tiền: ${reason}` : `Hoàn tiền chuyến bị huỷ`,
        referenceId:   rideId,
        idempotencyKey: `refund_${rideId}_${driverId}`,
      });

      if (deltaResult.alreadyExisted) return deltaResult;

      await tx.merchantLedger.create({
        data: {
          type:          MerchantLedgerType.OUT,
          category:      MerchantLedgerCategory.REFUND,
          amount:        netEarnings,
          referenceId:   rideId,
          description:   `Hoàn tiền cho khách`,
          idempotencyKey: `ledger_refund_${rideId}`,
        },
      });

      await this.upsertMerchantBalance(tx, 0, netEarnings);
      return deltaResult;
    });

    if (!result.alreadyExisted && result.newStatus === WalletStatus.BLOCKED) {
      await this.eventPublisher.publish('driver.wallet.blocked', { driverId, balance: result.newBalance }).catch(() => {});
    }

    // Bank simulation: MAIN_ACCOUNT → CUSTOMER_BANK (fire-and-forget)
    if (!result.alreadyExisted) {
      await this.bankSim.recordRefund(rideId, netEarnings);
    }

    logger.info(`Processed refund ${netEarnings} VND for driver ${driverId}, ride ${rideId}`);
  }

  async deactivateDriver(driverId: string) {
    const wallet = await this.getOrCreateWallet(driverId);
    const settlement = this.toLedgerState(wallet);

    // Include pendingBalance in settlement — platform owes driver these earnings
    // even if T+24h has not elapsed yet. The deposit (lockedBalance) is also returned.
    const refundAmount = settlement.initialActivationCompleted
      ? Math.max(0, settlement.lockedBalance + settlement.availableBalance + settlement.pendingBalance - settlement.debt)
      : Math.max(0, Number((wallet as any).balance ?? 0));

    const depositRefunded   = settlement.initialActivationCompleted ? settlement.lockedBalance    : 0;
    const availableRefunded = settlement.initialActivationCompleted ? settlement.availableBalance  : Number((wallet as any).balance ?? 0);
    const pendingRefunded   = settlement.initialActivationCompleted ? settlement.pendingBalance    : 0;
    const debtSettled       = settlement.initialActivationCompleted ? settlement.debt              : 0;
    const settlementReference = `DEACT_${driverId}_${Date.now()}`;

    await this.prisma.$transaction(async (tx: PrismaAny) => {
      // Mark all unsettled pending earnings as settled (being paid out via deactivation refund)
      await tx.pendingEarning.updateMany({
        where: { driverId, settledAt: null },
        data:  { settledAt: new Date() },
      });

      if (refundAmount > 0) {
        await tx.walletTransaction.create({
          data: {
            driverId,
            type:          TransactionType.WITHDRAW,
            direction:     TransactionDirection.DEBIT,
            amount:        refundAmount,
            balanceAfter:  0,
            description:   'Đối soát & hoàn trả số dư khi ngừng hoạt động tài xế',
            referenceId:   settlementReference,
            idempotencyKey: settlementReference,
            metadata: {
              settlementType:   'DEACTIVATION',
              settlementReference,
              depositRefunded,
              availableRefunded,
              pendingRefunded,
              debtSettled,
            } as any,
          },
        });

        await tx.merchantLedger.create({
          data: {
            type:          MerchantLedgerType.OUT,
            category:      MerchantLedgerCategory.WITHDRAW,
            amount:        refundAmount,
            referenceId:   settlementReference,
            description:   'Đối soát hoàn trả khi tài xế ngừng hoạt động (ký quỹ + số dư + tiền chờ xử lý - công nợ)',
            idempotencyKey: `ledger_${settlementReference}`,
          },
        });

        await this.upsertMerchantBalance(tx, 0, refundAmount);
      }

      await tx.driverWallet.update({
        where: { driverId },
        data: {
          balance:          0,
          availableBalance: 0,
          pendingBalance:   0,
          lockedBalance:    0,
          debt:             0,
          status:           INACTIVE_WALLET_STATUS,
          initialActivationCompleted: false,
        },
      });
    });

    if (refundAmount > 0) {
      await this.bankSim.recordPayout(settlementReference, refundAmount, {
        bankName: 'Tai khoan ca nhan tai xe',
        accountNumber: '',
        accountHolder: '',
      });
    }

    // Publish event so payment-service can zero its local wallet mirror
    await this.eventPublisher.publish('driver.wallet.deactivated', { driverId, refundAmount }).catch(() => {});

    logger.info(`Driver ${driverId} deactivated. Refunded=${refundAmount} (deposit=${depositRefunded} available=${availableRefunded} pending=${pendingRefunded} debtSettled=${debtSettled})`);

    return {
      refundedAmount:  refundAmount,
      depositRefunded,
      availableRefunded,
      pendingRefunded,
      debtSettled,
      status: INACTIVE_WALLET_STATUS,
    };
  }

  // ─── Query Methods ───────────────────────────────────────────────────────

  async getBalance(driverId: string) {
    // Lazily settle any eligible pending earnings before reading balance
    await this.settlePendingEarnings(driverId).catch(() => {});

    // Mark overdue debt records
    await (this.prisma as any).debtRecord.updateMany({
      where: { driverId, status: 'ACTIVE', dueDate: { lt: new Date() } },
      data:  { status: 'OVERDUE' },
    }).catch(() => {});

    const [wallet, businessAccounts] = await Promise.all([
      this.getOrCreateWallet(driverId),
      this.getBusinessAccounts(),
    ]);
    const ledgerState = this.toLedgerState(wallet);
    const operationalBalance = ledgerState.initialActivationCompleted
      ? this.getOperationalBalance(ledgerState)
      : ledgerState.balance;
    const canAcceptRide = wallet.status === WalletStatus.ACTIVE && operationalBalance > debtLimit;
    const warningThresholdReached = wallet.status === WalletStatus.ACTIVE && operationalBalance <= warningThreshold;
    const activationRequired = wallet.status === INACTIVE_WALLET_STATUS;
    const withdrawableBalance = Math.max(0, ledgerState.availableBalance);
    const hasOverdueDebt = ledgerState.debt > 0 && wallet.status !== INACTIVE_WALLET_STATUS
      ? await (this.prisma as any).debtRecord.count({ where: { driverId, status: 'OVERDUE' } }).then((c: number) => c > 0).catch(() => false)
      : false;

    let reason: string | undefined;
    if (activationRequired) {
      const remaining = Math.max(0, initialActivationBalance - ledgerState.balance);
      reason = remaining > 0
        ? `Cần nạp thêm ${remaining.toLocaleString('vi-VN')} VND vào tài khoản doanh nghiệp để kích hoạt ví tài xế.`
        : `Ví đang chờ ghi nhận ký quỹ kích hoạt ${initialActivationBalance.toLocaleString('vi-VN')} VND.`;
    } else if (!canAcceptRide) {
      reason = `Số dư vận hành hiện tại là ${operationalBalance.toLocaleString('vi-VN')} VND và đã chạm ngưỡng khóa ${debtLimit.toLocaleString('vi-VN')} VND.`;
    } else if (hasOverdueDebt) {
      reason = 'Bạn có khoản công nợ quá hạn. Vui lòng thanh toán để tránh bị hạn chế tài khoản.';
    }

    return {
      driverId,
      balance:                     wallet.balance,
      operationalBalance,
      availableBalance:            ledgerState.availableBalance,
      pendingBalance:              ledgerState.pendingBalance,
      lockedBalance:               ledgerState.lockedBalance,
      withdrawableBalance,
      debt:                        ledgerState.debt,
      status:                      wallet.status,
      initialActivationCompleted:  wallet.initialActivationCompleted,
      activationRequired,
      warningThresholdReached,
      hasOverdueDebt,
      canAcceptRide,
      activationThreshold:         initialActivationBalance,
      warningThreshold,
      debtLimit,
      reason,
      businessAccounts,
    };
  }

  async getDebtRecords(driverId: string) {
    const records = await (this.prisma as any).debtRecord.findMany({
      where:   { driverId },
      orderBy: { createdAt: 'desc' },
      take:    50,
    });
    return records.map((r: any) => ({
      id:        r.id,
      amount:    r.amount,
      remaining: r.remaining,
      rideId:    r.rideId,
      status:    r.status,
      dueDate:   r.dueDate,
      settledAt: r.settledAt,
      createdAt: r.createdAt,
    }));
  }

  async getTransactions(
    driverId: string,
    params: { page?: number; limit?: number; type?: string },
  ) {
    const page  = Math.max(1, params.page  ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip  = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { driverId };
    if (params.type) {
      where.type = params.type as TransactionType;
    }

    const [transactions, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.walletTransaction.count({ where }),
    ]);

    return { transactions, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async canAcceptCash(driverId: string): Promise<boolean> {
    const wallet = await this.getOrCreateWallet(driverId);
    const state = this.toLedgerState(wallet);
    const operationalBalance = state.initialActivationCompleted ? this.getOperationalBalance(state) : state.balance;
    return wallet.status === WalletStatus.ACTIVE && operationalBalance > config.wallet.debtLimit;
  }

  async getWithdrawals(driverId: string, params: { page?: number; limit?: number }) {
    const page  = Math.max(1, params.page  ?? 1);
    const limit = Math.min(50, Math.max(1, params.limit ?? 10));
    const skip  = (page - 1) * limit;

    const [withdrawals, total] = await Promise.all([
      this.prisma.withdrawalRequest.findMany({
        where:   { driverId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.withdrawalRequest.count({ where: { driverId } }),
    ]);

    return { withdrawals, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getAllWithdrawals(params: { page?: number; limit?: number; status?: string }) {
    const page  = Math.max(1, params.page  ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip  = (page - 1) * limit;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (params.status) where.status = params.status;

    const [withdrawals, total] = await Promise.all([
      this.prisma.withdrawalRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.withdrawalRequest.count({ where }),
    ]);

    return { withdrawals, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getAllWallets(params: { page?: number; limit?: number; status?: string }) {
    const page  = Math.max(1, params.page  ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip  = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (params.status) where.status = params.status as WalletStatus;

    const [wallets, total] = await Promise.all([
      this.prisma.driverWallet.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.driverWallet.count({ where }),
    ]);

    return { wallets, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
