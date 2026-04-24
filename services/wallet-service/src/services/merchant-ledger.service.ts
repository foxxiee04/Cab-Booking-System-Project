import { PrismaClient, MerchantLedgerType, MerchantLedgerCategory } from '../generated/prisma-client';
import { logger } from '../utils/logger';

interface RecordInput {
  type: MerchantLedgerType;
  category: MerchantLedgerCategory;
  amount: number;
  referenceId?: string;
  description?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export class MerchantLedgerService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Append a new entry to the merchant ledger.
   * Idempotent: if idempotencyKey already exists, returns the existing record.
   */
  async record(input: RecordInput) {
    const { type, category, amount, referenceId, description, idempotencyKey, metadata } = input;

    if (idempotencyKey) {
      const existing = await this.prisma.merchantLedger.findUnique({ where: { idempotencyKey } });
      if (existing) {
        logger.debug(`Duplicate merchant ledger entry skipped: ${idempotencyKey}`);
        return existing;
      }
    }

    const entry = await this.prisma.merchantLedger.create({
      data: {
        type,
        category,
        amount,
        referenceId,
        description,
        idempotencyKey,
        metadata: metadata as any,
      },
    });

    logger.debug(`Merchant ledger: ${type} ${category} ${amount} VND (ref: ${referenceId})`);
    return entry;
  }

  /**
   * Paginated list of ledger entries, optionally filtered by type/category.
   */
  async getEntries(params: {
    page?:     number;
    limit?:    number;
    type?:     string;
    category?: string;
    startDate?: Date;
    endDate?:   Date;
  }) {
    const page  = Math.max(1, params.page  ?? 1);
    const limit = Math.min(200, Math.max(1, params.limit ?? 50));
    const skip  = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (params.type)     where.type     = params.type     as MerchantLedgerType;
    if (params.category) where.category = params.category as MerchantLedgerCategory;
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate)   where.createdAt.lte = params.endDate;
    }

    const [entries, total] = await Promise.all([
      this.prisma.merchantLedger.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.merchantLedger.count({ where }),
    ]);

    return { entries, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Aggregate IN/OUT totals by category for a date range.
   * Used for admin dashboard metrics.
   */
  async getStats(params: { startDate?: Date; endDate?: Date } = {}) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate)   where.createdAt.lte = params.endDate;
    }

    const entries = await this.prisma.merchantLedger.findMany({ where });

    const totals: Record<string, { in: number; out: number }> = {};
    let totalIn  = 0;
    let totalOut = 0;

    for (const entry of entries) {
      if (!totals[entry.category]) totals[entry.category] = { in: 0, out: 0 };

      if (entry.type === MerchantLedgerType.IN) {
        totals[entry.category].in += entry.amount;
        totalIn += entry.amount;
      } else {
        totals[entry.category].out += entry.amount;
        totalOut += entry.amount;
      }
    }

    const netRevenue = totalIn - totalOut;

    return {
      totalIn,
      totalOut,
      netRevenue,
      byCategory: totals,
    };
  }

  /**
   * Read the merchant_balance snapshot row (O(1) read).
   * Falls back to computed SUM from ledger if snapshot is not yet seeded.
   */
  async getBalance() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const snapshot = await (this.prisma as any).merchantBalance.findUnique({ where: { id: 1 } });

    if (snapshot) {
      return {
        balance:   snapshot.balance   as number,
        totalIn:   snapshot.totalIn   as number,
        totalOut:  snapshot.totalOut  as number,
        updatedAt: snapshot.updatedAt as Date,
        source:    'snapshot' as const,
      };
    }

    // Fallback: recompute from full ledger
    const stats = await this.getStats();
    return {
      balance:  stats.netRevenue,
      totalIn:  stats.totalIn,
      totalOut: stats.totalOut,
      source:   'computed' as const,
    };
  }

  /**
   * Reconciliation: compare expected vs actual balances.
   * Returns a summary used in the admin reconciliation dashboard.
   */
  async getReconciliation() {
    const stats = await this.getStats();

    // Expected merchant balance = all IN - all OUT
    const expectedMerchantBalance = stats.totalIn - stats.totalOut;

    // Total driver wallet balances
    const walletAgg = await this.prisma.driverWallet.aggregate({
      _sum: { balance: true },
    });
    const totalDriverBalances = walletAgg._sum.balance ?? 0;

    // Total pending withdrawals
    const pendingAgg = await this.prisma.withdrawalRequest.aggregate({
      where: { status: 'PENDING' },
      _sum: { amount: true },
    });
    const pendingWithdrawals = pendingAgg._sum.amount ?? 0;

    return {
      expectedMerchantBalance,
      totalDriverBalances,
      pendingWithdrawals,
      ledgerStats: stats,
    };
  }
}
