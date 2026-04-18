/**
 * CommissionService — Driver Earnings & Platform Revenue Engine
 *
 * Responsibilities:
 *  1. Base commission rates per vehicle class (configurable via env)
 *  2. Dynamic rate modifier: lower commission during peak demand (surge ≥ threshold)
 *  3. Operational bonuses: high-rating bonus, high-acceptance-rate bonus
 *     Campaign bonuses such as peak-hour, trip milestone, and distance rewards
 *     are awarded by IncentiveService so they are not double-counted here.
 *  4. Penalties: elevated cancel-rate deduction, low-acceptance-rate deduction
 *  5. Cash vs. electronic payment accounting:
 *       - Cash:       driver collected the full fare → owes platform the net platform cut
 *       - Electronic: platform collected → pays driver net earnings
 *
 * Formula:
 *   effectiveRate  = clamp(baseRate + dynamicAdjustment, 0.05, 0.40)
 *   platformFee    = round(grossFare × effectiveRate)
 *   netEarnings    = max(0, grossFare − platformFee + totalBonus − totalPenalty)
 *   cashDebt       = max(0, platformFee − totalBonus + totalPenalty)  [cash only]
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

export interface IncentiveBonusConfig {
  /** Fixed VND bonus per trip completed during peak hours */
  peakHourBonus: number;
  /** Fixed VND bonus awarded every N completed trips (same calendar day) */
  tripMilestoneBonus: number;
  /** Milestone interval, e.g. 10 → bonus on trips 10, 20, 30 … */
  tripMilestoneInterval: number;
  /** Fixed VND bonus per trip when rating ≥ highRatingThreshold */
  highRatingBonus: number;
  /** Minimum driver rating to receive highRatingBonus, e.g. 4.8 */
  highRatingThreshold: number;
  /** Fixed VND bonus per trip when acceptance rate ≥ acceptanceThreshold */
  highAcceptanceBonus: number;
  /** Minimum acceptance rate (0–1) to receive highAcceptanceBonus, e.g. 0.95 */
  acceptanceThreshold: number;
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

export interface PeakHourWindow {
  /** Inclusive start hour (0–23), e.g. 7 = 07:00 */
  startHour: number;
  /** Exclusive end hour (0–23), e.g. 9 = until 08:59 */
  endHour: number;
  /** When true the window only applies Monday–Friday */
  weekdaysOnly: boolean;
}

export interface CommissionConfig {
  rates: CommissionRateConfig;
  dynamicModifiers: DynamicRateModifier[];
  incentive: IncentiveBonusConfig;
  penalty: PenaltyConfig;
  peakHours: PeakHourWindow[];
}

// ─── Default Configuration (reads from env, falls back to safe defaults) ─────

export const DEFAULT_COMMISSION_CONFIG: CommissionConfig = {
  rates: {
    economy: parseFloat(process.env.COMMISSION_RATE_ECONOMY ?? '0.20'),
    comfort:  parseFloat(process.env.COMMISSION_RATE_COMFORT  ?? '0.18'),
    premium:  parseFloat(process.env.COMMISSION_RATE_PREMIUM  ?? '0.15'),
  },
  // Sort order matters: list from highest threshold down so the first match wins
  dynamicModifiers: [
    { surgeThreshold: 1.5, rateAdjustment: -0.03 }, // high demand  → −3 pp
    { surgeThreshold: 1.3, rateAdjustment: -0.02 }, // medium-high  → −2 pp
    { surgeThreshold: 1.1, rateAdjustment: -0.01 }, // low-medium   → −1 pp
    // surge < 1.1 → no adjustment (rate stays at base)
  ],
  incentive: {
    peakHourBonus:         parseInt(process.env.INCENTIVE_PEAK_HOUR_BONUS          ?? '15000', 10),
    tripMilestoneBonus:    parseInt(process.env.INCENTIVE_TRIP_MILESTONE_BONUS      ?? '50000', 10),
    tripMilestoneInterval: parseInt(process.env.INCENTIVE_TRIP_MILESTONE_INTERVAL   ?? '10',    10),
    highRatingBonus:       parseInt(process.env.INCENTIVE_HIGH_RATING_BONUS         ?? '10000', 10),
    highRatingThreshold:   parseFloat(process.env.INCENTIVE_HIGH_RATING_THRESHOLD   ?? '4.8'),
    highAcceptanceBonus:   parseInt(process.env.INCENTIVE_HIGH_ACCEPTANCE_BONUS     ?? '5000',  10),
    acceptanceThreshold:   parseFloat(process.env.INCENTIVE_ACCEPTANCE_THRESHOLD    ?? '0.95'),
  },
  penalty: {
    highCancelRateThreshold:     parseFloat(process.env.PENALTY_HIGH_CANCEL_THRESHOLD      ?? '0.10'),
    highCancelRatePenalty:       parseFloat(process.env.PENALTY_HIGH_CANCEL_RATE            ?? '0.05'),
    veryHighCancelRateThreshold: parseFloat(process.env.PENALTY_VERY_HIGH_CANCEL_THRESHOLD ?? '0.20'),
    veryHighCancelRatePenalty:   parseFloat(process.env.PENALTY_VERY_HIGH_CANCEL_RATE       ?? '0.10'),
    lowAcceptanceThreshold:      parseFloat(process.env.PENALTY_LOW_ACCEPTANCE_THRESHOLD    ?? '0.70'),
    lowAcceptancePenalty:        parseFloat(process.env.PENALTY_LOW_ACCEPTANCE_RATE         ?? '0.05'),
  },
  peakHours: [
    { startHour: 7,  endHour: 9,  weekdaysOnly: true },  // Morning rush  07:00–08:59
    { startHour: 17, endHour: 20, weekdaysOnly: true },  // Evening rush  17:00–19:59
  ],
};

