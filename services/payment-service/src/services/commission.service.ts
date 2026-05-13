/**
 * CommissionService — Driver Earnings & Platform Revenue Engine
 *
 * Responsibilities:
 *  1. Base commission rates per vehicle class (configurable via env)
 *  2. Dynamic rate modifier: lower commission during peak demand (surge ≥ threshold)
 *  3. Penalties: elevated cancel-rate deduction, low-acceptance-rate deduction
 *  4. Cash vs. electronic payment accounting:
 *       - Cash:       driver collected the full fare → owes platform the net platform cut
 *       - Electronic: platform collected → pays driver net earnings
 *
 * Formula:
 *   effectiveRate  = clamp(baseRate + dynamicAdjustment, 0.05, 0.40)
 *   platformFee    = round(grossFare × effectiveRate)
 *   netEarnings    = max(0, grossFare − platformFee − totalPenalty)
 *   cashDebt       = max(0, platformFee + totalPenalty)  [cash only]
 */

import { logger } from '../utils/logger';

// ─── Configuration Types ──────────────────────────────────────────────────────

export interface CommissionRateConfig {
  /** Commission rate for ECONOMY-class rides, e.g. 0.20 = 20 % */
  economy: number;
  /** Commission rate for COMFORT-class rides, e.g. 0.18 = 18 % */
  comfort: number;
  /** Commission rate for PREMIUM-class rides, e.g. 0.15 = 15 % */
  premium: number;
}

export interface DynamicRateModifier {
  /** Minimum surgeMultiplier to trigger this rule */
  surgeThreshold: number;
  /** Delta to add to base rate (negative = reduce platform take) */
  rateAdjustment: number;
}

export interface PenaltyConfig {
  /** Cancel rate threshold triggering the elevated-penalty tier, e.g. 0.10 = 10 % */
  highCancelRateThreshold: number;
  /** Fraction of grossFare deducted at high-cancel tier, e.g. 0.05 = 5 % */
  highCancelRatePenalty: number;
  /** Cancel rate threshold triggering the severe-penalty tier, e.g. 0.20 = 20 % */
  veryHighCancelRateThreshold: number;
  /** Fraction of grossFare deducted at severe-cancel tier, e.g. 0.10 = 10 % */
  veryHighCancelRatePenalty: number;
  /** Acceptance rate below which the low-acceptance penalty is applied, e.g. 0.70 */
  lowAcceptanceThreshold: number;
  /** Fraction of grossFare deducted for low acceptance rate, e.g. 0.05 = 5 % */
  lowAcceptancePenalty: number;
}

export interface CommissionConfig {
  rates: CommissionRateConfig;
  dynamicModifiers: DynamicRateModifier[];
  penalty: PenaltyConfig;
}

// ─── Default Configuration (reads from env, falls back to safe defaults) ─────

export const DEFAULT_COMMISSION_CONFIG: CommissionConfig = {
  rates: {
    economy: parseFloat(process.env.COMMISSION_RATE_ECONOMY ?? '0.20'),
    comfort:  parseFloat(process.env.COMMISSION_RATE_COMFORT  ?? '0.20'),
    premium:  parseFloat(process.env.COMMISSION_RATE_PREMIUM  ?? '0.20'),
  },
  dynamicModifiers: [],
  penalty: {
    highCancelRateThreshold:     parseFloat(process.env.PENALTY_HIGH_CANCEL_THRESHOLD      ?? '0.10'),
    highCancelRatePenalty:       parseFloat(process.env.PENALTY_HIGH_CANCEL_RATE            ?? '0.05'),
    veryHighCancelRateThreshold: parseFloat(process.env.PENALTY_VERY_HIGH_CANCEL_THRESHOLD ?? '0.20'),
    veryHighCancelRatePenalty:   parseFloat(process.env.PENALTY_VERY_HIGH_CANCEL_RATE       ?? '0.10'),
    lowAcceptanceThreshold:      parseFloat(process.env.PENALTY_LOW_ACCEPTANCE_THRESHOLD    ?? '0.70'),
    lowAcceptancePenalty:        parseFloat(process.env.PENALTY_LOW_ACCEPTANCE_RATE         ?? '0.05'),
  },
};

// ─── Context & Result Types ───────────────────────────────────────────────────

export interface DriverStats {
  /** Current acceptance rate (0–1). Undefined = no data → neutral */
  acceptanceRate?: number;
  /** Current cancel rate (0–1). Undefined = no data → no penalty */
  cancelRate?: number;
}

export interface TripContext {
  vehicleType: string;
  surgeMultiplier: number;
  /** Customer's payment method, e.g. "CASH", "MOMO", "VNPAY" */
  paymentMethod: string;
  /** Trip completion timestamp; defaults to now() if omitted */
  completedAt?: Date;
  /** Live driver stats for penalty calculation */
  driverStats?: DriverStats;
}

export interface CommissionResult {
  grossFare: number;
  /** Base commission rate before dynamic adjustment */
  baseCommissionRate: number;
  /** Final effective commission rate after dynamic modifier */
  commissionRate: number;
  /** Amount retained by the platform (VND, rounded) */
  platformFee: number;
  /** Total penalty deduction in VND (positive number = deducted from driver) */
  penalty: number;
  /** What the driver actually earns: grossFare − platformFee − penalty */
  netEarnings: number;
  /** true when customer paid with cash (driver collected the fare directly) */
  driverCollected: boolean;
  /**
   * For cash rides: the VND amount the driver owes the platform.
   * cashDebt = platformFee + penalty
   * Always 0 for electronic payments.
   */
  cashDebt: number;
  breakdown: {
    dynamicAdjustment: number;
    penalties: Record<string, number>;
  };
}

