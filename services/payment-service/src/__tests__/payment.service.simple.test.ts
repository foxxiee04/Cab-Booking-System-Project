// Mock Prisma before imports
const mockPrisma: any = {
  fare: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    upsert: jest.fn(),
  },
  payment: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  driverEarnings: {
    create: jest.fn().mockResolvedValue({ id: 'earnings-1' }),
    upsert: jest.fn().mockResolvedValue({ id: 'earnings-1' }),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  walletTransaction: {
    findMany: jest.fn().mockResolvedValue([]),
    aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
  },
  outboxEvent: {
    create: jest.fn(),
  },
  $transaction: jest.fn((callback: any) => callback(mockPrisma)),
};

jest.mock('../generated/prisma-client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
  PaymentStatus: {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    REQUIRES_ACTION: 'REQUIRES_ACTION',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    REFUNDED: 'REFUNDED',
  },
  PaymentMethod: {
    CASH: 'CASH',
    CARD: 'CARD',
    WALLET: 'WALLET',
    MOMO: 'MOMO',
    VISA: 'VISA',
  },
  PaymentProvider: {
    MOCK: 'MOCK',
    STRIPE: 'STRIPE',
    MOMO: 'MOMO',
    VISA: 'VISA',
    ZALOPAY: 'ZALOPAY',
  },
  WalletTransactionType: {
    COMMISSION: 'COMMISSION',
    REFUND: 'REFUND',
  },
}));

jest.mock('../events/publisher');

import { PaymentService } from '../services/payment.service';
import { EventPublisher } from '../events/publisher';
import { commissionService } from '../services/commission.service';

