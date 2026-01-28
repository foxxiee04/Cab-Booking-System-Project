// Mock Redis before imports
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  expire: jest.fn(),
};

jest.mock('../config/redis', () => ({
  redisClient: mockRedis,
}));

jest.mock('../config', () => ({
  config: {
    pricing: {
      baseFare: {
        ECONOMY: 10000,
        COMFORT: 15000,
        PREMIUM: 25000,
      },
      perKmRate: {
        ECONOMY: 5000,
        COMFORT: 7500,
        PREMIUM: 12000,
      },
      perMinuteRate: {
        ECONOMY: 500,
        COMFORT: 750,
        PREMIUM: 1200,
      },
      minimumFare: 20000,
      surgeThresholds: {
        medium: 1.3,
        high: 1.6,
        peak: 2.0,
      },
    },
  },
}));

jest.mock('../utils/geo.utils', () => ({
  calculateDistance: jest.fn((lat1, lng1, lat2, lng2) => 5.5),
  estimateDuration: jest.fn((distance) => distance * 3 * 60),
}));

import { PricingService } from '../services/pricing.service';

describe('PricingService - Simple Test Suite', () => {
  let pricingService: PricingService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.get.mockReset();
    mockRedis.set.mockReset();
    mockRedis.setex.mockReset();
    mockRedis.expire.mockReset();

    pricingService = new PricingService();
  });

  describe('ESTIMATE FARE', () => {
    it('should calculate fare for ECONOMY ride', async () => {
      mockRedis.get.mockResolvedValue('1.0');

      const result = await pricingService.estimateFare({
        pickupLat: 10.7764,
        pickupLng: 106.7008,
        dropoffLat: 10.7809,
        dropoffLng: 106.6956,
        vehicleType: 'ECONOMY',
      });

      expect(result.fare).toBeGreaterThan(0);
      expect(result.distance).toBe(5.5);
      expect(result.surgeMultiplier).toBe(1.0);
      expect(result.breakdown).toBeDefined();
    });

    it('should apply surge multiplier', async () => {
      mockRedis.get.mockResolvedValue('1.5');

      const result = await pricingService.estimateFare({
        pickupLat: 10.7764,
        pickupLng: 106.7008,
        dropoffLat: 10.7809,
        dropoffLng: 106.6956,
        vehicleType: 'ECONOMY',
      });

      expect(result.surgeMultiplier).toBe(1.5);
      expect(result.breakdown.surgeAmount).toBeGreaterThan(0);
    });

    it('should enforce minimum fare', async () => {
      mockRedis.get.mockResolvedValue('1.0');

      const calculateDistance = require('../utils/geo.utils').calculateDistance;
      calculateDistance.mockReturnValueOnce(0.5); // very short distance

      const result = await pricingService.estimateFare({
        pickupLat: 10.7764,
        pickupLng: 106.7008,
        dropoffLat: 10.7765,
        dropoffLng: 106.7009,
        vehicleType: 'ECONOMY',
      });

      expect(result.fare).toBeGreaterThanOrEqual(20000); // minimum fare
    });

    it('should handle different vehicle types', async () => {
      mockRedis.get.mockResolvedValue('1.0');

      const economy = await pricingService.estimateFare({
        pickupLat: 10.7764,
        pickupLng: 106.7008,
        dropoffLat: 10.7809,
        dropoffLng: 106.6956,
        vehicleType: 'ECONOMY',
      });

      const premium = await pricingService.estimateFare({
        pickupLat: 10.7764,
        pickupLng: 106.7008,
        dropoffLat: 10.7809,
        dropoffLng: 106.6956,
        vehicleType: 'PREMIUM',
      });

      expect(premium.fare).toBeGreaterThan(economy.fare);
    });
  });

  describe('SURGE MULTIPLIER', () => {
    it('should get current surge multiplier', async () => {
      mockRedis.get.mockResolvedValue('1.5');

      const result = await pricingService.getCurrentSurgeMultiplier();

      expect(result).toBe(1.5);
    });

    it('should return default 1.0 if not set', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await pricingService.getCurrentSurgeMultiplier();

      expect(result).toBe(1.0);
    });

    it('should set surge multiplier', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.expire.mockResolvedValue(1);

      await pricingService.setSurgeMultiplier(1.8);

      expect(mockRedis.set).toHaveBeenCalledWith('surge:multiplier', '1.8');
      expect(mockRedis.expire).toHaveBeenCalledWith('surge:multiplier', 3600);
    });

    it('should reject invalid surge multiplier', async () => {
      await expect(pricingService.setSurgeMultiplier(0.5)).rejects.toThrow(
        'Surge multiplier must be between 1.0 and 3.0'
      );

      await expect(pricingService.setSurgeMultiplier(4.0)).rejects.toThrow(
        'Surge multiplier must be between 1.0 and 3.0'
      );
    });
  });

  describe('DYNAMIC SURGE CALCULATION', () => {
    it('should calculate surge based on demand/supply', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.expire.mockResolvedValue(1);

      const result = await pricingService.calculateDynamicSurge({
        activeRides: 100,
        availableDrivers: 30,
        timeOfDay: 8,
        dayOfWeek: 3,
      });

      expect(result.multiplier).toBeGreaterThan(1.0);
      expect(result.demandSupplyRatio).toBeCloseTo(3.33, 1);
    });

    it('should apply peak hour multiplier', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.expire.mockResolvedValue(1);

      const peakResult = await pricingService.calculateDynamicSurge({
        activeRides: 50,
        availableDrivers: 50,
        timeOfDay: 18, // peak hour
        dayOfWeek: 3,
      });

      expect(peakResult.multiplier).toBeGreaterThanOrEqual(1.0);
    });

    it('should apply weekend late night multiplier', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.expire.mockResolvedValue(1);

      const result = await pricingService.calculateDynamicSurge({
        activeRides: 50,
        availableDrivers: 50,
        timeOfDay: 22, // late night
        dayOfWeek: 6, // Saturday
      });

      expect(result.multiplier).toBeGreaterThanOrEqual(1.0);
    });

    it('should cap multiplier at 3.0', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.expire.mockResolvedValue(1);

      const result = await pricingService.calculateDynamicSurge({
        activeRides: 1000,
        availableDrivers: 10,
        timeOfDay: 18,
        dayOfWeek: 6,
      });

      expect(result.multiplier).toBeLessThanOrEqual(3.0);
    });

    it('should handle zero available drivers', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.expire.mockResolvedValue(1);

      const result = await pricingService.calculateDynamicSurge({
        activeRides: 100,
        availableDrivers: 0,
        timeOfDay: 12,
        dayOfWeek: 3,
      });

      expect(result.multiplier).toBeGreaterThan(1.0);
      expect(result.demandSupplyRatio).toBe(5);
    });
  });

  describe('SURGE ZONES', () => {
    it('should get surge zones', async () => {
      const zones = [
        { name: 'District 1', multiplier: 1.5 },
        { name: 'Airport', multiplier: 2.0 },
      ];

      mockRedis.get.mockResolvedValue(JSON.stringify(zones));

      const result = await pricingService.getSurgeZones();

      expect(result).toEqual(zones);
    });

    it('should return empty array if no zones', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await pricingService.getSurgeZones();

      expect(result).toEqual([]);
    });
  });
});
