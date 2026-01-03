import { createRideSchema, cancelRideSchema, paginationSchema } from '../../dto/ride.dto';

describe('Ride DTOs Validation', () => {
  describe('createRideSchema', () => {
    it('should validate a valid ride creation request', () => {
      const validData = {
        pickup: {
          address: '123 Main St',
          lat: 10.762622,
          lng: 106.660172,
        },
        dropoff: {
          address: '456 Other St',
          lat: 10.773831,
          lng: 106.704895,
        },
      };

      const { error, value } = createRideSchema.validate(validData);

      expect(error).toBeUndefined();
      expect(value.pickup.lat).toBe(10.762622);
      expect(value.vehicleType).toBe('STANDARD'); // default
    });

    it('should reject missing pickup location', () => {
      const invalidData = {
        dropoff: {
          lat: 10.773831,
          lng: 106.704895,
        },
      };

      const { error } = createRideSchema.validate(invalidData);

      expect(error).toBeDefined();
      expect(error!.message).toContain('Pickup location is required');
    });

    it('should reject invalid latitude', () => {
      const invalidData = {
        pickup: { lat: 200, lng: 106.0 }, // invalid lat > 90
        dropoff: { lat: 10.0, lng: 106.0 },
      };

      const { error } = createRideSchema.validate(invalidData);

      expect(error).toBeDefined();
      expect(error!.message).toContain('Latitude must be between -90 and 90');
    });

    it('should reject invalid longitude', () => {
      const invalidData = {
        pickup: { lat: 10.0, lng: 200 }, // invalid lng > 180
        dropoff: { lat: 10.0, lng: 106.0 },
      };

      const { error } = createRideSchema.validate(invalidData);

      expect(error).toBeDefined();
      expect(error!.message).toContain('Longitude must be between -180 and 180');
    });

    it('should accept valid vehicle types', () => {
      const validData = {
        pickup: { lat: 10.0, lng: 106.0 },
        dropoff: { lat: 10.1, lng: 106.1 },
        vehicleType: 'PREMIUM',
      };

      const { error, value } = createRideSchema.validate(validData);

      expect(error).toBeUndefined();
      expect(value.vehicleType).toBe('PREMIUM');
    });

    it('should reject invalid vehicle type', () => {
      const invalidData = {
        pickup: { lat: 10.0, lng: 106.0 },
        dropoff: { lat: 10.1, lng: 106.1 },
        vehicleType: 'LUXURY', // not valid
      };

      const { error } = createRideSchema.validate(invalidData);

      expect(error).toBeDefined();
    });
  });

  describe('cancelRideSchema', () => {
    it('should allow empty reason', () => {
      const { error } = cancelRideSchema.validate({});

      expect(error).toBeUndefined();
    });

    it('should accept valid reason', () => {
      const { error, value } = cancelRideSchema.validate({
        reason: 'Changed my mind',
      });

      expect(error).toBeUndefined();
      expect(value.reason).toBe('Changed my mind');
    });

    it('should reject reason longer than 500 characters', () => {
      const { error } = cancelRideSchema.validate({
        reason: 'a'.repeat(501),
      });

      expect(error).toBeDefined();
    });
  });

  describe('paginationSchema', () => {
    it('should use defaults when not provided', () => {
      const { error, value } = paginationSchema.validate({});

      expect(error).toBeUndefined();
      expect(value.page).toBe(1);
      expect(value.limit).toBe(20);
    });

    it('should accept valid pagination params', () => {
      const { error, value } = paginationSchema.validate({
        page: 5,
        limit: 50,
      });

      expect(error).toBeUndefined();
      expect(value.page).toBe(5);
      expect(value.limit).toBe(50);
    });

    it('should reject page less than 1', () => {
      const { error } = paginationSchema.validate({ page: 0 });

      expect(error).toBeDefined();
    });

    it('should reject limit greater than 100', () => {
      const { error } = paginationSchema.validate({ limit: 150 });

      expect(error).toBeDefined();
    });
  });
});