describe('PaymentService - Simple Test Suite', () => {
  let paymentService: PaymentService;
  let mockEventPublisher: jest.Mocked<EventPublisher>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mocks
    mockPrisma.fare.findFirst.mockReset();
    mockPrisma.fare.findUnique.mockReset();
    mockPrisma.fare.findMany.mockReset();
    mockPrisma.fare.findMany.mockResolvedValue([]);
    mockPrisma.fare.create.mockReset();
    mockPrisma.fare.upsert.mockReset();
    mockPrisma.payment.findUnique.mockReset();
    mockPrisma.payment.findFirst.mockReset();
    mockPrisma.payment.findMany.mockReset();
    mockPrisma.payment.create.mockReset();
    mockPrisma.payment.upsert.mockReset();
    mockPrisma.payment.update.mockReset();
    mockPrisma.payment.count.mockReset();
    mockPrisma.driverEarnings.create.mockReset();
    mockPrisma.driverEarnings.upsert.mockReset();
    mockPrisma.driverEarnings.updateMany.mockReset();
    mockPrisma.driverEarnings.findUnique.mockReset();
    mockPrisma.driverEarnings.findMany?.mockReset?.();
    mockPrisma.driverEarnings.count?.mockReset?.();
    mockPrisma.driverEarnings.aggregate?.mockReset?.();
    mockPrisma.walletTransaction.findMany?.mockReset?.();
    mockPrisma.walletTransaction.aggregate?.mockReset?.();
    mockPrisma.outboxEvent.create.mockReset();
    mockPrisma.$transaction.mockImplementation((callback: any) => callback(mockPrisma));

    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
      connect: jest.fn(),
      close: jest.fn(),
    } as any;

    paymentService = new PaymentService(mockPrisma as any, mockEventPublisher);
    (paymentService as any).walletService = {
      debitCommission: jest.fn().mockResolvedValue(-8_789),
      creditEarning: jest.fn().mockResolvedValue(42_000),
    };
    (paymentService as any).voucherService = {
      applyVoucher: jest.fn(),
      redeemVoucher: jest.fn(),
    };
  });

  describe('PROCESS RIDE COMPLETED', () => {
    it('should calculate fare and create payment', async () => {
      const payload = {
        rideId: 'ride-123',
        customerId: 'customer-123',
        driverId: 'driver-456',
        distance: 5.0,
        duration: 600,
        surgeMultiplier: 1.0,
        vehicleType: 'ECONOMY',
      };

      mockPrisma.fare.findUnique.mockResolvedValue(null);
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      mockPrisma.driverEarnings.findUnique.mockResolvedValue(null);
      mockPrisma.fare.upsert.mockResolvedValue({
        id: 'fare-123',
        rideId: 'ride-123',
        totalFare: 50000,
      });
      mockPrisma.driverEarnings.upsert.mockResolvedValue({
        id: 'earnings-123',
        rideId: 'ride-123',
      });
      mockPrisma.payment.upsert.mockResolvedValue({
        id: 'payment-123',
        rideId: 'ride-123',
        status: 'PENDING',
        amount: 50000,
        customerId: 'customer-123',
        driverId: 'driver-456',
      });
      mockPrisma.outboxEvent.create.mockResolvedValue({});
      (paymentService as any).processPaymentRecord = jest.fn().mockResolvedValue(undefined);

      await paymentService.processRideCompleted(payload);

      expect(mockPrisma.fare.upsert).toHaveBeenCalled();
      expect(mockPrisma.payment.upsert).toHaveBeenCalled();
      expect((paymentService as any).processPaymentRecord).toHaveBeenCalled();
    });

    it('should skip when the ride was already processed end-to-end', async () => {
      const payload = {
        rideId: 'ride-123',
        customerId: 'customer-123',
        driverId: 'driver-456',
        distance: 5.0,
        duration: 600,
      };

      mockPrisma.fare.findUnique.mockResolvedValue({
        id: 'existing-fare',
        rideId: 'ride-123',
      });
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'existing-payment',
        rideId: 'ride-123',
      });
      mockPrisma.driverEarnings.findUnique.mockResolvedValue({
        id: 'existing-earnings',
        rideId: 'ride-123',
      });

      await paymentService.processRideCompleted(payload);

      expect(mockPrisma.fare.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.payment.upsert).not.toHaveBeenCalled();
    });

    it('should debit cash debt and mark it settled after wallet deduction', async () => {
      jest.spyOn(paymentService as any, 'calculateFare').mockReturnValue({
        baseFare: 30_000,
        distanceFare: 12_000,
        timeFare: 8_000,
        totalFare: 50_000,
      });
      jest.spyOn(commissionService, 'calculateCommission').mockReturnValue({
        grossFare: 50_000,
        commissionRate: 0.2,
        platformFee: 10_000,
        penalty: 789,
        netEarnings: 39_211,
        driverCollected: true,
        cashDebt: 10_789,
        breakdown: {
          penalties: { lowAcceptance: 789 },
        },
      } as any);

      mockPrisma.fare.findUnique.mockResolvedValue(null);
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      mockPrisma.driverEarnings.findUnique.mockResolvedValue(null);
      mockPrisma.fare.upsert.mockResolvedValue({ rideId: 'ride-cash-1' });
      mockPrisma.driverEarnings.upsert.mockResolvedValue({ rideId: 'ride-cash-1' });
      mockPrisma.payment.upsert.mockResolvedValue({
        id: 'payment-cash-1',
        rideId: 'ride-cash-1',
        status: 'PENDING',
        amount: 50_000,
        customerId: 'customer-1',
        driverId: 'driver-1',
      });
      mockPrisma.outboxEvent.create.mockResolvedValue({});
      (paymentService as any).processPaymentRecord = jest.fn().mockResolvedValue(undefined);

      await paymentService.processRideCompleted({
        rideId: 'ride-cash-1',
        customerId: 'customer-1',
        driverId: 'driver-1',
        distance: 5,
        duration: 600,
        paymentMethod: 'CASH',
      });

      expect((paymentService as any).walletService.debitCommission).toHaveBeenCalledWith('driver-1', 10_789, 'ride-cash-1');
      expect(mockPrisma.driverEarnings.updateMany).toHaveBeenCalledWith({
        where: { rideId: 'ride-cash-1', driverId: 'driver-1', driverCollected: true },
        data: { isPaid: true },
      });
    });
  });

  describe('GET DRIVER EARNINGS', () => {
    it('should reconcile settled cash debt rows before aggregating summary', async () => {
      mockPrisma.walletTransaction.findMany.mockResolvedValue([{ rideId: 'ride-legacy-1' }, { rideId: null }]);
      mockPrisma.driverEarnings.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.driverEarnings.findMany.mockResolvedValue([]);
      mockPrisma.driverEarnings.count.mockResolvedValue(0);
      mockPrisma.driverEarnings.aggregate
        .mockResolvedValueOnce({ _sum: { grossFare: 0, platformFee: 0, penalty: 0, netEarnings: 0, cashDebt: 0 } })
        .mockResolvedValueOnce({ _sum: { cashDebt: 0 } });

      const result = await paymentService.getDriverEarnings('driver-1');

      expect(mockPrisma.driverEarnings.updateMany).toHaveBeenCalledWith({
        where: {
          driverId: 'driver-1',
          driverCollected: true,
          isPaid: false,
          rideId: { in: ['ride-legacy-1'] },
        },
        data: { isPaid: true },
      });
      expect(result.summary.unpaidCashDebt).toBe(0);
    });
  });

  describe('PROCESS PAYMENT', () => {
    it('should process payment and mark as completed', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'payment-123',
        rideId: 'ride-123',
        status: 'PENDING',
        amount: 50000,
        customerId: 'customer-123',
        driverId: 'driver-456',
      });

      mockPrisma.payment.update.mockResolvedValue({
        id: 'payment-123',
        status: 'COMPLETED',
      });

      await paymentService.processPayment('ride-123');

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'payment-123' },
          data: expect.objectContaining({
            status: 'PROCESSING',
          }),
        })
      );
    });

    it('should throw error if payment not found', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await expect(paymentService.processPayment('ride-123')).rejects.toThrow('Payment not found');
    });
  });

  describe('REFUND PAYMENT', () => {
    it('should refund payment successfully (MOCK provider)', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'payment-123',
        rideId: 'ride-123',
        status: 'COMPLETED',
        amount: 50000,
        customerId: 'customer-123',
        driverId: 'driver-456',
        provider: 'MOCK',
        gatewayResponse: null,
      });

      mockPrisma.payment.update.mockResolvedValue({
        id: 'payment-123',
        status: 'REFUNDED',
      });

      await paymentService.refundPayment('ride-123', 'Customer requested');

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'REFUNDED',
          }),
        })
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'refund.completed',
        expect.any(Object),
        expect.any(String),
      );
    });

    it('should store refundMetadata with RECORDED status when provider is MOCK (MoMo disabled)', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'payment-123',
        rideId: 'ride-123',
        status: 'COMPLETED',
        amount: 75000,
        customerId: 'customer-123',
        driverId: null,
        provider: 'MOCK',
        gatewayResponse: null,
        transactionId: null,
      });

      let capturedGatewayResponse: string | undefined;
      mockPrisma.payment.update.mockImplementation(({ data }: any) => {
        capturedGatewayResponse = data.gatewayResponse;
        return Promise.resolve({ id: 'payment-123', status: 'REFUNDED' });
      });

      await paymentService.refundPayment('ride-123', 'Ride cancelled by customer');

      expect(capturedGatewayResponse).toBeDefined();
      const parsed = JSON.parse(capturedGatewayResponse!);
      expect(parsed.refund).toBeDefined();
      expect(parsed.refund.status).toBe('RECORDED');
      expect(parsed.refund.amount).toBe(75000);
      expect(parsed.refund.description).toBe('Ride cancelled by customer');
    });

    it('should throw error when trying to refund non-COMPLETED payment', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'payment-123',
        rideId: 'ride-123',
        status: 'PENDING',
        amount: 50000,
        customerId: 'customer-123',
        provider: 'MOCK',
      });

      await expect(
        paymentService.refundPayment('ride-123', 'Test')
      ).rejects.toThrow('Can only refund completed payments');
    });

    it('should throw error when payment not found for refund', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await expect(
        paymentService.refundPayment('non-existent-ride', 'Test')
      ).rejects.toThrow('Payment not found');
    });
  });

  describe('GET PAYMENT', () => {
    it('should get payment by ride id', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'payment-123',
        rideId: 'ride-123',
        status: 'COMPLETED',
        gatewayResponse: JSON.stringify({
          refund: {
            requestId: 'refund-123',
            refundOrderId: 'ro-123',
            resultCode: 0,
          },
        }),
      });
      mockPrisma.fare.findUnique.mockResolvedValue(null);

      const result = await paymentService.getPaymentByRideId('ride-123');

      expect(result).toBeDefined();
      expect(result!.id).toBe('payment-123');
      expect(result!.refund).toEqual(
        expect.objectContaining({
          requestId: 'refund-123',
          refundOrderId: 'ro-123',
        })
      );
    });

    it('should get customer payments', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([
        { id: 'payment-1', customerId: 'customer-123' },
        { id: 'payment-2', customerId: 'customer-123' },
      ]);
      mockPrisma.payment.count.mockResolvedValue(2);

      const result = await paymentService.getCustomerPayments('customer-123', 1, 10);

      expect(result.payments).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe('EDGE CASES', () => {
    it('should handle database errors gracefully', async () => {
      mockPrisma.payment.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(paymentService.processPayment('ride-123')).rejects.toThrow('Database error');
    });
  });
});
