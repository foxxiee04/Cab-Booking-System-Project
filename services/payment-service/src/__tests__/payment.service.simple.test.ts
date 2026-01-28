// Mock Prisma before imports
const mockPrisma: any = {
  fare: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  payment: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
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
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    REFUNDED: 'REFUNDED',
  },
  PaymentMethod: {
    CASH: 'CASH',
    CARD: 'CARD',
    E_WALLET: 'E_WALLET',
  },
  PaymentProvider: {
    STRIPE: 'STRIPE',
    MOMO: 'MOMO',
    ZALOPAY: 'ZALOPAY',
  },
}));

jest.mock('../events/publisher');

import { PaymentService } from '../services/payment.service';
import { EventPublisher } from '../events/publisher';

describe('PaymentService - Simple Test Suite', () => {
  let paymentService: PaymentService;
  let mockEventPublisher: jest.Mocked<EventPublisher>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mocks
    mockPrisma.fare.findFirst.mockReset();
    mockPrisma.fare.create.mockReset();
    mockPrisma.payment.findUnique.mockReset();
    mockPrisma.payment.findFirst.mockReset();
    mockPrisma.payment.findMany.mockReset();
    mockPrisma.payment.create.mockReset();
    mockPrisma.payment.update.mockReset();
    mockPrisma.payment.count.mockReset();
    mockPrisma.outboxEvent.create.mockReset();
    mockPrisma.$transaction.mockImplementation((callback: any) => callback(mockPrisma));

    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
      connect: jest.fn(),
      close: jest.fn(),
    } as any;

    paymentService = new PaymentService(mockPrisma as any, mockEventPublisher);
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

      mockPrisma.fare.findFirst.mockResolvedValue(null);
      mockPrisma.fare.create.mockResolvedValue({
        id: 'fare-123',
        rideId: 'ride-123',
        totalFare: 50000,
      });
      mockPrisma.payment.create.mockResolvedValue({
        id: 'payment-123',
        rideId: 'ride-123',
        status: 'PENDING',
      });
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'payment-123',
        rideId: 'ride-123',
        status: 'PENDING',
        amount: 50000,
        customerId: 'customer-123',
        driverId: 'driver-456',
      });
      mockPrisma.outboxEvent.create.mockResolvedValue({});

      await paymentService.processRideCompleted(payload);

      expect(mockPrisma.fare.create).toHaveBeenCalled();
      expect(mockPrisma.payment.create).toHaveBeenCalled();
      expect(mockEventPublisher.publish).toHaveBeenCalled();
    });

    it('should skip if fare already processed', async () => {
      const payload = {
        rideId: 'ride-123',
        customerId: 'customer-123',
        driverId: 'driver-456',
        distance: 5.0,
        duration: 600,
      };

      mockPrisma.fare.findFirst.mockResolvedValue({
        id: 'existing-fare',
        rideId: 'ride-123',
      });

      await paymentService.processRideCompleted(payload);

      expect(mockPrisma.fare.create).not.toHaveBeenCalled();
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
    it('should refund payment successfully', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'payment-123',
        rideId: 'ride-123',
        status: 'COMPLETED',
        amount: 50000,
        customerId: 'customer-123',
        driverId: 'driver-456',
      });

      mockPrisma.payment.update.mockResolvedValue({
        id: 'payment-123',
        status: 'REFUNDED',
      });

      await paymentService.refundPayment('payment-123', 'Customer requested');

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
        expect.any(String)
      );
    });
  });

  describe('GET PAYMENT', () => {
    it('should get payment by ride id', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'payment-123',
        rideId: 'ride-123',
        status: 'COMPLETED',
      });

      const result = await paymentService.getPaymentByRideId('ride-123');

      expect(result).toBeDefined();
      expect(result!.id).toBe('payment-123');
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
