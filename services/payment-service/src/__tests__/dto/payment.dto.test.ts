import {
  processPaymentSchema,
  refundPaymentSchema,
  paginationSchema,
} from '../../dto/payment.dto';

describe('Payment DTOs Validation', () => {
  describe('processPaymentSchema', () => {
    it('should validate valid payment processing request', () => {
      const { error, value } = processPaymentSchema.validate({
        paymentId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(error).toBeUndefined();
      expect(value.paymentId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should accept optional card token', () => {
      const { error, value } = processPaymentSchema.validate({
        paymentId: '550e8400-e29b-41d4-a716-446655440000',
        cardToken: 'tok_visa_1234',
      });

      expect(error).toBeUndefined();
      expect(value.cardToken).toBe('tok_visa_1234');
    });

    it('should reject invalid UUID format', () => {
      const { error } = processPaymentSchema.validate({
        paymentId: 'invalid-uuid',
      });

      expect(error).toBeDefined();
    });

    it('should reject missing payment ID', () => {
      const { error } = processPaymentSchema.validate({});

      expect(error).toBeDefined();
    });
  });

  describe('refundPaymentSchema', () => {
    it('should validate valid refund request', () => {
      const { error, value } = refundPaymentSchema.validate({
        reason: 'Customer requested refund',
      });

      expect(error).toBeUndefined();
      expect(value.reason).toBe('Customer requested refund');
    });

    it('should accept optional partial refund amount', () => {
      const { error, value } = refundPaymentSchema.validate({
        reason: 'Partial service',
        amount: 50000,
      });

      expect(error).toBeUndefined();
      expect(value.amount).toBe(50000);
    });

    it('should reject missing reason', () => {
      const { error } = refundPaymentSchema.validate({});

      expect(error).toBeDefined();
    });

    it('should reject reason longer than 500 characters', () => {
      const { error } = refundPaymentSchema.validate({
        reason: 'a'.repeat(501),
      });

      expect(error).toBeDefined();
    });

    it('should reject negative refund amount', () => {
      const { error } = refundPaymentSchema.validate({
        reason: 'Refund',
        amount: -1000,
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
        page: 3,
        limit: 50,
      });

      expect(error).toBeUndefined();
      expect(value.page).toBe(3);
      expect(value.limit).toBe(50);
    });

    it('should reject page less than 1', () => {
      const { error } = paginationSchema.validate({
        page: 0,
      });

      expect(error).toBeDefined();
    });

    it('should reject limit greater than 100', () => {
      const { error } = paginationSchema.validate({
        limit: 200,
      });

      expect(error).toBeDefined();
    });

    it('should reject non-integer values', () => {
      const { error } = paginationSchema.validate({
        page: 1.5,
      });

      expect(error).toBeDefined();
    });
  });
});
