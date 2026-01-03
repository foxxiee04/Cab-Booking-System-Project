import { calculateDistance, calculateETA, isWithinRadius, getBoundingBox } from '../geo.utils';

describe('Geo Utils', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two points', () => {
      // Ho Chi Minh City to Bien Hoa (approximately 30km)
      const distance = calculateDistance(10.8231, 106.6297, 10.9574, 106.8426);
      
      expect(distance).toBeGreaterThan(20);
      expect(distance).toBeLessThan(40);
    });

    it('should return 0 for same point', () => {
      const distance = calculateDistance(10.8231, 106.6297, 10.8231, 106.6297);
      
      expect(distance).toBe(0);
    });

    it('should handle negative coordinates', () => {
      // Sydney to Melbourne (approximately 714km)
      const distance = calculateDistance(-33.8688, 151.2093, -37.8136, 144.9631);
      
      expect(distance).toBeGreaterThan(700);
      expect(distance).toBeLessThan(750);
    });
  });

  describe('calculateETA', () => {
    it('should calculate ETA for 10km at 30km/h', () => {
      const eta = calculateETA(10, 30);
      
      expect(eta).toBe(1200); // 20 minutes = 1200 seconds
    });

    it('should use default speed of 30km/h', () => {
      const eta = calculateETA(15);
      
      expect(eta).toBe(1800); // 30 minutes
    });

    it('should handle short distances', () => {
      const eta = calculateETA(0.5, 30);
      
      expect(eta).toBe(60); // 1 minute
    });
  });

  describe('isWithinRadius', () => {
    it('should return true for point within radius', () => {
      const result = isWithinRadius(10.8231, 106.6297, 10.8250, 106.6300, 5);
      
      expect(result).toBe(true);
    });

    it('should return false for point outside radius', () => {
      const result = isWithinRadius(10.8231, 106.6297, 11.0000, 107.0000, 5);
      
      expect(result).toBe(false);
    });

    it('should return true for same point', () => {
      const result = isWithinRadius(10.8231, 106.6297, 10.8231, 106.6297, 1);
      
      expect(result).toBe(true);
    });
  });

  describe('getBoundingBox', () => {
    it('should return bounding box for given radius', () => {
      const box = getBoundingBox(10.8231, 106.6297, 5);
      
      expect(box.minLat).toBeLessThan(10.8231);
      expect(box.maxLat).toBeGreaterThan(10.8231);
      expect(box.minLng).toBeLessThan(106.6297);
      expect(box.maxLng).toBeGreaterThan(106.6297);
    });

    it('should create symmetric box around center', () => {
      const box = getBoundingBox(0, 0, 10);
      
      expect(Math.abs(box.minLat)).toBeCloseTo(Math.abs(box.maxLat), 5);
      expect(Math.abs(box.minLng)).toBeCloseTo(Math.abs(box.maxLng), 5);
    });
  });
});
