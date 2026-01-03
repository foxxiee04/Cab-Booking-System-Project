import { registerUserSchema, loginSchema, changePasswordSchema } from '../../dto/auth.dto';

describe('Auth DTOs Validation', () => {
  describe('registerUserSchema', () => {
    const validRegisterData = {
      email: 'test@example.com',
      password: 'securePassword123',
      phone: '0901234567',
      role: 'CUSTOMER',
      profile: {
        firstName: 'John',
        lastName: 'Doe',
      },
    };

    it('should validate a valid registration request', () => {
      const { error, value } = registerUserSchema.validate(validRegisterData);

      expect(error).toBeUndefined();
      expect(value.email).toBe('test@example.com');
      expect(value.role).toBe('CUSTOMER');
    });

    it('should reject invalid email', () => {
      const invalidData = { ...validRegisterData, email: 'invalid-email' };
      const { error } = registerUserSchema.validate(invalidData);

      expect(error).toBeDefined();
      expect(error!.message).toContain('valid email');
    });

    it('should reject password shorter than 8 characters', () => {
      const invalidData = { ...validRegisterData, password: '1234567' };
      const { error } = registerUserSchema.validate(invalidData);

      expect(error).toBeDefined();
      expect(error!.message).toContain('at least 8 characters');
    });

    it('should reject invalid phone number', () => {
      const invalidData = { ...validRegisterData, phone: '123' };
      const { error } = registerUserSchema.validate(invalidData);

      expect(error).toBeDefined();
      expect(error!.message).toContain('10-15 digits');
    });

    it('should reject invalid role', () => {
      const invalidData = { ...validRegisterData, role: 'ADMIN' };
      const { error } = registerUserSchema.validate(invalidData);

      expect(error).toBeDefined();
      expect(error!.message).toContain('CUSTOMER or DRIVER');
    });

    it('should require profile firstName and lastName', () => {
      const invalidData = {
        ...validRegisterData,
        profile: { firstName: 'John' }, // missing lastName
      };
      const { error } = registerUserSchema.validate(invalidData);

      expect(error).toBeDefined();
      expect(error!.message).toContain('Last name is required');
    });

    it('should accept optional avatar URL', () => {
      const dataWithAvatar = {
        ...validRegisterData,
        profile: {
          ...validRegisterData.profile,
          avatar: 'https://example.com/avatar.jpg',
        },
      };
      const { error, value } = registerUserSchema.validate(dataWithAvatar);

      expect(error).toBeUndefined();
      expect(value.profile.avatar).toBe('https://example.com/avatar.jpg');
    });
  });

  describe('loginSchema', () => {
    it('should validate valid login credentials', () => {
      const { error, value } = loginSchema.validate({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(error).toBeUndefined();
      expect(value.email).toBe('test@example.com');
    });

    it('should reject missing email', () => {
      const { error } = loginSchema.validate({ password: 'password123' });

      expect(error).toBeDefined();
      expect(error!.message).toContain('Email is required');
    });

    it('should reject missing password', () => {
      const { error } = loginSchema.validate({ email: 'test@example.com' });

      expect(error).toBeDefined();
      expect(error!.message).toContain('Password is required');
    });
  });

  describe('changePasswordSchema', () => {
    it('should validate valid password change request', () => {
      const { error } = changePasswordSchema.validate({
        currentPassword: 'oldPassword123',
        newPassword: 'newPassword456',
      });

      expect(error).toBeUndefined();
    });

    it('should reject short new password', () => {
      const { error } = changePasswordSchema.validate({
        currentPassword: 'oldPassword123',
        newPassword: 'short',
      });

      expect(error).toBeDefined();
    });
  });
});
