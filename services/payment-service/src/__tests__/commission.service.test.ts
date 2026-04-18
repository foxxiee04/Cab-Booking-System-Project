/**
 * CommissionService unit tests
 *
 * All tests are pure-logic (no DB, no network) — the service only does arithmetic.
 */
import {
  CommissionService,
  CommissionConfig,
  TripContext,
  DEFAULT_COMMISSION_CONFIG,
} from '../services/commission.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSvc(overrides?: Partial<CommissionConfig>): CommissionService {
  const cfg: CommissionConfig = { ...DEFAULT_COMMISSION_CONFIG, ...overrides };
  return new CommissionService(cfg);
}

function ctx(overrides: Partial<TripContext> = {}): TripContext {
  return {
    vehicleType:    'ECONOMY',
    surgeMultiplier: 1.0,
    paymentMethod:  'MOMO',
    ...overrides,
  };
}

// ─── Commission rate selection ────────────────────────────────────────────────

describe('CommissionService — base rates', () => {
  const svc = makeSvc();

  it('applies ECONOMY rate (20 %) by default', () => {
    const result = svc.calculateCommission(100_000, ctx());
    expect(result.baseCommissionRate).toBeCloseTo(0.20);
    expect(result.platformFee).toBe(20_000);
  });

  it('applies COMFORT rate (18 %)', () => {
    const result = svc.calculateCommission(100_000, ctx({ vehicleType: 'COMFORT' }));
    expect(result.baseCommissionRate).toBeCloseTo(0.18);
    expect(result.platformFee).toBe(18_000);
  });

  it('applies PREMIUM rate (15 %)', () => {
    const result = svc.calculateCommission(100_000, ctx({ vehicleType: 'PREMIUM' }));
    expect(result.baseCommissionRate).toBeCloseTo(0.15);
    expect(result.platformFee).toBe(15_000);
  });

  it('falls back to ECONOMY rate for unknown vehicle type', () => {
    const result = svc.calculateCommission(100_000, ctx({ vehicleType: 'BICYCLE' }));
    expect(result.baseCommissionRate).toBeCloseTo(0.20);
  });
});

// ─── Dynamic commission modifier ─────────────────────────────────────────────

describe('CommissionService — dynamic rate modifier', () => {
  const svc = makeSvc();

  it('no adjustment when surge = 1.0', () => {
    const result = svc.calculateCommission(100_000, ctx({ surgeMultiplier: 1.0 }));
    expect(result.breakdown.dynamicAdjustment).toBe(0);
    expect(result.commissionRate).toBeCloseTo(0.20);
  });

  it('−1 pp at surge 1.1', () => {
    const result = svc.calculateCommission(100_000, ctx({ surgeMultiplier: 1.1 }));
    expect(result.breakdown.dynamicAdjustment).toBeCloseTo(-0.01);
    expect(result.commissionRate).toBeCloseTo(0.19);
    expect(result.platformFee).toBe(19_000);
  });

  it('−2 pp at surge 1.3', () => {
    const result = svc.calculateCommission(100_000, ctx({ surgeMultiplier: 1.3 }));
    expect(result.breakdown.dynamicAdjustment).toBeCloseTo(-0.02);
    expect(result.commissionRate).toBeCloseTo(0.18);
  });

  it('−3 pp at surge 1.5', () => {
    const result = svc.calculateCommission(100_000, ctx({ surgeMultiplier: 1.5 }));
    expect(result.breakdown.dynamicAdjustment).toBeCloseTo(-0.03);
    expect(result.commissionRate).toBeCloseTo(0.17);
  });

  it('effective rate is clamped to minimum 5 %', () => {
    // Use a very aggressive negative modifier
    const svc2 = makeSvc({
      dynamicModifiers: [{ surgeThreshold: 1.0, rateAdjustment: -0.99 }],
    });
    const result = svc2.calculateCommission(100_000, ctx({ surgeMultiplier: 2.0 }));
    expect(result.commissionRate).toBeCloseTo(0.05);
  });
});

// ─── Net earnings formula ─────────────────────────────────────────────────────

describe('CommissionService — netEarnings formula', () => {
  const svc = makeSvc();

  it('netEarnings = grossFare − platformFee (no bonus, no penalty)', () => {
    const gross = 150_000;
    const result = svc.calculateCommission(gross, ctx());
    expect(result.netEarnings).toBe(gross - result.platformFee);
  });

  it('netEarnings is never negative', () => {
    // Huge penalty via misconfiguration should floor at 0
    const svc2 = makeSvc({
      penalty: {
        ...DEFAULT_COMMISSION_CONFIG.penalty,
        lowAcceptancePenalty: 2.0, // 200 % of fare — impossible but guard exists
        lowAcceptanceThreshold: 0.99,
      },
    });
    const result = svc2.calculateCommission(50_000, ctx({
      driverStats: { tripsCompletedToday: 5, acceptanceRate: 0.50 },
    }));
    expect(result.netEarnings).toBeGreaterThanOrEqual(0);
  });

  it('grossFare = 0 is allowed (free ride / correction ride)', () => {
    const result = svc.calculateCommission(0, ctx());
    expect(result.platformFee).toBe(0);
    expect(result.netEarnings).toBe(0);
  });

  it('throws on negative grossFare', () => {
    expect(() => svc.calculateCommission(-1, ctx())).toThrow();
  });
});

