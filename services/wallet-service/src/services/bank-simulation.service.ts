/**
 * BankSimulationService — Mock bank transfer layer
 *
 * Records BankTransaction rows to simulate real inter-bank money flows.
 * This is a SIMULATION ONLY — no real banking API is called.
 *
 * Design principles (from spec §10):
 *  10.1  Ledger (WalletTransaction + MerchantLedger) is the source of truth.
 *        BankTransaction is supplementary audit trail only.
 *  10.2  All writes are fire-and-forget. Failures are logged but NEVER
 *        propagate to the caller — the ledger must not be rolled back because
 *        of a bank simulation error.
 *  10.3  Set BANK_SIMULATION_ENABLED=false to disable the entire layer (e.g.
 *        when a real payout integration is deployed in production).
 *
 * System bank accounts (seeded at startup — both Techcombank 8888511204):
 *   MAIN_ACCOUNT    Techcombank 8888511204  SETTLEMENT_ACCOUNT (nhận thanh toán online)
 *   PAYOUT_ACCOUNT  Techcombank 8888511204  PAYOUT_ACCOUNT     (chuyển tiền tài xế rút)
 *
 * Virtual external counterparties (free-form strings, no DB row needed):
 *   CUSTOMER_BANK   — customer's bank / e-wallet
 *   DRIVER_BANK     — driver's bank account
 */

import { PrismaClient, BankTransactionType, BankTransactionStatus } from '../generated/prisma-client';
import { config } from '../config';
import { logger } from '../utils/logger';

// ─── System account IDs (match seed data in index.ts) ──────────────────────
export const BANK_ACCOUNT = {
  MAIN:    'MAIN_ACCOUNT',    // SETTLEMENT_ACCOUNT — Techcombank 8888511204
  PAYOUT:  'PAYOUT_ACCOUNT',  // PAYOUT_ACCOUNT     — Techcombank 8888511204
  CUSTOMER: 'CUSTOMER_BANK',  // virtual external
  DRIVER:   'DRIVER_BANK',    // virtual external
} as const;

// ─── Service ────────────────────────────────────────────────────────────────

export class BankSimulationService {
  constructor(private readonly prisma: PrismaClient) {}

  private get enabled() {
    return config.bankSimulation.enabled;
  }

  // ─── Internal fire-and-forget writer ───────────────────────────────────

  private async record(data: {
    fromAccount: string;
    toAccount: string;
    amount: number;
    type: BankTransactionType;
    status?: BankTransactionStatus;
    referenceId?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.enabled) return;
    // Non-blocking: catch and log — never re-throw
    setImmediate(async () => {
      try {
        await this.prisma.bankTransaction.create({
          data: {
            fromAccount: data.fromAccount,
            toAccount:   data.toAccount,
            amount:      data.amount,
            type:        data.type,
            status:      data.status ?? BankTransactionStatus.SUCCESS,
            referenceId: data.referenceId ?? null,
            description: data.description ?? null,
            metadata:    (data.metadata ?? null) as any,
          },
        });
        logger.debug(
          `[BankSim] ${data.type} ${data.fromAccount} → ${data.toAccount} ${data.amount} VND` +
          (data.referenceId ? ` ref=${data.referenceId}` : ''),
        );
      } catch (err) {
        // Principle 10.2 — swallow errors
        logger.warn('[BankSim] Failed to record bank transaction (non-critical):', err);
      }
    });
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  /**
   * Online ride payment received:
   *   CUSTOMER_BANK → MAIN_ACCOUNT (grossFare)
   */
  async recordPaymentReceived(rideId: string, grossFare: number): Promise<void> {
    await this.record({
      fromAccount: BANK_ACCOUNT.CUSTOMER,
      toAccount:   BANK_ACCOUNT.MAIN,
      amount:      grossFare,
      type:        BankTransactionType.PAYMENT,
      referenceId: rideId,
      description: 'Khách thanh toán chuyến đi (online)',
      metadata:    { rideId },
    });
  }

  /**
   * Driver withdrawal payout:
   *   PAYOUT_ACCOUNT → DRIVER_BANK (withdrawalAmount)
   */
  async recordPayout(
    withdrawalId: string,
    amount: number,
    bankInfo?: { bankName?: string; accountNumber?: string; accountHolder?: string },
  ): Promise<void> {
    const toLabel = bankInfo?.bankName
      ? `DRIVER_BANK (${bankInfo.bankName} ****${(bankInfo.accountNumber ?? '').slice(-4)})`
      : BANK_ACCOUNT.DRIVER;

    await this.record({
      fromAccount: BANK_ACCOUNT.PAYOUT,
      toAccount:   toLabel,
      amount,
      type:        BankTransactionType.PAYOUT,
      referenceId: withdrawalId,
      description: bankInfo?.bankName
        ? `Chuyển khoản tài xế → ${bankInfo.bankName} ${bankInfo.accountNumber ?? ''}`
        : 'Chuyển khoản cho tài xế',
      metadata: { withdrawalId, ...bankInfo },
    });
  }

  /**
   * Driver wallet top-up:
   *   DRIVER_BANK → MAIN_ACCOUNT (topUpAmount)
   */
  async recordTopUp(
    orderId: string,
    driverId: string,
    amount: number,
    details?: { provider?: string; gatewayTxnId?: string },
  ): Promise<void> {
    const provider = details?.provider ? String(details.provider).toUpperCase() : undefined;
    const fromLabel = provider ? `DRIVER_${provider}` : BANK_ACCOUNT.DRIVER;
    await this.record({
      fromAccount: fromLabel,
      toAccount:   BANK_ACCOUNT.MAIN,
      amount,
      type:        BankTransactionType.TOP_UP,
      referenceId: orderId,
      description: provider
        ? `Tài xế nạp tiền ví qua ${provider}`
        : 'Tài xế nạp tiền ví qua cổng thanh toán',
      metadata:    { orderId, driverId, provider, gatewayTxnId: details?.gatewayTxnId },
    });
  }

  /**
   * Customer refund:
   *   MAIN_ACCOUNT → CUSTOMER_BANK (refundAmount)
   */
  async recordRefund(rideId: string, refundAmount: number): Promise<void> {
    await this.record({
      fromAccount: BANK_ACCOUNT.MAIN,
      toAccount:   BANK_ACCOUNT.CUSTOMER,
      amount:      refundAmount,
      type:        BankTransactionType.REFUND,
      referenceId: rideId,
      description: 'Hoàn tiền chuyến đi cho khách',
      metadata:    { rideId },
    });
  }
}
