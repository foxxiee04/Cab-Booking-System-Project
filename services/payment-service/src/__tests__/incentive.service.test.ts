const mockPrisma: any = {
  incentiveRule: {
    findMany: jest.fn(),
  },
  driverDailyStats: {
    upsert: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
};

jest.mock('../generated/prisma-client', () => ({
  IncentiveRuleType: {
    TRIP_COUNT: 'TRIP_COUNT',
    DISTANCE_KM: 'DISTANCE_KM',
    PEAK_HOUR: 'PEAK_HOUR',
  },
}));

import { IncentiveService } from '../services/incentive.service';

describe('IncentiveService', () => {
  const mockWalletService = {
    creditBonus: jest.fn(),
  };

  let incentiveService: IncentiveService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.incentiveRule.findMany.mockReset();
    mockPrisma.driverDailyStats.upsert.mockReset();
    mockPrisma.driverDailyStats.update.mockReset();
    incentiveService = new IncentiveService(mockPrisma as any, mockWalletService as any);
  });

  it('awards a peak-hour bonus during the 06:00-09:00 VN window', async () => {
    mockPrisma.incentiveRule.findMany.mockResolvedValue([
      {
        id: 'peak-rule',
        type: 'PEAK_HOUR',
        conditionValue: 1,
        rewardAmount: 15000,
      },
    ]);
    mockPrisma.driverDailyStats.upsert.mockResolvedValue({
      tripsCompleted: 1,
      distanceKm: 4.8,
      peakTrips: 1,
      bonusAwarded: 0,
    });
    mockPrisma.driverDailyStats.update.mockResolvedValue({});

    const result = await incentiveService.evaluateAfterRide({
      rideId: 'ride-peak-1',
      driverId: 'driver-1',
      distanceKm: 4.8,
      completedAt: new Date('2026-04-15T23:30:00.000Z'),
    });

    expect(result.totalBonus).toBe(15000);
    expect(result.bonuses).toEqual([
      {
        type: 'PEAK_HOUR',
        amount: 15000,
        description: 'Thưởng giờ cao điểm',
      },
    ]);
    expect(mockPrisma.driverDailyStats.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          peakTrips: { increment: 1 },
        }),
      }),
    );
    expect(mockWalletService.creditBonus).toHaveBeenCalledWith(
      'driver-1',
      15000,
      'Thưởng giờ cao điểm',
      'ride-peak-1',
    );
  });

  it('does not award a peak-hour bonus outside configured windows', async () => {
    mockPrisma.incentiveRule.findMany.mockResolvedValue([
      {
        id: 'peak-rule',
        type: 'PEAK_HOUR',
        conditionValue: 1,
        rewardAmount: 15000,
      },
    ]);
    mockPrisma.driverDailyStats.upsert.mockResolvedValue({
      tripsCompleted: 1,
      distanceKm: 7.2,
      peakTrips: 0,
      bonusAwarded: 0,
    });

    const result = await incentiveService.evaluateAfterRide({
      rideId: 'ride-offpeak-1',
      driverId: 'driver-2',
      distanceKm: 7.2,
      completedAt: new Date('2026-04-16T08:30:00.000Z'),
    });

    expect(result.totalBonus).toBe(0);
    expect(result.bonuses).toEqual([]);
    expect(mockWalletService.creditBonus).not.toHaveBeenCalled();
    expect(mockPrisma.driverDailyStats.update).not.toHaveBeenCalled();
  });

  it('awards trip milestone bonus whenever the driver hits the configured threshold', async () => {
    mockPrisma.incentiveRule.findMany.mockResolvedValue([
      {
        id: 'trip-rule',
        type: 'TRIP_COUNT',
        conditionValue: 10,
        rewardAmount: 25000,
      },
    ]);
    mockPrisma.driverDailyStats.upsert.mockResolvedValue({
      tripsCompleted: 10,
      distanceKm: 32,
      peakTrips: 2,
      bonusAwarded: 0,
    });
    mockPrisma.driverDailyStats.update.mockResolvedValue({});

    const result = await incentiveService.evaluateAfterRide({
      rideId: 'ride-milestone-1',
      driverId: 'driver-3',
      distanceKm: 5,
      completedAt: new Date('2026-04-16T03:00:00.000Z'),
    });

    expect(result.totalBonus).toBe(25000);
    expect(result.bonuses).toEqual([
      {
        type: 'TRIP_COUNT',
        amount: 25000,
        description: 'Thưởng 10 cuốc/ngày',
      },
    ]);
    expect(mockWalletService.creditBonus).toHaveBeenCalledWith(
      'driver-3',
      25000,
      'Thưởng 10 cuốc/ngày',
      'ride-milestone-1',
    );
  });

  it('awards distance bonus once when the driver first crosses the configured km threshold', async () => {
    mockPrisma.incentiveRule.findMany.mockResolvedValue([
      {
        id: 'distance-rule',
        type: 'DISTANCE_KM',
        conditionValue: 100,
        rewardAmount: 40000,
      },
    ]);
    mockPrisma.driverDailyStats.upsert.mockResolvedValue({
      tripsCompleted: 8,
      distanceKm: 104.5,
      peakTrips: 1,
      bonusAwarded: 0,
    });
    mockPrisma.driverDailyStats.update.mockResolvedValue({});

    const result = await incentiveService.evaluateAfterRide({
      rideId: 'ride-distance-1',
      driverId: 'driver-4',
      distanceKm: 6.5,
      completedAt: new Date('2026-04-16T04:30:00.000Z'),
    });

    expect(result.totalBonus).toBe(40000);
    expect(result.bonuses).toEqual([
      {
        type: 'DISTANCE_KM',
        amount: 40000,
        description: 'Thưởng vượt 100 km/ngày',
      },
    ]);
    expect(mockWalletService.creditBonus).toHaveBeenCalledWith(
      'driver-4',
      40000,
      'Thưởng vượt 100 km/ngày',
      'ride-distance-1',
    );
  });
});