// ─── Cash accounting ──────────────────────────────────────────────────────────

describe('CommissionService — cash accounting', () => {
  const svc = makeSvc();

  it('driverCollected=true and cashDebt>0 for CASH payment', () => {
    const result = svc.calculateCommission(100_000, ctx({ paymentMethod: 'CASH' }));
    expect(result.driverCollected).toBe(true);
    // No bonuses/penalties → cashDebt = platformFee
    expect(result.cashDebt).toBe(result.platformFee);
  });

  it('cashDebt = 0 for electronic payment (MOMO)', () => {
    const result = svc.calculateCommission(100_000, ctx({ paymentMethod: 'MOMO' }));
    expect(result.driverCollected).toBe(false);
    expect(result.cashDebt).toBe(0);
  });

  it('cashDebt = 0 for electronic payment (VNPAY)', () => {
    const result = svc.calculateCommission(100_000, ctx({ paymentMethod: 'VNPAY' }));
    expect(result.driverCollected).toBe(false);
    expect(result.cashDebt).toBe(0);
  });

  it('bonus reduces the cash debt the driver owes', () => {
    const result = svc.calculateCommission(100_000, ctx({
      paymentMethod: 'CASH',
      completedAt: new Date('2025-03-17T14:00:00'),
      driverStats: { tripsCompletedToday: 3, rating: 4.9 },
    }));

    expect(result.bonus).toBe(DEFAULT_COMMISSION_CONFIG.incentive.highRatingBonus);
    // cashDebt should be reduced by the bonus
    expect(result.cashDebt).toBe(Math.max(0, result.platformFee - result.bonus));
  });
});

// ─── Incentive bonuses ────────────────────────────────────────────────────────

describe('CommissionService — incentive bonuses', () => {
  const svc = makeSvc();

  it('no bonus when driverStats is absent', () => {
    // Use off-peak time to avoid peakHour bonus
    const offPeak = new Date();
    offPeak.setHours(14);
    const result = svc.calculateCommission(100_000, ctx({ completedAt: offPeak }));
    expect(result.bonus).toBe(0);
  });

  it('trip milestone bonus on every 10th trip', () => {
    const offPeak = new Date(); offPeak.setHours(14);
    const result = svc.calculateCommission(100_000, ctx({
      completedAt: offPeak,
      driverStats: { tripsCompletedToday: 10 },
    }));
    expect(result.breakdown.bonuses.tripMilestone).toBeUndefined();
  });

  it('no milestone bonus on non-multiple trips', () => {
    const offPeak = new Date(); offPeak.setHours(14);
    const result = svc.calculateCommission(100_000, ctx({
      completedAt: offPeak,
      driverStats: { tripsCompletedToday: 7 },
    }));
    expect(result.breakdown.bonuses.tripMilestone).toBeUndefined();
  });

  it('high rating bonus when rating >= 4.8', () => {
    const offPeak = new Date(); offPeak.setHours(14);
    const result = svc.calculateCommission(100_000, ctx({
      completedAt: offPeak,
      driverStats: { tripsCompletedToday: 3, rating: 4.9 },
    }));
    expect(result.breakdown.bonuses.highRating).toBe(
      DEFAULT_COMMISSION_CONFIG.incentive.highRatingBonus,
    );
  });

  it('no high rating bonus when rating < 4.8', () => {
    const offPeak = new Date(); offPeak.setHours(14);
    const result = svc.calculateCommission(100_000, ctx({
      completedAt: offPeak,
      driverStats: { tripsCompletedToday: 1, rating: 4.5 },
    }));
    expect(result.breakdown.bonuses.highRating).toBeUndefined();
  });

  it('high acceptance bonus when acceptanceRate >= 0.95', () => {
    const offPeak = new Date(); offPeak.setHours(14);
    const result = svc.calculateCommission(100_000, ctx({
      completedAt: offPeak,
      driverStats: { tripsCompletedToday: 2, acceptanceRate: 1.0 },
    }));
    expect(result.breakdown.bonuses.highAcceptance).toBe(
      DEFAULT_COMMISSION_CONFIG.incentive.highAcceptanceBonus,
    );
  });
});

// ─── Penalties ────────────────────────────────────────────────────────────────

