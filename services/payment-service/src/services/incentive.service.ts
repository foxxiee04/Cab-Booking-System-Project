/**
 * IncentiveService — Driver Bonus Rule Engine
 *
 * Rules are stored in the DB (IncentiveRule) and evaluated after each
 * completed ride against per-day accumulators (DriverDailyStats).
 *
 * Supported rule types:
 *   TRIP_COUNT  – Daily trip milestone: ≥ conditionValue trips → rewardAmount VND (once per milestone)
 *   DISTANCE_KM – Daily km milestone:  ≥ conditionValue km    → rewardAmount VND (once per milestone)
 *   PEAK_HOUR   – Per-trip peak bonus: +rewardAmount VND if the ride was completed in a peak window
 *
 * Peak windows: 06:00–09:00 and 16:00–19:00 local time (Vietnam, UTC+7)
 */

import { PrismaClient, IncentiveRuleType } from '../generated/prisma-client';
import { WalletService } from './wallet.service';
import { logger } from '../utils/logger';

// Peak windows in Vietnam local time (UTC+7)
const PEAK_WINDOWS: Array<{ start: number; end: number }> = [
  { start: 6, end: 9 },   // 06:00 – 09:00
  { start: 16, end: 19 }, // 16:00 – 19:00
];

function isPeakHour(completedAt: Date): boolean {
  const vnHour = ((completedAt.getUTCHours() + 7) % 24);
  return PEAK_WINDOWS.some((w) => vnHour >= w.start && vnHour < w.end);
}

/** Returns midnight UTC of the calendar date in Vietnam time (UTC+7). */
function vnCalendarDate(d: Date): Date {
  // Shift to VN time, extract calendar date, then shift back to UTC midnight
  const vnMs = d.getTime() + 7 * 3600 * 1000;
  const vnDate = new Date(vnMs);
  return new Date(
    Date.UTC(vnDate.getUTCFullYear(), vnDate.getUTCMonth(), vnDate.getUTCDate())
  );
}

export interface RideContext {
  rideId: string;
  driverId: string;
  distanceKm: number;
  completedAt: Date;
}

export interface IncentiveResult {
  totalBonus: number;
  bonuses: Array<{ type: string; amount: number; description: string }>;
}

export class IncentiveService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly walletService: WalletService,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Called after every completed ride.
   * Updates daily stats, evaluates all active rules, credits bonuses.
   */
  async evaluateAfterRide(ctx: RideContext): Promise<IncentiveResult> {
    const { rideId, driverId, distanceKm, completedAt } = ctx;
    const today = vnCalendarDate(completedAt);
    const inPeak = isPeakHour(completedAt);

    // Fetch active rules
    const rules = await this.prisma.incentiveRule.findMany({
      where: { isActive: true },
    });

    // Update daily stats atomically and return the updated row
    const stats = await this.prisma.driverDailyStats.upsert({
      where: { driverId_date: { driverId, date: today } },
      update: {
        tripsCompleted: { increment: 1 },
        distanceKm: { increment: distanceKm },
        peakTrips: { increment: inPeak ? 1 : 0 },
      },
      create: {
        driverId,
        date: today,
        tripsCompleted: 1,
        distanceKm,
        peakTrips: inPeak ? 1 : 0,
        bonusAwarded: 0,
      },
    });

    const result: IncentiveResult = { totalBonus: 0, bonuses: [] };

    for (const rule of rules) {
      let bonus = 0;
      let description = '';

      switch (rule.type) {
        case IncentiveRuleType.TRIP_COUNT: {
          // Award once each time the driver crosses a milestone threshold.
          // e.g. conditionValue=10 → threshold at trips 10, 20, 30 …
          const milestone = rule.conditionValue;
          if (
            milestone > 0 &&
            stats.tripsCompleted >= milestone &&
            stats.tripsCompleted % milestone === 0
          ) {
            bonus = rule.rewardAmount;
            description = `Thưởng ${stats.tripsCompleted} cuốc/ngày`;
          }
          break;
        }

        case IncentiveRuleType.DISTANCE_KM: {
          // Award once when distance first crosses conditionValue km in the day.
          const prevKm = stats.distanceKm - distanceKm;
          if (
            prevKm < rule.conditionValue &&
            stats.distanceKm >= rule.conditionValue
          ) {
            bonus = rule.rewardAmount;
            description = `Thưởng vượt ${rule.conditionValue} km/ngày`;
          }
          break;
        }

        case IncentiveRuleType.PEAK_HOUR: {
          if (inPeak) {
            bonus = rule.rewardAmount;
            description = `Thưởng giờ cao điểm`;
          }
          break;
        }
      }

      if (bonus > 0) {
        result.totalBonus += bonus;
        result.bonuses.push({ type: rule.type, amount: bonus, description });

        // Credit wallet
        await this.walletService.creditBonus(driverId, bonus, description, rideId);

        // Track cumulative bonus in daily stats
        await this.prisma.driverDailyStats.update({
          where: { driverId_date: { driverId, date: today } },
          data: { bonusAwarded: { increment: bonus } },
        });

        logger.info(`Incentive [${rule.type}] +${bonus} VND for driver ${driverId}`, { rideId });
      }
    }

    return result;
  }

  // ─── Admin helpers ───────────────────────────────────────────────────────

  async getRules() {
    return this.prisma.incentiveRule.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async createRule(input: {
    type: IncentiveRuleType;
    conditionValue: number;
    rewardAmount: number;
    description?: string;
    isActive?: boolean;
  }) {
    return this.prisma.incentiveRule.create({ data: input });
  }

  async updateRule(id: string, input: Partial<{
    conditionValue: number;
    rewardAmount: number;
    description: string;
    isActive: boolean;
  }>) {
    return this.prisma.incentiveRule.update({ where: { id }, data: input });
  }

  async deleteRule(id: string) {
    return this.prisma.incentiveRule.delete({ where: { id } });
  }

  /** Return daily stats for a driver (default: last 7 days). */
  async getDailyStats(driverId: string, days = 7) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);
    return this.prisma.driverDailyStats.findMany({
      where: { driverId, date: { gte: since } },
      orderBy: { date: 'desc' },
    });
  }
}
