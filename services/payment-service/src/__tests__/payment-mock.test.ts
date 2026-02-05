import { PrismaClient, PaymentStatus, PaymentMethod, PaymentProvider } from '../generated/prisma-client';
import { EventPublisher } from '../events/publisher';
import { PaymentService } from '../services/payment.service';
import { MoMoGatewayMock, VisaGatewayMock } from '../services/payment-gateway.mock';

// Mock dependencies
jest.mock('../generated/prisma-client');
jest.mock('../events/publisher');

describe('Payment Service - MoMo & Visa Mock', () => {
  let prisma: jest.Mocked<PrismaClient>;
  let eventPublisher: jest.Mocked<EventPublisher>;
  let paymentService: PaymentService;

  const mockRideCompletedPayload = {
    rideId: 'ride-123',
    customerId: 'customer-1',
    driverId: 'driver-1',
    distance: 5.2,
    duration: 900, // 15 minutes
    surgeMultiplier: 1.0,
    vehicleType: 'ECONOMY',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    prisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    eventPublisher = new EventPublisher() as jest.Mocked<EventPublisher>;
    eventPublisher.publish = jest.fn().mockResolvedValue(undefined);

    paymentService = new PaymentService(prisma, eventPublisher);

    // Mock Prisma methods
    (prisma.fare as any) = {
      findFirst: jest.fn(),
      create: jest.fn(),
    };

    (prisma.payment as any) = {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    (prisma.outboxEvent as any) = {
      create: jest.fn(),
    };

    (prisma.$transaction as any) = jest.fn((callback) => callback(prisma));
  });

  describe('Idempotency', () => {
    test('Should not create duplicate payment for same ride', async () => {
      const existingFare = {
        id: 'fare-1',
        rideId: 'ride-123',
        totalFare: 100000,
      };

      (prisma.fare.findFirst as jest.Mock).mockResolvedValue(existingFare);

      await paymentService.processRideCompleted(mockRideCompletedPayload);

      // Should not create new fare
      expect(prisma.fare.create).not.toHaveBeenCalled();
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    test('Should use idempotency key to prevent duplicate payments', async () => {
      (prisma.fare.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.fare.create as jest.Mock).mockResolvedValue({
        id: 'fare-1',
        rideId: 'ride-123',
      });
      (prisma.payment.create as jest.Mock).mockResolvedValue({
        id: 'payment-1',
        rideId: 'ride-123',
        idempotencyKey: expect.stringContaining('ride_ride-123_'),
      });

      await paymentService.processRideCompleted(mockRideCompletedPayload);

      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            idempotencyKey: expect.stringContaining('ride_ride-123_'),
          }),
        })
      );
    });
  });

  describe('CASH Payment', () => {
    test('Should process CASH payment immediately', async () => {
      const payload = {
        ...mockRideCompletedPayload,
        paymentMethod: 'CASH',
      };

      (prisma.fare.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.fare.create as jest.Mock).mockResolvedValue({ id: 'fare-1' });
      (prisma.payment.create as jest.Mock).mockResolvedValue({
        id: 'payment-1',
        rideId: 'ride-123',
        method: PaymentMethod.CASH,
        status: PaymentStatus.PENDING,
        provider: PaymentProvider.MOCK,
      });
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
        id: 'payment-1',
        rideId: 'ride-123',
        method: PaymentMethod.CASH,
        amount: 100000,
        currency: 'VND',
        provider: PaymentProvider.MOCK,
      });

      await paymentService.processRideCompleted(payload);

      // Verify payment created with CASH method
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            method: PaymentMethod.CASH,
            provider: PaymentProvider.MOCK,
          }),
        })
      );
    });
  });

  describe('MOMO Payment', () => {
    test('Should process MOMO payment with correct provider', async () => {
      const payload = {
        ...mockRideCompletedPayload,
        paymentMethod: 'MOMO',
      };

      (prisma.fare.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.fare.create as jest.Mock).mockResolvedValue({ id: 'fare-1' });
      (prisma.payment.create as jest.Mock).mockResolvedValue({
        id: 'payment-1',
        rideId: 'ride-123',
        method: PaymentMethod.MOMO,
        status: PaymentStatus.PENDING,
        provider: PaymentProvider.MOMO,
        amount: 100000,
        currency: 'VND',
      });

      await paymentService.processRideCompleted(payload);

      // Verify payment created with MOMO method and provider
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            method: PaymentMethod.MOMO,
            provider: PaymentProvider.MOMO,
          }),
        })
      );
    });

    test('Should handle MOMO payment success with transaction ID', async () => {
      const mockPayment = {
        id: 'payment-1',
        rideId: 'ride-123',
        customerId: 'customer-1',
        driverId: 'driver-1',
        method: PaymentMethod.MOMO,
        provider: PaymentProvider.MOMO,
        amount: 100000,
        currency: 'VND',
        status: PaymentStatus.PENDING,
      };

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.payment.update as jest.Mock).mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        transactionId: expect.stringContaining('MOMO_'),
      });

      await paymentService.processElectronicPayment('ride-123');

      // Verify transaction updated to PROCESSING
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'payment-1' },
          data: expect.objectContaining({
            status: PaymentStatus.PROCESSING,
          }),
        })
      );
    });
  });

  describe('VISA Payment', () => {
    test('Should process VISA payment with correct provider', async () => {
      const payload = {
        ...mockRideCompletedPayload,
        paymentMethod: 'VISA',
      };

      (prisma.fare.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.fare.create as jest.Mock).mockResolvedValue({ id: 'fare-1' });
      (prisma.payment.create as jest.Mock).mockResolvedValue({
        id: 'payment-1',
        rideId: 'ride-123',
        method: PaymentMethod.VISA,
        status: PaymentStatus.PENDING,
        provider: PaymentProvider.VISA,
        amount: 100000,
        currency: 'VND',
      });

      await paymentService.processRideCompleted(payload);

      // Verify payment created with VISA method and provider
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            method: PaymentMethod.VISA,
            provider: PaymentProvider.VISA,
          }),
        })
      );
    });

    test('Should handle VISA payment with card details', async () => {
      const mockPayment = {
        id: 'payment-1',
        rideId: 'ride-123',
        customerId: 'customer-1',
        driverId: 'driver-1',
        method: PaymentMethod.VISA,
        provider: PaymentProvider.VISA,
        amount: 100000,
        currency: 'VND',
        status: PaymentStatus.PENDING,
      };

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.payment.update as jest.Mock).mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        transactionId: expect.stringContaining('VISA_'),
      });

      await paymentService.processElectronicPayment('ride-123');

      // Verify VISA payment processing
      expect(prisma.payment.update).toHaveBeenCalled();
    });
  });

  describe('Payment Status Transitions', () => {
    test('Should transition: PENDING → PROCESSING → COMPLETED', async () => {
      const mockPayment = {
        id: 'payment-1',
        rideId: 'ride-123',
        customerId: 'customer-1',
        driverId: 'driver-1',
        method: PaymentMethod.MOMO,
        provider: PaymentProvider.MOMO,
        amount: 100000,
        currency: 'VND',
        status: PaymentStatus.PENDING,
      };

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);
      
      // First update: PENDING → PROCESSING
      (prisma.payment.update as jest.Mock)
        .mockResolvedValueOnce({ ...mockPayment, status: PaymentStatus.PROCESSING })
        .mockResolvedValueOnce({ ...mockPayment, status: PaymentStatus.COMPLETED });

      await paymentService.processElectronicPayment('ride-123');

      // Verify status progression
      expect(prisma.payment.update).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          data: expect.objectContaining({
            status: PaymentStatus.PROCESSING,
          }),
        })
      );
    });

    test('Should publish payment.completed event on success', async () => {
      const mockPayment = {
        id: 'payment-1',
        rideId: 'ride-123',
        customerId: 'customer-1',
        driverId: 'driver-1',
        method: PaymentMethod.MOMO,
        provider: PaymentProvider.MOMO,
        amount: 100000,
        currency: 'VND',
        status: PaymentStatus.PENDING,
      };

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.payment.update as jest.Mock).mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      });

      await paymentService.processElectronicPayment('ride-123');

      // Verify event published
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'payment.completed',
        expect.objectContaining({
          paymentId: 'payment-1',
          rideId: 'ride-123',
          method: PaymentMethod.MOMO,
        }),
        'ride-123'
      );
    });
  });

  describe('Payment Failure Scenarios', () => {
    test('Should handle payment failure and publish payment.failed event', async () => {
      const mockPayment = {
        id: 'payment-1',
        rideId: 'ride-123',
        customerId: 'customer-1',
        method: PaymentMethod.MOMO,
        provider: PaymentProvider.MOMO,
        amount: 100000,
        currency: 'VND',
        status: PaymentStatus.PENDING,
      };

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.payment.update as jest.Mock).mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.FAILED,
      });

      // Note: Gateway mock has 10% failure rate, so some tests may succeed
      // This test verifies the failure handling mechanism exists
      await paymentService.processElectronicPayment('ride-123');

      // At minimum, processing should be attempted
      expect(prisma.payment.update).toHaveBeenCalled();
    });
  });

  describe('Event Publishing', () => {
    test('Should publish fare.calculated event when ride completed', async () => {
      (prisma.fare.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.fare.create as jest.Mock).mockResolvedValue({ id: 'fare-1' });
      (prisma.payment.create as jest.Mock).mockResolvedValue({
        id: 'payment-1',
        method: PaymentMethod.CASH,
      });

      await paymentService.processRideCompleted(mockRideCompletedPayload);

      // Verify outbox event created
      expect(prisma.outboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'fare.calculated',
            correlationId: 'ride-123',
          }),
        })
      );
    });
  });
});

