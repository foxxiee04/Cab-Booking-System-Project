import { PrismaClient, PaymentStatus, PaymentMethod, PaymentProvider } from '../generated/prisma-client';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { EventPublisher } from '../events/publisher';
import { logger } from '../utils/logger';

interface RideCompletedPayload {
  rideId: string;
  customerId: string;
  driverId: string;
  fare?: number;
  distance?: number;
  duration?: number;
  surgeMultiplier?: number;
  vehicleType?: string; // ECONOMY, COMFORT, PREMIUM
}

export class PaymentService {
  private prisma: PrismaClient;
  private eventPublisher: EventPublisher;

  constructor(prisma: PrismaClient, eventPublisher: EventPublisher) {
    this.prisma = prisma;
    this.eventPublisher = eventPublisher;
  }

  async handleMockWebhook(input: {
    paymentIntentId: string;
    status: string;
    transactionId?: string;
    failureReason?: string;
  }): Promise<void> {
    const payment = await this.prisma.payment.findFirst({ where: { paymentIntentId: input.paymentIntentId } });
    if (!payment) {
      throw new Error('Payment intent not found');
    }

    const normalizedStatus = input.status.toUpperCase();

    if (normalizedStatus === 'SUCCEEDED') {
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.COMPLETED,
            completedAt: new Date(),
            transactionId: input.transactionId ?? uuidv4(),
          },
        });

        await tx.outboxEvent.create({
          data: {
            eventType: 'payment.completed',
            payload: JSON.stringify({
              paymentId: payment.id,
              rideId: payment.rideId,
              customerId: payment.customerId,
              driverId: payment.driverId,
              amount: payment.amount,
            }),
            correlationId: payment.rideId,
          },
        });
      });

      await this.eventPublisher.publish('payment.completed', {
        paymentId: payment.id,
        rideId: payment.rideId,
        customerId: payment.customerId,
        driverId: payment.driverId,
        amount: payment.amount,
      }, payment.rideId);
    } else if (normalizedStatus === 'REQUIRES_ACTION') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.REQUIRES_ACTION },
      });
    } else {
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            failedAt: new Date(),
            failureReason: input.failureReason ?? 'Provider reported failure',
          },
        });

        await tx.outboxEvent.create({
          data: {
            eventType: 'payment.failed',
            payload: JSON.stringify({
              paymentId: payment.id,
              rideId: payment.rideId,
              customerId: payment.customerId,
              reason: input.failureReason ?? 'Provider reported failure',
            }),
            correlationId: payment.rideId,
          },
        });
      });

      await this.eventPublisher.publish('payment.failed', {
        paymentId: payment.id,
        rideId: payment.rideId,
        customerId: payment.customerId,
        reason: input.failureReason ?? 'Provider reported failure',
      }, payment.rideId);
    }
  }

  async createPaymentIntent(input: {
    rideId: string;
    customerId: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    idempotencyKey?: string;
  }) {
    const { rideId, customerId, amount, currency, paymentMethod, idempotencyKey } = input;

    // Idempotency: reuse existing intent for same ride + key
    const existing = await this.prisma.payment.findFirst({
      where: {
        rideId,
        idempotencyKey: idempotencyKey ?? null,
      },
    });

    if (existing) {
      return { created: false, paymentIntentId: existing.paymentIntentId, clientSecret: existing.clientSecret, status: existing.status };
    }

    const paymentIntentId = `pi_${uuidv4()}`;
    const clientSecret = `cs_${uuidv4()}`;

    const payment = await this.prisma.payment.create({
      data: {
        rideId,
        customerId,
        amount,
        currency,
        method: paymentMethod === 'CASH' ? PaymentMethod.CASH : PaymentMethod.CARD,
        provider: PaymentProvider.MOCK,
        status: PaymentStatus.REQUIRES_ACTION,
        paymentIntentId,
        clientSecret,
        idempotencyKey,
      },
    });

    await this.eventPublisher.publish('payment.intent.created', {
      rideId,
      customerId,
      paymentIntentId,
      amount,
      currency,
      provider: payment.provider,
    }, rideId);

    return { created: true, paymentIntentId: payment.paymentIntentId, clientSecret: payment.clientSecret, status: payment.status };
  }

  async processRideCompleted(payload: RideCompletedPayload): Promise<void> {
    const { rideId, customerId, driverId, distance, duration, surgeMultiplier = 1.0, vehicleType = 'ECONOMY' } = payload;

    try {
      // Check if fare already processed (prevent duplicates)
      const existingFare = await this.prisma.fare.findFirst({
        where: { rideId }
      });

      if (existingFare) {
        logger.warn(`Fare already processed for ride ${rideId}, skipping duplicate`);
        return;
      }

      // Calculate fare with vehicle type
      const fareDetails = this.calculateFare(
        distance || 0,
        duration || 0,
        surgeMultiplier,
        vehicleType
      );

      // Create fare and payment in transaction
      await this.prisma.$transaction(async (tx) => {
        // Create fare record
        const fare = await tx.fare.create({
          data: {
            rideId,
            baseFare: fareDetails.baseFare,
            distanceFare: fareDetails.distanceFare,
            timeFare: fareDetails.timeFare,
            surgeMultiplier,
            totalFare: fareDetails.totalFare,
            distanceKm: distance || 0,
            durationMinutes: Math.ceil((duration || 0) / 60),
            currency: 'VND',
          },
        });

        // Create payment record
        const payment = await tx.payment.create({
          data: {
            rideId,
            customerId,
            driverId,
            amount: fareDetails.totalFare,
            currency: 'VND',
            method: PaymentMethod.CASH, // default
            status: PaymentStatus.PENDING,
          },
        });

        // Store outbox event
        await tx.outboxEvent.create({
          data: {
            eventType: 'fare.calculated',
            payload: JSON.stringify({
              rideId,
              customerId,
              fare: fareDetails.totalFare,
              breakdown: fareDetails,
            }),
            correlationId: rideId,
          },
        });

        logger.info(`Fare calculated for ride ${rideId}: ${fareDetails.totalFare} VND`);
      });

      // Process payment (mock)
      await this.processPayment(rideId);
    } catch (error) {
      logger.error(`Error processing ride completed for ${rideId}:`, error);
      throw error;
    }
  }

  async processPayment(rideId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({ where: { rideId } });
    if (!payment) {
      throw new Error('Payment not found');
    }

    try {
      // Update to processing
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.PROCESSING },
      });

      // Simulate payment processing (mock gateway)
      await this.mockPaymentGateway(payment.amount);

      // Mark as completed
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.COMPLETED,
            completedAt: new Date(),
            transactionId: uuidv4(),
            provider: payment.provider ?? PaymentProvider.MOCK,
          },
        });

        // Store outbox event
        await tx.outboxEvent.create({
          data: {
            eventType: 'payment.completed',
            payload: JSON.stringify({
              paymentId: payment.id,
              rideId: payment.rideId,
              customerId: payment.customerId,
              driverId: payment.driverId,
              amount: payment.amount,
            }),
            correlationId: payment.rideId,
          },
        });
      });

      // Publish event
      await this.eventPublisher.publish('payment.completed', {
        paymentId: payment.id,
        rideId: payment.rideId,
        customerId: payment.customerId,
        driverId: payment.driverId,
        amount: payment.amount,
      }, payment.rideId);

      logger.info(`Payment completed for ride ${rideId}`);
    } catch (error) {
      // Mark as failed
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            failedAt: new Date(),
            failureReason: error instanceof Error ? error.message : 'Unknown error',
          },
        });

        await tx.outboxEvent.create({
          data: {
            eventType: 'payment.failed',
            payload: JSON.stringify({
              paymentId: payment.id,
              rideId: payment.rideId,
              customerId: payment.customerId,
              reason: error instanceof Error ? error.message : 'Unknown error',
            }),
            correlationId: payment.rideId,
          },
        });
      });

      await this.eventPublisher.publish('payment.failed', {
        paymentId: payment.id,
        rideId: payment.rideId,
        customerId: payment.customerId,
        reason: error instanceof Error ? error.message : 'Unknown error',
      }, payment.rideId);

      logger.error(`Payment failed for ride ${rideId}:`, error);
    }
  }

  async getPaymentByRideId(rideId: string) {
    return this.prisma.payment.findUnique({
      where: { rideId },
      include: { fare: true },
    });
  }

  async getCustomerPayments(customerId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { customerId },
        include: { fare: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where: { customerId } }),
    ]);
    return { payments, total };
  }

  async getDriverEarnings(driverId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [payments, total, totalEarnings] = await Promise.all([
      this.prisma.payment.findMany({
        where: { driverId, status: PaymentStatus.COMPLETED },
        include: { fare: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where: { driverId, status: PaymentStatus.COMPLETED } }),
      this.prisma.payment.aggregate({
        where: { driverId, status: PaymentStatus.COMPLETED },
        _sum: { amount: true },
      }),
    ]);
    return { 
      payments, 
      total, 
      totalEarnings: totalEarnings._sum.amount || 0 
    };
  }

  async refundPayment(rideId: string, reason: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({ where: { rideId } });
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new Error('Can only refund completed payments');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.REFUNDED,
          refundedAt: new Date(),
          gatewayResponse: reason,
        },
      });

      await tx.outboxEvent.create({
        data: {
          eventType: 'refund.completed',
          payload: JSON.stringify({
            paymentId: payment.id,
            rideId: payment.rideId,
            customerId: payment.customerId,
            amount: payment.amount,
            reason,
          }),
          correlationId: payment.rideId,
        },
      });
    });

    await this.eventPublisher.publish('refund.completed', {
      paymentId: payment.id,
      rideId: payment.rideId,
      customerId: payment.customerId,
      amount: payment.amount,
      reason,
    }, payment.rideId);

    logger.info(`Refund completed for ride ${rideId}`);
  }

  private calculateFare(
    distanceKm: number, 
    durationSeconds: number, 
    surgeMultiplier: number, 
    vehicleType: string = 'ECONOMY'
  ) {
    // Vehicle type pricing
    let baseFare: number;
    let perKmRate: number;
    
    switch (vehicleType.toUpperCase()) {
      case 'COMFORT':
        baseFare = 25000;  // 25k base for COMFORT
        perKmRate = 18000;  // 18k per km
        break;
      case 'PREMIUM':
        baseFare = 35000;  // 35k base for PREMIUM
        perKmRate = 25000;  // 25k per km
        break;
      case 'ECONOMY':
      default:
        baseFare = 15000;  // 15k base for ECONOMY
        perKmRate = 12000;  // 12k per km
        break;
    }
    
    const perMinuteRate = 500; // 500 VND per minute (all vehicle types)
    
    const distanceFare = distanceKm * perKmRate;
    const timeFare = (durationSeconds / 60) * perMinuteRate;
    const subtotal = baseFare + distanceFare + timeFare;
    const totalFare = Math.round(subtotal * surgeMultiplier);

    return {
      baseFare,
      distanceFare: Math.round(distanceFare),
      timeFare: Math.round(timeFare),
      surgeMultiplier,
      totalFare,
      vehicleType,
    };
  }

  private async mockPaymentGateway(amount: number): Promise<void> {
    // Simulate payment gateway processing
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));
    
    // Simulate 5% failure rate
    if (Math.random() < 0.05) {
      throw new Error('Payment gateway timeout');
    }
  }
}
