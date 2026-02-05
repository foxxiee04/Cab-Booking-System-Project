import {
  registerDriverSchema,
  updateLocationSchema,
  findNearbySchema,
} from '../../dto/driver.dto';

describe('Driver DTOs Validation', () => {
  describe('registerDriverSchema', () => {
    const validDriverData = {
      vehicle: {
        brand: 'Toyota',
        model: 'Vios',
        year: 2022,
        color: 'White',
        plate: '51A-12345',
        type: 'CAR',
      },
      license: {
        number: 'B2-123456789',
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      },
    };

    it('should validate valid driver registration', () => {
      const { error, value } = registerDriverSchema.validate(validDriverData);

      expect(error).toBeUndefined();
      expect(value.vehicle.brand).toBe('Toyota');
    });

    it('should reject missing vehicle info', () => {
      const invalidData = {
        license: validDriverData.license,
      };
      const { error } = registerDriverSchema.validate(invalidData);

      expect(error).toBeDefined();
    });

    it('should reject expired license', () => {
      const invalidData = {
        ...validDriverData,
        license: {
          ...validDriverData.license,
          expiryDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        },
      };
      const { error } = registerDriverSchema.validate(invalidData);

      expect(error).toBeDefined();
      expect(error!.message).toContain('must not be expired');
    });

    it('should reject invalid vehicle type', () => {
      const invalidData = {
        ...validDriverData,
        vehicle: {
          ...validDriverData.vehicle,
          type: 'LUXURY', // Not valid
        },
      };
      const { error } = registerDriverSchema.validate(invalidData);

      expect(error).toBeDefined();
    });

    it('should reject vehicle year before 2000', () => {
      const invalidData = {
        ...validDriverData,
        vehicle: {
          ...validDriverData.vehicle,
          year: 1999,
        },
      };
      const { error } = registerDriverSchema.validate(invalidData);

      expect(error).toBeDefined();
    });
  });

  describe('updateLocationSchema', () => {
    it('should validate valid location update', () => {
      const { error, value } = updateLocationSchema.validate({
        lat: 10.8231,
        lng: 106.6297,
      });

      expect(error).toBeUndefined();
      expect(value.lat).toBe(10.8231);
    });

    it('should accept optional heading and speed', () => {
      const { error, value } = updateLocationSchema.validate({
        lat: 10.8231,
        lng: 106.6297,
        heading: 45,
        speed: 30,
      });

      expect(error).toBeUndefined();
      expect(value.heading).toBe(45);
      expect(value.speed).toBe(30);
    });

    it('should reject invalid latitude', () => {
      const { error } = updateLocationSchema.validate({
        lat: 100, // Invalid
        lng: 106.6297,
      });

      expect(error).toBeDefined();
    });

    it('should reject invalid heading', () => {
      const { error } = updateLocationSchema.validate({
        lat: 10.8231,
        lng: 106.6297,
        heading: 400, // Invalid, should be 0-360
      });

      expect(error).toBeDefined();
    });
  });

  describe('findNearbySchema', () => {
    it('should validate valid nearby search', () => {
      const { error, value } = findNearbySchema.validate({
        lat: 10.8231,
        lng: 106.6297,
      });

      expect(error).toBeUndefined();
      expect(value.radius).toBe(5); // Default
    });

    it('should accept custom radius', () => {
      const { error, value } = findNearbySchema.validate({
        lat: 10.8231,
        lng: 106.6297,
        radius: 10,
      });

      expect(error).toBeUndefined();
      expect(value.radius).toBe(10);
    });

    it('should reject radius greater than 50km', () => {
      const { error } = findNearbySchema.validate({
        lat: 10.8231,
        lng: 106.6297,
        radius: 100,
      });

      expect(error).toBeDefined();
    });

    it('should accept optional vehicle type filter', () => {
      const { error, value } = findNearbySchema.validate({
        lat: 10.8231,
        lng: 106.6297,
        vehicleType: 'PREMIUM',
      });

      expect(error).toBeUndefined();
      expect(value.vehicleType).toBe('PREMIUM');
    });
  });
});