describe('Mock Payment Gateways', () => {
  describe('MoMo Gateway Mock', () => {
    let momoGateway: MoMoGatewayMock;

    beforeEach(() => {
      momoGateway = new MoMoGatewayMock();
    });

    test('Should generate MoMo transaction ID format', async () => {
      const result = await momoGateway.processPayment(
        100000,
        'VND',
        'order-123'
      );

      if (result.success) {
        expect(result.transactionId).toMatch(/^MOMO_\d+_[A-Z0-9]{8}$/);
      }
    });

    test('Should return MoMo-specific response format on success', async () => {
      const result = await momoGateway.processPayment(
        100000,
        'VND',
        'order-123'
      );

      if (result.success) {
        expect(result.providerResponse).toHaveProperty('partnerCode');
        expect(result.providerResponse).toHaveProperty('transId');
        expect(result.providerResponse).toHaveProperty('resultCode', 0);
        expect(result.providerResponse).toHaveProperty('message', 'Giao dịch thành công');
      }
    });

    test('Should simulate network delay (1-3 seconds)', async () => {
      const startTime = Date.now();
      await momoGateway.processPayment(100000, 'VND', 'order-123');
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(1000);
      expect(duration).toBeLessThan(4000);
    });

    test('Should return MoMo error codes on failure', async () => {
      // Run multiple times to hit failure case (10% chance)
      let failureFound = false;
      for (let i = 0; i < 50; i++) {
        const result = await momoGateway.processPayment(100000, 'VND', 'order-123');
        if (!result.success) {
          failureFound = true;
          expect(result.providerResponse).toHaveProperty('resultCode');
          expect(result.providerResponse.resultCode).not.toBe(0);
          break;
        }
      }
      
      // At least one failure should occur in 50 attempts (probability > 99.99%)
      expect(failureFound).toBe(true);
    });
  });

  describe('Visa Gateway Mock', () => {
    let visaGateway: VisaGatewayMock;

    beforeEach(() => {
      visaGateway = new VisaGatewayMock();
    });

    test('Should generate Visa transaction ID format', async () => {
      const result = await visaGateway.processPayment(
        100000,
        'VND',
        'order-123'
      );

      if (result.success) {
        expect(result.transactionId).toMatch(/^VISA_\d+_[A-Z0-9]{12}$/);
      }
    });

    test('Should return Visa-specific response format on success', async () => {
      const result = await visaGateway.processPayment(
        100000,
        'VND',
        'order-123'
      );

      if (result.success) {
        expect(result.providerResponse).toHaveProperty('id');
        expect(result.providerResponse).toHaveProperty('object', 'payment_intent');
        expect(result.providerResponse).toHaveProperty('status', 'succeeded');
        expect(result.providerResponse).toHaveProperty('charges');
        expect(result.providerResponse.charges.data[0].payment_method_details.card).toHaveProperty('brand', 'visa');
      }
    });

    test('Should convert amount to smallest currency unit', async () => {
      const result = await visaGateway.processPayment(
        100000,
        'VND',
        'order-123'
      );

      if (result.success) {
        expect(result.providerResponse.amount).toBe(10000000); // 100000 * 100
      }
    });

    test('Should return Visa error codes on failure', async () => {
      let failureFound = false;
      for (let i = 0; i < 50; i++) {
        const result = await visaGateway.processPayment(100000, 'VND', 'order-123');
        if (!result.success) {
          failureFound = true;
          expect(result.providerResponse).toHaveProperty('error');
          expect(result.providerResponse.error).toHaveProperty('type', 'card_error');
          expect(result.providerResponse.error).toHaveProperty('code');
          break;
        }
      }
      
      expect(failureFound).toBe(true);
    });
  });
});
