import { PrismaClient, IncentiveRuleType } from '../generated/prisma-client';
import { logger } from '../utils/logger';
import { DriverWalletService } from './driver-wallet.service';
import { MerchantLedgerService } from './merchant-ledger.service';

interface EvaluateAfterRideInput {
  rideId:       string;
  driverId:     string;
  distanceKm:   number;
  isPeakHour?:  boolean;
  completedAt:  Date;
}

export class BonusService {
  constructor(
    private prisma:         PrismaClient,
    private walletService:  DriverWalletService,
    private ledgerService:  MerchantLedgerService,
  ) {}

  // ─── Incentive Evaluation ─────────────────────────────────────────────────

  /**
   * Evaluate all active incentive rules after a ride completes.
   * Updates daily stats and credits any triggered bonuses.
   */
  async evaluateAfterRide(input: EvaluateAfterRideInput): Promise<{ totalBonus: number }> {
    const { rideId, driverId, distanceKm, isPeakHour, completedAt } = input;

    // Update daily stats
    const today = new Date(completedAt);
    today.setHours(0, 0, 0, 0);

    const stats = await this.prisma.driverDailyStats.upsert({
      where: { driverId_date: { driverId, date: today } },
      create: {
        driverId,
        date:           today,
        tripsCompleted: 1,
        distanceKm,
        peakTrips:      isPeakHour ? 1 : 0,
        bonusAwarded:   0,
      },
      update: {
        tripsCompleted: { increment: 1 },
        distanceKm:     { increment: distanceKm },
        peakTrips:      isPeakHour ? { increment: 1 } : undefined,
      },
    });

    // Fetch active rules
    const rules = await this.prisma.incentiveRule.findMany({ where: { isActive: true } });
    let totalBonus = 0;

    for (const rule of rules) {
      try {
        let bonusAmount = 0;
        let description = '';

        switch (rule.type) {
          case IncentiveRuleType.TRIP_COUNT:
            // Trigger when daily trip count hits a multiple of conditionValue
            if (
              stats.tripsCompleted % rule.conditionValue === 0 &&
              stats.tripsCompleted > 0
            ) {
              bonusAmount = rule.rewardAmount;
              description = `Thưởng ${stats.tripsCompleted} chuyến/ngày`;
            }
            break;

          case IncentiveRuleType.DISTANCE_KM:
            // Trigger when cumulative daily distance crosses conditionValue threshold
            {
              const prevKm   = stats.distanceKm - distanceKm;
              const crossed  = Math.floor(stats.distanceKm / rule.conditionValue) >
                               Math.floor(prevKm / rule.conditionValue);
              if (crossed) {
                bonusAmount = rule.rewardAmount;
                description = `Thưởng ${stats.distanceKm.toFixed(1)} km/ngày`;
              }
            }
            break;

          case IncentiveRuleType.PEAK_HOUR:
            // Trigger for each peak-hour trip
            if (isPeakHour) {
              bonusAmount = rule.rewardAmount;
              description = 'Thưởng giờ cao điểm';
            }
            break;
        }

        if (bonusAmount > 0) {
          await this.walletService.creditBonus({
            driverId,
            amount:      bonusAmount,
            description,
            rideId,
          });
          totalBonus += bonusAmount;

          await this.prisma.driverDailyStats.update({
            where: { driverId_date: { driverId, date: today } },
            data:  { bonusAwarded: { increment: bonusAmount } },
          });

          logger.info(`Bonus triggered for driver ${driverId}: ${description} (+${bonusAmount} VND)`);
        }
      } catch (err) {
        logger.error(`Failed to apply incentive rule ${rule.id} for driver ${driverId}:`, err);
      }
    }

    return { totalBonus };
  }

  // ─── Daily Stats ──────────────────────────────────────────────────────────

  async getDailyStats(driverId: string, date?: Date) {
    const d = date ?? new Date();
    d.setHours(0, 0, 0, 0);

    return this.prisma.driverDailyStats.findUnique({
      where: { driverId_date: { driverId, date: d } },
    });
  }

  // ─── Incentive Rule CRUD ──────────────────────────────────────────────────

  async getIncentiveRules() {
    return this.prisma.incentiveRule.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createIncentiveRule(data: {
    type:          string;
    conditionValue: number;
    rewardAmount:  number;
    description?:  string;
  }) {
    return this.prisma.incentiveRule.create({
      data: {
        type:           data.type as IncentiveRuleType,
        conditionValue: data.conditionValue,
        rewardAmount:   data.rewardAmount,
        description:    data.description,
        isActive:       true,
      },
    });
  }

  async updateIncentiveRule(id: string, data: Partial<{
    conditionValue: number;
    rewardAmount:  number;
    isActive:      boolean;
    description:   string;
  }>) {
    return this.prisma.incentiveRule.update({ where: { id }, data });
  }

  async deleteIncentiveRule(id: string) {
    return this.prisma.incentiveRule.delete({ where: { id } });
  }
}
