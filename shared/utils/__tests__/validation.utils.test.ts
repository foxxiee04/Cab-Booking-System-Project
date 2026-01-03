import {
  isValidEmail,
  isValidPhoneVN,
  isValidLatitude,
  isValidLongitude,
  isValidCoordinates,
  isValidUUID,
  validatePasswordStrength,
  sanitizeString,
} from '../validation.utils';

describe('Validation Utils', () => {
  describe('isValidEmail', () => {
    it('should return true for valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.org')).toBe(true);
    });

    it('should return false for invalid emails', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('no@domain')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
      expect(isValidEmail('spaces in@email.com')).toBe(false);
    });
  });

  describe('isValidPhoneVN', () => {
    it('should return true for valid Vietnam phone numbers', () => {
      expect(isValidPhoneVN('0901234567')).toBe(true);
      expect(isValidPhoneVN('0381234567')).toBe(true);
      expect(isValidPhoneVN('84901234567')).toBe(true);
    });

    it('should return false for invalid phone numbers', () => {
      expect(isValidPhoneVN('0101234567')).toBe(false); // Invalid prefix
      expect(isValidPhoneVN('123456789')).toBe(false); // Too short
      expect(isValidPhoneVN('090123456789')).toBe(false); // Too long
    });
  });

  describe('isValidLatitude', () => {
    it('should return true for valid latitudes', () => {
      expect(isValidLatitude(0)).toBe(true);
      expect(isValidLatitude(45.5)).toBe(true);
      expect(isValidLatitude(-90)).toBe(true);
      expect(isValidLatitude(90)).toBe(true);
    });

    it('should return false for invalid latitudes', () => {
      expect(isValidLatitude(91)).toBe(false);
      expect(isValidLatitude(-91)).toBe(false);
      expect(isValidLatitude(200)).toBe(false);
    });
  });

  describe('isValidLongitude', () => {
    it('should return true for valid longitudes', () => {
      expect(isValidLongitude(0)).toBe(true);
      expect(isValidLongitude(106.6297)).toBe(true);
      expect(isValidLongitude(-180)).toBe(true);
      expect(isValidLongitude(180)).toBe(true);
    });

    it('should return false for invalid longitudes', () => {
      expect(isValidLongitude(181)).toBe(false);
      expect(isValidLongitude(-181)).toBe(false);
    });
  });

  describe('isValidCoordinates', () => {
    it('should return true for valid coordinates', () => {
      expect(isValidCoordinates(10.8231, 106.6297)).toBe(true);
      expect(isValidCoordinates(0, 0)).toBe(true);
    });

    it('should return false for invalid coordinates', () => {
      expect(isValidCoordinates(91, 106.6297)).toBe(false);
      expect(isValidCoordinates(10.8231, 181)).toBe(false);
    });
  });

  describe('isValidUUID', () => {
    it('should return true for valid UUID v4', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('6ba7b810-9dad-41d4-80b4-00c04fd430c8')).toBe(true);
    });

    it('should return false for invalid UUIDs', () => {
      expect(isValidUUID('invalid-uuid')).toBe(false);
      expect(isValidUUID('550e8400-e29b-11d4-a716-446655440000')).toBe(false); // v1
      expect(isValidUUID('')).toBe(false);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should pass for strong password', () => {
      const result = validatePasswordStrength('StrongPass123');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for weak password', () => {
      const result = validatePasswordStrength('weak');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should require minimum length', () => {
      const result = validatePasswordStrength('Short1');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters');
    });
  });

  describe('sanitizeString', () => {
    it('should escape HTML characters', () => {
      const result = sanitizeString('<script>alert("xss")</script>');
      
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    it('should trim whitespace', () => {
      const result = sanitizeString('  hello world  ');
      
      expect(result).toBe('hello world');
    });
  });
});