// ─── CommissionService ────────────────────────────────────────────────────────

export class CommissionService {
  private readonly cfg: CommissionConfig;

  constructor(config: CommissionConfig = DEFAULT_COMMISSION_CONFIG) {
    this.cfg = config;
  }

  /**
   * Calculate the complete earnings breakdown for one completed trip.
   *
   * @param grossFare  Total fare charged to the customer (VND)
   * @param ctx        Trip metadata and optional driver stats
   */
  calculateCommission(grossFare: number, ctx: TripContext): CommissionResult {
    if (grossFare < 0) {
      throw new Error(`calculateCommission: grossFare must be ≥ 0, got ${grossFare}`);
    }

    // 1. Base rate by vehicle class
    const baseRate = this.getBaseRate(ctx.vehicleType);

    // 2. Dynamic modifier based on surge multiplier
    const dynAdj = this.getDynamicAdjustment(ctx.surgeMultiplier);

    // Clamp effective rate to [5 %, 40 %] — guards against misconfiguration
    const effectiveRate = Math.max(0.05, Math.min(0.40, baseRate + dynAdj));

    // 3. Platform fee (rounded to whole VND)
    const platformFee = Math.round(grossFare * effectiveRate);

    // 4. Penalties
    const penalties = this.calculatePenalties(grossFare, ctx);
    const totalPenalty = Object.values(penalties).reduce((s, v) => s + v, 0);

    // 5. Driver's net earnings (floor at 0 — driver can't owe money on a trip)
    const netEarnings = Math.max(0, grossFare - platformFee - totalPenalty);

    // 6. Cash accounting
    const driverCollected = ctx.paymentMethod.toUpperCase() === 'CASH';
    // Driver collected grossFare from customer → must hand platformFee to platform,
    // and penalties increase that obligation.
    const cashDebt = driverCollected
      ? Math.max(0, platformFee + totalPenalty)
      : 0;

    logger.debug('CommissionService.calculateCommission', {
      grossFare,
      baseRate,
      dynAdj,
      effectiveRate,
      platformFee,
      totalPenalty,
      netEarnings,
      driverCollected,
      cashDebt,
    });

    return {
      grossFare,
      baseCommissionRate: baseRate,
      commissionRate: effectiveRate,
      platformFee,
      penalty: totalPenalty,
      netEarnings,
      driverCollected,
      cashDebt,
      breakdown: {
        dynamicAdjustment: dynAdj,
        penalties,
      },
    };
  }

  // ─── Private: rate lookup ──────────────────────────────────────────────────

  private getBaseRate(vehicleType: string): number {
    switch (vehicleType.toUpperCase()) {
      case 'MOTORBIKE':
      case 'SCOOTER':
      case 'ECONOMY':
        return this.cfg.rates.economy;   // 20%
      case 'CAR_4':
      case 'COMFORT':
        return this.cfg.rates.comfort;   // 18%
      case 'CAR_7':
      case 'PREMIUM':
        return this.cfg.rates.premium;   // 15%
      default:
        return this.cfg.rates.economy;   // unknown types → economy rate
    }
  }

  /** Return the highest-priority dynamic modifier that applies, or 0. */
  private getDynamicAdjustment(surgeMultiplier: number): number {
    // Modifiers are evaluated highest-threshold-first
    const sorted = [...this.cfg.dynamicModifiers]
      .sort((a, b) => b.surgeThreshold - a.surgeThreshold);

    for (const mod of sorted) {
      if (surgeMultiplier >= mod.surgeThreshold) {
        return mod.rateAdjustment;
      }
    }
    return 0;
  }

  // ─── Private: penalty calculation ─────────────────────────────────────────

  private calculatePenalties(_grossFare: number, ctx: TripContext): Record<string, number> {
    const penalties: Record<string, number> = {};
    const pen = this.cfg.penalty;
    const stats = ctx.driverStats;

    if (!stats) return penalties;

    const cancelRate     = stats.cancelRate     ?? 0;
    const acceptanceRate = stats.acceptanceRate ?? 1;

    // ── Cancel-rate penalty (two tiers) ──────────────────────────────────────
    // Only one tier is applied (the worse one takes precedence)
    if (cancelRate >= pen.veryHighCancelRateThreshold) {
      penalties.veryHighCancelRate = Math.round(_grossFare * pen.veryHighCancelRatePenalty);
    } else if (cancelRate >= pen.highCancelRateThreshold) {
      penalties.highCancelRate = Math.round(_grossFare * pen.highCancelRatePenalty);
    }

    // ── Low-acceptance-rate penalty ───────────────────────────────────────────
    if (acceptanceRate < pen.lowAcceptanceThreshold) {
      penalties.lowAcceptance = Math.round(_grossFare * pen.lowAcceptancePenalty);
    }

    return penalties;
  }
}

// Singleton for use across the payment-service
export const commissionService = new CommissionService();
