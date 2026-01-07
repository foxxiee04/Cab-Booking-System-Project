import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { PaymentService } from '../../services/payment.service';

jest.mock('uuid', () => ({
  v4: () => 'uuid-fixed-001',
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

type PrismaClientLike = {
  $transaction: jest.Mock;
  payment: {
    findUnique: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    aggregate: jest.Mock;
  };
  fare: {
    create: jest.Mock;
  };
  outboxEvent: {
    create: jest.Mock;
  };
};

describe('PaymentService (Application/use-case)', () => {
  let prisma: PrismaClientLike;
  let eventPublisher: { publish: jest.Mock };
  let service: PaymentService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      payment: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      fare: {
        create: jest.fn(),
      },
      outboxEvent: {
        create: jest.fn(),
      },
    };

    eventPublisher = {
      publish: jest.fn(),
    };

    service = new PaymentService(prisma as any, eventPublisher as any);
    jest.clearAllMocks();
  });

  describe('processRideCompleted', () => {
    it('creates Fare + Payment in a transaction then triggers processPayment', async () => {
      const processPaymentSpy = jest
        .spyOn(service as any, 'processPayment')
        .mockResolvedValue(undefined);

      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          fare: { create: prisma.fare.create },
          payment: { create: jest.fn().mockResolvedValue({ id: 'pay-1', rideId: 'ride-1' }) },
          outboxEvent: { create: prisma.outboxEvent.create },
        };
        return callback(tx);
      });

      await service.processRideCompleted({
        rideId: 'ride-1',
        customerId: 'cust-1',
        driverId: 'drv-1',
        distance: 3.2,
        duration: 600, // seconds
        surgeMultiplier: 1.5,
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);

      expect(prisma.fare.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rideId: 'ride-1',
            currency: 'VND',
            surgeMultiplier: 1.5,
          }),
        })
      );

      expect(prisma.outboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'fare.calculated',
            correlationId: 'ride-1',
          }),
        })
      );

      expect(processPaymentSpy).toHaveBeenCalledWith('ride-1');
    });
  });

  describe('processPayment', () => {
    it('marks payment PROCESSING then COMPLETED and publishes payment.completed', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        rideId: 'ride-1',
        customerId: 'cust-1',
        driverId: 'drv-1',
        amount: 50000,
      });

      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          payment: { update: jest.fn() },
          outboxEvent: { create: prisma.outboxEvent.create },
        };
        await callback(tx);
      });

      jest.spyOn(service as any, 'mockPaymentGateway').mockResolvedValue(undefined);

      await service.processPayment('ride-1');

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: { status: PaymentStatus.PROCESSING },
      });

      expect(prisma.outboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'payment.completed',
            correlationId: 'ride-1',
          }),
        })
      );

      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'payment.completed',
        expect.objectContaining({
          paymentId: 'pay-1',
          rideId: 'ride-1',
          amount: 50000,
        }),
        'ride-1'
      );
    });

    it('marks payment FAILED and publishes payment.failed when gateway throws', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        rideId: 'ride-1',
        customerId: 'cust-1',
        driverId: 'drv-1',
        amount: 50000,
      });

      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          payment: { update: jest.fn() },
          outboxEvent: { create: prisma.outboxEvent.create },
        };
        await callback(tx);
      });

      jest.spyOn(service as any, 'mockPaymentGateway').mockRejectedValue(new Error('timeout'));

      await service.processPayment('ride-1');

      expect(prisma.outboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'payment.failed',
            correlationId: 'ride-1',
          }),
        })
      );

      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'payment.failed',
        expect.objectContaining({
          paymentId: 'pay-1',
          rideId: 'ride-1',
          customerId: 'cust-1',
        }),
        'ride-1'
      );
    });
  });
});