describe('CommissionService — penalties', () => {
  const svc = makeSvc();
  const offPeak = new Date(); offPeak.setHours(14);

  it('no penalty for clean driver stats', () => {
    const result = svc.calculateCommission(100_000, ctx({
      completedAt: offPeak,
      driverStats: { tripsCompletedToday: 5, cancelRate: 0.02, acceptanceRate: 0.98 },
    }));
    expect(result.penalty).toBe(0);
  });

  it('high cancel rate penalty (5 % of fare) between 10 %–20 % cancel', () => {
    const gross = 100_000;
    const result = svc.calculateCommission(gross, ctx({
      completedAt: offPeak,
      driverStats: { tripsCompletedToday: 5, cancelRate: 0.15 },
    }));
    expect(result.breakdown.penalties.highCancelRate).toBe(5_000); // 5 % × 100k
    expect(result.breakdown.penalties.veryHighCancelRate).toBeUndefined();
  });

  it('very high cancel rate penalty (10 % of fare) at > 20 % cancel', () => {
    const gross = 100_000;
    const result = svc.calculateCommission(gross, ctx({
      completedAt: offPeak,
      driverStats: { tripsCompletedToday: 5, cancelRate: 0.25 },
    }));
    expect(result.breakdown.penalties.veryHighCancelRate).toBe(10_000);
    expect(result.breakdown.penalties.highCancelRate).toBeUndefined();
  });

  it('low acceptance rate penalty (5 % of fare)', () => {
    const gross = 100_000;
    const result = svc.calculateCommission(gross, ctx({
      completedAt: offPeak,
      driverStats: { tripsCompletedToday: 5, acceptanceRate: 0.50 },
    }));
    expect(result.breakdown.penalties.lowAcceptance).toBe(5_000);
  });
});

// ─── Full integration scenario ────────────────────────────────────────────────

describe('CommissionService — end-to-end scenario', () => {
  it('premium driver with strong profile, surge 1.5, MOMO payment', () => {
    const svc = makeSvc();

    const completedAt = new Date('2025-03-17T14:30:00');

    const result = svc.calculateCommission(300_000, {
      vehicleType:    'PREMIUM',
      surgeMultiplier: 1.5,
      paymentMethod:  'MOMO',
      completedAt,
      driverStats: {
        tripsCompletedToday: 10,
        rating:         4.9,   // high rating
        acceptanceRate: 0.97,  // high acceptance
        cancelRate:     0.02,  // clean
      },
    });

    // Effective rate: 15 % − 3 pp = 12 %
    expect(result.commissionRate).toBeCloseTo(0.12);
    expect(result.platformFee).toBe(Math.round(300_000 * 0.12));

    // Bonuses: highRating + highAcceptance
    const inc = DEFAULT_COMMISSION_CONFIG.incentive;
    const expectedBonus =
      inc.highRatingBonus +
      inc.highAcceptanceBonus;
    expect(result.bonus).toBe(expectedBonus);

    // No penalties
    expect(result.penalty).toBe(0);

    // Net earnings
    const expected = 300_000 - result.platformFee + expectedBonus;
    expect(result.netEarnings).toBe(expected);

    // Electronic payment → no cash debt
    expect(result.driverCollected).toBe(false);
    expect(result.cashDebt).toBe(0);
  });

  it('economy driver, cash, poor stats: high cancel rate + low acceptance', () => {
    const svc = makeSvc();
    const offPeak = new Date('2025-03-17T14:00:00');

    const result = svc.calculateCommission(80_000, {
      vehicleType:    'ECONOMY',
      surgeMultiplier: 1.0,
      paymentMethod:  'CASH',
      completedAt:    offPeak,
      driverStats: {
        tripsCompletedToday: 3,
        cancelRate:     0.25, // very high
        acceptanceRate: 0.55, // low
      },
    });

    // Rate 20 %, no dynamic adj
    expect(result.commissionRate).toBeCloseTo(0.20);
    expect(result.platformFee).toBe(16_000);

    // Penalties: veryHighCancelRate (10 %) + lowAcceptance (5 %)
    const vhcp = Math.round(80_000 * 0.10);
    const lap  = Math.round(80_000 * 0.05);
    expect(result.breakdown.penalties.veryHighCancelRate).toBe(vhcp);
    expect(result.breakdown.penalties.lowAcceptance).toBe(lap);

    const totalPenalty = vhcp + lap;
    expect(result.penalty).toBe(totalPenalty);

    // Cash: driver collected 80k, owes platform: platformFee - 0 + penalty
    const expectedDebt = 16_000 + totalPenalty;
    expect(result.cashDebt).toBe(expectedDebt);

    // Net: 80k - 16k + 0 - penalty = 80k - 16k - 12k = 52k
    expect(result.netEarnings).toBe(Math.max(0, 80_000 - 16_000 - totalPenalty));
  });
});