// ─── Context & Result Types ───────────────────────────────────────────────────

export interface DriverStats {
  /** Number of trips the driver has completed today (used for milestone bonus) */
  tripsCompletedToday: number;
  /** Current average rating (0–5). Undefined = no data → no rating bonus */
  rating?: number;
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
  /** Live driver stats for incentive / penalty calculation */
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
  /** Total incentive bonus in VND */
  bonus: number;
  /** Total penalty deduction in VND (positive number = deducted from driver) */
  penalty: number;
  /** What the driver actually earns: grossFare − platformFee + bonus − penalty */
  netEarnings: number;
  /** true when customer paid with cash (driver collected the fare directly) */
  driverCollected: boolean;
  /**
   * For cash rides: the VND amount the driver owes the platform.
   * cashDebt = platformFee − bonus + penalty
   * Always 0 for electronic payments.
   */
  cashDebt: number;
  breakdown: {
    dynamicAdjustment: number;
    bonuses: Record<string, number>;
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

    // 4. Incentive bonuses
    const bonuses = this.calculateBonuses(grossFare, ctx);
    const totalBonus = Object.values(bonuses).reduce((s, v) => s + v, 0);

    // 5. Penalties
    const penalties = this.calculatePenalties(grossFare, ctx);
    const totalPenalty = Object.values(penalties).reduce((s, v) => s + v, 0);

    // 6. Driver's net earnings (floor at 0 — driver can't owe money on a trip)
    const netEarnings = Math.max(0, grossFare - platformFee + totalBonus - totalPenalty);

    // 7. Cash accounting
    const driverCollected = ctx.paymentMethod.toUpperCase() === 'CASH';
    // Driver collected grossFare from customer → must hand platformFee to platform,
    // but bonuses reduce that obligation and penalties increase it.
    const cashDebt = driverCollected
      ? Math.max(0, platformFee - totalBonus + totalPenalty)
      : 0;

    logger.debug('CommissionService.calculateCommission', {
      grossFare,
      baseRate,
      dynAdj,
      effectiveRate,
      platformFee,
      totalBonus,
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
      bonus: totalBonus,
      penalty: totalPenalty,
      netEarnings,
      driverCollected,
      cashDebt,
      breakdown: {
        dynamicAdjustment: dynAdj,
        bonuses,
        penalties,
      },
    };
  }

  // ─── Private: rate lookup ──────────────────────────────────────────────────

  private getBaseRate(vehicleType: string): number {
    switch (vehicleType.toUpperCase()) {
      case 'COMFORT': return this.cfg.rates.comfort;
      case 'PREMIUM': return this.cfg.rates.premium;
      default:        return this.cfg.rates.economy; // ECONOMY + unknown types
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

  // ─── Private: peak hour detection ─────────────────────────────────────────

  private isPeakHour(date: Date): boolean {
    const hour    = date.getHours();
    const weekday = date.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekday = weekday >= 1 && weekday <= 5;

    for (const win of this.cfg.peakHours) {
      if (win.weekdaysOnly && !isWeekday) continue;
      if (hour >= win.startHour && hour < win.endHour) return true;
    }
    return false;
  }

  // ─── Private: bonus calculation ───────────────────────────────────────────

  private calculateBonuses(grossFare: number, ctx: TripContext): Record<string, number> {
    const bonuses: Record<string, number> = {};
    const inc = this.cfg.incentive;
    const stats = ctx.driverStats;

    if (!stats) return bonuses;

    // ── High-rating bonus ─────────────────────────────────────────────────────
    if (stats.rating !== undefined && stats.rating >= inc.highRatingThreshold) {
      bonuses.highRating = inc.highRatingBonus;
    }

    // ── High-acceptance-rate bonus ────────────────────────────────────────────
    if (
      stats.acceptanceRate !== undefined &&
      stats.acceptanceRate >= inc.acceptanceThreshold
    ) {
      bonuses.highAcceptance = inc.highAcceptanceBonus;
    }

    return bonuses;
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
