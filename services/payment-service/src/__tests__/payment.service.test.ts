import { PaymentService } from '../services/payment.service';
import { PrismaClient, PaymentStatus, PaymentMethod } from '@prisma/client';
import { EventPublisher } from '../events/publisher';
import axios from 'axios';

jest.mock('@prisma/client');
jest.mock('../events/publisher');
jest.mock('axios');

describe('PaymentService - Complete Test Suite', () => {
  let paymentService: PaymentService;
  let mockPrisma: any;
  let mockEventPublisher: jest.Mocked<EventPublisher>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      payment: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      commission: {
        create: jest.fn(),
      },
    };

    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
      connect: jest.fn(),
      close: jest.fn(),
    } as any;

    paymentService = new PaymentService(mockPrisma, mockEventPublisher);
  });

  describe('PROCESS PAYMENT', () => {
    const validPaymentInput = {
      rideId: 'ride-123',
      customerId: 'customer-123',
      driverId: 'driver-456',
      amount: 50000,
      method: PaymentMethod.CASH,
    };

    it('should process CASH payment successfully', async () => {
      mockPrisma.payment.create.mockResolvedValue({
        id: 'payment-123',
        ...validPaymentInput,
        status: PaymentStatus.COMPLETED,
      });

      const result = await paymentService.processPayment(validPaymentInput);

      expect(result.status).toBe(PaymentStatus.COMPLETED);
      expect(mockEventPublisher.publish).toHaveBeenCalledWith('payment.completed', expect.any(Object));
    });

    it('should process CARD payment via gateway', async () => {
      (axios.post as jest.Mock).mockResolvedValue({
        data: { transactionId: 'txn-123', success: true },
      });

      mockPrisma.payment.create.mockResolvedValue({
        id: 'payment-123',
        method: PaymentMethod.CARD,
        status: PaymentStatus.PROCESSING,
      } as any);

      mockPrisma.payment.update.mockResolvedValue({
        id: 'payment-123',
        status: PaymentStatus.COMPLETED,
        transactionId: 'txn-123',
      } as any);

      const result = await paymentService.processPayment({
        ...validPaymentInput,
        method: PaymentMethod.CARD,
        cardToken: 'tok_visa_4242',
      });

      expect(result.status).toBe(PaymentStatus.COMPLETED);
      expect(result.transactionId).toBe('txn-123');
    });

    it('should process WALLET payment', async () => {
      mockPrisma.wallet = {
        findUnique: jest.fn().mockResolvedValue({ balance: 100000 }),
        update: jest.fn(),
      };

      mockPrisma.payment.create.mockResolvedValue({
        id: 'payment-123',
        method: PaymentMethod.WALLET,
        status: PaymentStatus.COMPLETED,
      } as any);

      const result = await paymentService.processPayment({
        ...validPaymentInput,
        method: PaymentMethod.WALLET,
      });

      expect(result.status).toBe(PaymentStatus.COMPLETED);
    });

    it('should fail if wallet balance insufficient', async () => {
      mockPrisma.wallet = {
        findUnique: jest.fn().mockResolvedValue({ balance: 10000 }),
      };

      await expect(
        paymentService.processPayment({
          ...validPaymentInput,
          method: PaymentMethod.WALLET,
          amount: 50000,
        })
      ).rejects.toThrow('Insufficient balance');
    });

    it('should handle payment gateway failure', async () => {
      (axios.post as jest.Mock).mockRejectedValue(new Error('Gateway timeout'));

      mockPrisma.payment.create.mockResolvedValue({
        id: 'payment-123',
        status: PaymentStatus.PROCESSING,
      } as any);

      mockPrisma.payment.update.mockResolvedValue({
        id: 'payment-123',
        status: PaymentStatus.FAILED,
      } as any);

      const result = await paymentService.processPayment({
        ...validPaymentInput,
        method: PaymentMethod.CARD,
      });

      expect(result.status).toBe(PaymentStatus.FAILED);
    });
  });

  describe('REFUND PAYMENT', () => {
    it('should refund completed payment', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'payment-123',
        status: PaymentStatus.COMPLETED,
        amount: 50000,
        method: PaymentMethod.CARD,
        transactionId: 'txn-123',
      });

      (axios.post as jest.Mock).mockResolvedValue({
        data: { refundId: 'ref-123', success: true },
      });

      mockPrisma.payment.update.mockResolvedValue({
        id: 'payment-123',
        status: PaymentStatus.REFUNDED,
        refundId: 'ref-123',
      } as any);

      const result = await paymentService.refundPayment('payment-123', 'Customer request');

      expect(result.status).toBe(PaymentStatus.REFUNDED);
      expect(mockEventPublisher.publish).toHaveBeenCalledWith('payment.refunded', expect.any(Object));
    });

    it('should not refund already refunded payment', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'payment-123',
        status: PaymentStatus.REFUNDED,
      });

      await expect(paymentService.refundPayment('payment-123', 'reason')).rejects.toThrow();
    });

    it('should handle partial refund', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'payment-123',
        status: PaymentStatus.COMPLETED,
        amount: 50000,
      });

      (axios.post as jest.Mock).mockResolvedValue({
        data: { refundId: 'ref-123', success: true },
      });

      mockPrisma.payment.update.mockResolvedValue({
        id: 'payment-123',
        refundAmount: 20000,
      } as any);

      const result = await paymentService.refundPayment('payment-123', 'reason', 20000);

      expect(result.refundAmount).toBe(20000);
    });
  });

  describe('COMMISSION CALCULATION', () => {
    it('should calculate platform commission (20%)', async () => {
      const amount = 100000;
      const platformFee = amount * 0.2; // 20000
      const driverEarnings = amount * 0.8; // 80000

      mockPrisma.payment.create.mockResolvedValue({
        id: 'payment-123',
        amount,
      } as any);

      mockPrisma.commission.create.mockResolvedValue({
        platformFee,
        driverEarnings,
      } as any);

      await paymentService.processPayment({
        rideId: 'ride-123',
        customerId: 'customer-123',
        driverId: 'driver-456',
        amount,
        method: PaymentMethod.CASH,
      });

      expect(mockPrisma.commission.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          platformFee: 20000,
          driverEarnings: 80000,
        }),
      });
    });

    it('should update driver total earnings', async () => {
      mockPrisma.driver = {
        update: jest.fn().mockResolvedValue({ totalEarnings: 500000 }),
      };

      mockPrisma.payment.create.mockResolvedValue({
        id: 'payment-123',
        amount: 50000,
      } as any);

      await paymentService.processPayment({
        rideId: 'ride-123',
        customerId: 'customer-123',
        driverId: 'driver-456',
        amount: 50000,
        method: PaymentMethod.CASH,
      });

      expect(mockPrisma.driver.update).toHaveBeenCalled();
    });
  });

  describe('PAYMENT HISTORY', () => {
    it('should get customer payment history', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([
        { id: 'payment-1', customerId: 'customer-123', amount: 50000 },
        { id: 'payment-2', customerId: 'customer-123', amount: 75000 },
      ]);

      const result = await paymentService.getCustomerPayments('customer-123');

      expect(result).toHaveLength(2);
      expect(result[0].amount).toBe(50000);
    });

    it('should get driver earnings history', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([
        { id: 'payment-1', driverId: 'driver-456', amount: 50000 },
        { id: 'payment-2', driverId: 'driver-456', amount: 75000 },
      ]);

      const result = await paymentService.getDriverEarnings('driver-456');

      expect(result).toHaveLength(2);
    });

    it('should filter payments by date range', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');

      mockPrisma.payment.findMany.mockResolvedValue([
        { id: 'payment-1', createdAt: new Date('2026-01-15') },
      ]);

      const result = await paymentService.getPaymentsByDateRange(startDate, endDate);

      expect(result).toHaveLength(1);
    });
  });

  describe('RETRY FAILED PAYMENTS', () => {
    it('should retry failed payment', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'payment-123',
        status: PaymentStatus.FAILED,
        method: PaymentMethod.CARD,
        amount: 50000,
      });

      (axios.post as jest.Mock).mockResolvedValue({
        data: { transactionId: 'txn-456', success: true },
      });

      mockPrisma.payment.update.mockResolvedValue({
        id: 'payment-123',
        status: PaymentStatus.COMPLETED,
        retryCount: 1,
      } as any);

      const result = await paymentService.retryPayment('payment-123');

      expect(result.status).toBe(PaymentStatus.COMPLETED);
      expect(result.retryCount).toBe(1);
    });

    it('should limit retry attempts to 3', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'payment-123',
        status: PaymentStatus.FAILED,
        retryCount: 3,
      });

      await expect(paymentService.retryPayment('payment-123')).rejects.toThrow('Max retries exceeded');
    });
  });

  describe('EDGE CASES', () => {
    it('should handle concurrent payment processing', async () => {
      const inputs = Array(10).fill(null).map((_, i) => ({
        rideId: `ride-${i}`,
        customerId: 'customer-123',
        driverId: 'driver-456',
        amount: 50000,
        method: PaymentMethod.CASH,
      }));

      mockPrisma.payment.create.mockResolvedValue({ status: PaymentStatus.COMPLETED } as any);

      const promises = inputs.map(input => paymentService.processPayment(input));

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });

    it('should handle negative amount', async () => {
      await expect(
        paymentService.processPayment({
          rideId: 'ride-123',
          customerId: 'customer-123',
          driverId: 'driver-456',
          amount: -50000,
          method: PaymentMethod.CASH,
        })
      ).rejects.toThrow('Invalid amount');
    });

    it('should handle zero amount', async () => {
      await expect(
        paymentService.processPayment({
          rideId: 'ride-123',
          customerId: 'customer-123',
          driverId: 'driver-456',
          amount: 0,
          method: PaymentMethod.CASH,
        })
      ).rejects.toThrow('Invalid amount');
    });

    it('should handle very large amounts', async () => {
      const largeAmount = 10000000; // 10 million

      mockPrisma.payment.create.mockResolvedValue({
        id: 'payment-123',
        amount: largeAmount,
        status: PaymentStatus.COMPLETED,
      } as any);

      const result = await paymentService.processPayment({
        rideId: 'ride-123',
        customerId: 'customer-123',
        driverId: 'driver-456',
        amount: largeAmount,
        method: PaymentMethod.CASH,
      });

      expect(result.amount).toBe(largeAmount);
    });

    it('should handle database transaction failures', async () => {
      mockPrisma.payment.create.mockRejectedValue(new Error('Database error'));

      await expect(
        paymentService.processPayment({
          rideId: 'ride-123',
          customerId: 'customer-123',
          driverId: 'driver-456',
          amount: 50000,
          method: PaymentMethod.CASH,
        })
      ).rejects.toThrow('Database error');
    });
  });

  describe('SECURITY', () => {
    it('should not expose card details in response', async () => {
      mockPrisma.payment.create.mockResolvedValue({
        id: 'payment-123',
        cardNumber: '4242424242424242', // Should be masked
        status: PaymentStatus.COMPLETED,
      } as any);

      const result = await paymentService.processPayment({
        rideId: 'ride-123',
        customerId: 'customer-123',
        driverId: 'driver-456',
        amount: 50000,
        method: PaymentMethod.CARD,
        cardToken: 'tok_visa_4242',
      });

      expect(result.cardNumber).toMatch(/\*\*\*\*\*\*\*\*\*\*\*\*\d{4}/); // Should be masked
    });

    it('should validate payment authorization', async () => {
      // Customer should only see their own payments
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'payment-123',
        customerId: 'customer-456', // Different customer
      });

      await expect(
        paymentService.getPaymentById('payment-123', 'customer-123')
      ).rejects.toThrow('Unauthorized');
    });
  });
});
