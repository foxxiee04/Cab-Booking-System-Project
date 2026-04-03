import { PrismaClient, PaymentStatus, PaymentMethod, PaymentProvider } from '../generated/prisma-client';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { config } from '../config';
import { EventPublisher } from '../events/publisher';
import { logger } from '../utils/logger';
import { momoGateway } from './momo.gateway';
import { paymentGatewayManager, PaymentGatewayType } from './payment-gateway.manager';
import { stripeGateway } from './stripe.gateway';
import { zaloPayGateway } from './zalopay.gateway';
import { commissionService, TripContext, DriverStats } from './commission.service';

interface RideCompletedPayload {
  rideId: string;
  customerId: string;
  driverId: string;
  fare?: number;
  distance?: number;
  duration?: number;
  surgeMultiplier?: number;
  vehicleType?: string; // ECONOMY, COMFORT, PREMIUM
  paymentMethod?: string; // CASH, MOMO, VISA, CARD, WALLET
  /** Optional driver stats forwarded by driver-service for incentive/penalty calc */
  driverStats?: DriverStats;
}

interface CreateExternalPaymentInput {
  orderId: string;
  service: 'BOOKING';
  method: 'MOMO' | 'VNPAY';
  amount: number;
  customerId?: string;
  returnUrl?: string;
  ipnUrl?: string;
  idempotencyKey?: string;
}

export class PaymentService {
  private prisma: PrismaClient;
  private eventPublisher: EventPublisher;

  constructor(prisma: PrismaClient, eventPublisher: EventPublisher) {
    this.prisma = prisma;
    this.eventPublisher = eventPublisher;
  }

  async createExternalPayment(input: CreateExternalPaymentInput): Promise<{ paymentId: string; payUrl: string }> {
    const { orderId, service, method, amount, customerId, returnUrl, ipnUrl, idempotencyKey } = input;

    if (service !== 'BOOKING') {
      throw new Error('Only BOOKING service is supported');
    }

    const intent = await this.createPaymentIntent({
      rideId: orderId,
      customerId: customerId || 'booking-service',
      amount,
      currency: 'VND',
      paymentMethod: method,
      returnUrl,
      notifyUrl: ipnUrl,
      idempotencyKey,
    });

    const payUrl = intent.payUrl || intent.paymentUrl;
    if (!payUrl) {
      throw new Error(`Gateway did not return payUrl for method ${method}`);
    }

    const payment = await this.prisma.payment.findUnique({ where: { rideId: orderId } });
    if (payment) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          metadata: {
            ...(payment.metadata as Record<string, any> || {}),
            serviceName: service,
            orderId,
            method,
          },
        },
      });
    }

    return {
      paymentId: intent.paymentId,
      payUrl,
    };
  }

  async getPaymentById(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      return null;
    }

    const metadata = (payment.metadata as Record<string, any> | null) || {};
    const serviceName = typeof metadata.serviceName === 'string' ? metadata.serviceName : 'BOOKING';

    return {
      id: payment.id,
      order_id: payment.rideId,
      service_name: serviceName,
      method: payment.method,
      amount: payment.amount,
      status: payment.status,
      transaction_id: payment.transactionId,
      raw_response: payment.gatewayResponse,
      created_at: payment.createdAt,
      updated_at: payment.updatedAt,
    };
  }

  async handleStripeWebhook(payload: Buffer | string, signature: string): Promise<void> {
    const event = stripeGateway.constructWebhookEvent(payload, signature);
    const intent = event.data as Record<string, any>;
    const paymentIntentId = String(intent.id || '');

    if (!paymentIntentId) {
      throw new Error('Stripe webhook missing payment intent ID');
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.synchronizePaymentByIntentId({
          paymentIntentId,
          nextStatus: PaymentStatus.COMPLETED,
          transactionId: String(intent.latest_charge || intent.id),
          gatewayMetadata: intent,
        });
        return;
      case 'payment_intent.processing':
        await this.synchronizePaymentByIntentId({
          paymentIntentId,
          nextStatus: PaymentStatus.PROCESSING,
          gatewayMetadata: intent,
        });
        return;
      case 'payment_intent.requires_action':
        await this.synchronizePaymentByIntentId({
          paymentIntentId,
          nextStatus: PaymentStatus.REQUIRES_ACTION,
          gatewayMetadata: intent,
        });
        return;
      case 'payment_intent.payment_failed':
      case 'payment_intent.canceled':
        await this.synchronizePaymentByIntentId({
          paymentIntentId,
          nextStatus: PaymentStatus.FAILED,
          failureReason: String(intent.last_payment_error?.message || intent.cancellation_reason || 'Stripe reported failure'),
          gatewayMetadata: intent,
        });
        return;
      default:
        logger.info(`Ignoring unsupported Stripe webhook event: ${event.type}`);
    }
  }

  async handleMomoWebhook(payload: Record<string, any>): Promise<void> {
    const signature = payload.signature as string | undefined;

    if (config.momo.enabled && signature) {
      const { signature: _, ...data } = payload;
      if (!momoGateway.verifyWebhookSignature(data, signature)) {
        throw new Error('Invalid MoMo webhook signature');
      }
    }

    const rideId = String(payload.orderId || payload.order_id || '');
    if (!rideId) {
      throw new Error('MoMo webhook missing orderId');
    }

    const resultCode = Number(payload.resultCode ?? payload.result_code ?? -1);
    await this.synchronizePaymentByRideId({
      rideId,
      nextStatus: resultCode === 0 ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
      transactionId: payload.transId ? String(payload.transId) : undefined,
      failureReason: resultCode === 0 ? undefined : String(payload.message || 'MoMo reported failure'),
      gatewayMetadata: payload,
    });
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
    returnUrl?: string;
    notifyUrl?: string;
    ipAddress?: string;
    idempotencyKey?: string;
  }) {
    const { rideId, customerId, amount, currency, paymentMethod, returnUrl, notifyUrl, ipAddress, idempotencyKey } = input;
    const normalizedMethod = this.mapPaymentMethod(paymentMethod);
    const providerType = this.resolveGatewayType(normalizedMethod);
    const provider = this.mapPaymentProviderFromGateway(providerType);

    // Idempotency: reuse existing intent for same ride + key
    const existing = await this.prisma.payment.findFirst({
      where: {
        rideId,
        idempotencyKey: idempotencyKey ?? null,
      },
    });

    if (existing) {
      const existingGatewayResponse = this.parseGatewayResponse(existing.gatewayResponse);
      const existingMetadata = existingGatewayResponse?.metadata || {};

      return {
        created: false,
        paymentId: existing.id,
        paymentIntentId: existing.paymentIntentId,
        clientSecret: existing.clientSecret,
        paymentUrl: existingGatewayResponse?.paymentUrl,
        payUrl: existingMetadata.payUrl || existingGatewayResponse?.paymentUrl,
        deeplink: existingMetadata.deeplink,
        qrCodeUrl: existingMetadata.qrCodeUrl,
        metadata: existingMetadata,
        provider: existing.provider,
        status: existing.status,
      };
    }

    if (normalizedMethod === PaymentMethod.CASH) {
      const payment = await this.prisma.payment.create({
        data: {
          rideId,
          customerId,
          amount,
          currency,
          method: PaymentMethod.CASH,
          provider: PaymentProvider.MOCK,
          status: PaymentStatus.PENDING,
          idempotencyKey,
        },
      });

      return {
        created: true,
        paymentId: payment.id,
        status: payment.status,
        provider: payment.provider,
      };
    }

    const gatewayResult = await paymentGatewayManager.createPayment({
      provider: providerType,
      orderId: rideId,
      amount,
      currency,
      description: `Payment for ride ${rideId}`,
      customerId,
      returnUrl,
      notifyUrl,
      ipAddress,
      metadata: {
        rideId,
        customerId,
        paymentMethod: normalizedMethod,
      },
    });

    const payment = await this.prisma.payment.create({
      data: {
        rideId,
        customerId,
        amount,
        currency,
        method: normalizedMethod,
        provider,
        status: PaymentStatus.REQUIRES_ACTION,
        paymentIntentId: gatewayResult.intentId,
        clientSecret: gatewayResult.clientSecret,
        idempotencyKey,
        gatewayResponse: JSON.stringify({
          paymentUrl: gatewayResult.paymentUrl,
          metadata: gatewayResult.metadata || {},
        }),
      },
    });

    await this.eventPublisher.publish('payment.intent.created', {
      rideId,
      customerId,
      paymentIntentId: payment.paymentIntentId,
      amount,
      currency,
      provider: gatewayResult.provider,
    }, rideId);

    return {
      created: true,
      paymentId: payment.id,
      paymentIntentId: payment.paymentIntentId,
      clientSecret: payment.clientSecret,
      paymentUrl: gatewayResult.paymentUrl,
      payUrl: gatewayResult.metadata?.payUrl || gatewayResult.paymentUrl,
      deeplink: gatewayResult.metadata?.deeplink,
      qrCodeUrl: gatewayResult.metadata?.qrCodeUrl,
      metadata: gatewayResult.metadata || {},
      provider: payment.provider,
      status: payment.status,
    };
  }

  async applyGatewayReturnByRideId(input: {
    rideId: string;
    paid: boolean;
    transactionId?: string;
    failureReason?: string;
    gatewayMetadata?: Record<string, any>;
  }): Promise<void> {
    await this.synchronizePaymentByRideId({
      rideId: input.rideId,
      nextStatus: input.paid ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
      transactionId: input.transactionId,
      failureReason: input.failureReason,
      gatewayMetadata: input.gatewayMetadata,
    });
  }

  async processRideCompleted(payload: RideCompletedPayload): Promise<void> {
    const { 
      rideId, 
      customerId, 
      driverId, 
      distance, 
      duration, 
      surgeMultiplier = 1.0, 
      vehicleType = 'ECONOMY',
      paymentMethod = 'CASH',
      driverStats,
    } = payload;

    try {
      // Idempotency check: Check if fare already processed (prevent duplicates)
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

      // Calculate driver commission & earnings
      const now = new Date();
      const tripCtx: TripContext = {
        vehicleType,
        surgeMultiplier,
        paymentMethod,
        completedAt: now,
        driverStats,
      };
      const earnings = commissionService.calculateCommission(fareDetails.totalFare, tripCtx);

      // Generate idempotency key for payment
      const idempotencyKey = `ride_${rideId}_${Date.now()}`;

      // Map payment method string to enum
      const mappedMethod = this.mapPaymentMethod(paymentMethod);
      const mappedProvider = this.mapPaymentProvider(paymentMethod);

      // Create fare, payment, and driver earnings in a single transaction
      const createdPayment = await this.prisma.$transaction(async (tx) => {
        // Create fare record
        await tx.fare.create({
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

        // Create driver earnings record
        await tx.driverEarnings.create({
          data: {
            rideId,
            driverId,
            grossFare:       earnings.grossFare,
            commissionRate:  earnings.commissionRate,
            platformFee:     earnings.platformFee,
            bonus:           earnings.bonus,
            penalty:         earnings.penalty,
            netEarnings:     earnings.netEarnings,
            paymentMethod:   mappedMethod,
            driverCollected: earnings.driverCollected,
            cashDebt:        earnings.cashDebt,
            bonusBreakdown:   earnings.breakdown.bonuses   as any,
            penaltyBreakdown: earnings.breakdown.penalties as any,
          },
        });

        // Create payment record with idempotency key
        const payment = await tx.payment.create({
          data: {
            rideId,
            customerId,
            driverId,
            amount: fareDetails.totalFare,
            currency: 'VND',
            method: mappedMethod,
            provider: mappedProvider,
            status: PaymentStatus.PENDING,
            idempotencyKey, // For deduplication
          },
        });

        // Store outbox event
        await tx.outboxEvent.create({
          data: {
            eventType: 'fare.calculated',
            payload: JSON.stringify({
              rideId,
              customerId,
              driverId,
              fare: fareDetails.totalFare,
              breakdown: fareDetails,
              paymentMethod: mappedMethod,
              earnings: {
                commissionRate:  earnings.commissionRate,
                platformFee:     earnings.platformFee,
                bonus:           earnings.bonus,
                penalty:         earnings.penalty,
                netEarnings:     earnings.netEarnings,
                driverCollected: earnings.driverCollected,
                cashDebt:        earnings.cashDebt,
              },
            }),
            correlationId: rideId,
          },
        });

        logger.info(`Fare + earnings calculated for ride ${rideId}: fare=${fareDetails.totalFare} VND, net=${earnings.netEarnings} VND, platform=${earnings.platformFee} VND (method: ${mappedMethod})`);

        return payment;
      });

      // Process payment asynchronously based on method
      if (mappedMethod === PaymentMethod.CASH) {
        // Cash payment: mark as completed immediately (COD)
        await this.processPaymentRecord(createdPayment);
      } else {
        // Electronic payment (MOMO/VISA): process with gateway mock
        await this.processElectronicPaymentRecord(createdPayment);
      }
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

    await this.processPaymentRecord(payment);
  }

  private async processPaymentRecord(payment: {
    id: string;
    rideId: string;
    customerId: string;
    driverId?: string | null;
    amount: number;
    method: PaymentMethod;
    provider?: PaymentProvider | null;
  }): Promise<void> {
    const { rideId } = payment;

    try {
      // Update to processing
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.PROCESSING },
      });

      // Cash payment - immediate completion (COD), no gateway needed

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
              method: payment.method,
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
        method: payment.method,
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

  /**
   * Process electronic payment (MoMo/Visa) with mock gateway
   * Simulates async payment flow: PENDING → PROCESSING → SUCCESS/FAILED
   */
  async processElectronicPayment(rideId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({ where: { rideId } });
    if (!payment) {
      throw new Error('Payment not found');
    }

    await this.processElectronicPaymentRecord(payment);
  }

  private async processElectronicPaymentRecord(payment: {
    id: string;
    rideId: string;
    customerId: string;
    driverId?: string | null;
    method: PaymentMethod;
    provider: PaymentProvider;
    amount: number;
    currency: string;
  }): Promise<void> {
    const { rideId } = payment;

    try {
      const gatewayType = this.resolveGatewayType(payment.method);

      // Update to processing
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { 
          status: PaymentStatus.PROCESSING,
        },
      });

      logger.info(`Processing ${payment.method} payment for ride ${rideId}`);

      const result = await paymentGatewayManager.createPayment({
        provider: gatewayType,
        orderId: rideId,
        amount: payment.amount,
        currency: payment.currency,
        description: `Payment for ride ${rideId}`,
        customerId: payment.customerId,
        metadata: {
          rideId,
          customerId: payment.customerId,
          paymentId: payment.id,
          paymentMethod: payment.method,
        },
      });

      if (result.success) {
        // Payment succeeded
        await this.prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.COMPLETED,
              completedAt: new Date(),
              transactionId: result.intentId || result.orderId,
              paymentIntentId: result.intentId,
              clientSecret: result.clientSecret,
              gatewayResponse: JSON.stringify({
                paymentUrl: result.paymentUrl,
                metadata: result.metadata || {},
              }),
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
                method: payment.method,
                provider: payment.provider,
                transactionId: result.intentId || result.orderId,
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
          method: payment.method,
          provider: payment.provider,
          transactionId: result.intentId || result.orderId,
        }, payment.rideId);

        logger.info(`${payment.method} payment completed for ride ${rideId} - Transaction: ${result.intentId || result.orderId}`);
      } else {
        // Payment failed
        await this.prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.FAILED,
              failedAt: new Date(),
              failureReason: 'Provider reported failure',
              gatewayResponse: JSON.stringify({
                paymentUrl: result.paymentUrl,
                metadata: result.metadata || {},
              }),
            },
          });

          await tx.outboxEvent.create({
            data: {
              eventType: 'payment.failed',
              payload: JSON.stringify({
                paymentId: payment.id,
                rideId: payment.rideId,
                customerId: payment.customerId,
                method: payment.method,
                provider: payment.provider,
                reason: 'Provider reported failure',
              }),
              correlationId: payment.rideId,
            },
          });
        });

        await this.eventPublisher.publish('payment.failed', {
          paymentId: payment.id,
          rideId: payment.rideId,
          customerId: payment.customerId,
          method: payment.method,
          provider: payment.provider,
          reason: 'Provider reported failure',
        }, payment.rideId);

        logger.warn(`${payment.method} payment failed for ride ${rideId} - Reason: Provider reported failure`);
      }
    } catch (error) {
      // Handle unexpected errors
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            failedAt: new Date(),
            failureReason: error instanceof Error ? error.message : 'Payment processing error',
          },
        });

        await tx.outboxEvent.create({
          data: {
            eventType: 'payment.failed',
            payload: JSON.stringify({
              paymentId: payment.id,
              rideId: payment.rideId,
              customerId: payment.customerId,
              reason: error instanceof Error ? error.message : 'Payment processing error',
            }),
            correlationId: payment.rideId,
          },
        });
      });

      await this.eventPublisher.publish('payment.failed', {
        paymentId: payment.id,
        rideId: payment.rideId,
        customerId: payment.customerId,
        reason: error instanceof Error ? error.message : 'Payment processing error',
      }, payment.rideId);

      logger.error(`Error processing ${payment.method} payment for ride ${rideId}:`, error);
    }
  }

  async getPaymentByRideId(rideId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { rideId },
    });

    if (!payment) {
      return null;
    }

    const fare = await this.prisma.fare.findUnique({ where: { rideId: payment.rideId } });
    return { ...payment, fare };
  }

  async getCustomerPayments(customerId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { customerId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where: { customerId } }),
    ]);

    const fares = await this.prisma.fare.findMany({
      where: { rideId: { in: payments.map((payment) => payment.rideId) } },
    });
    const fareByRideId = new Map(fares.map((fare) => [fare.rideId, fare]));

    return {
      payments: payments.map((payment) => ({ ...payment, fare: fareByRideId.get(payment.rideId) || null })),
      total,
    };
  }

  async getDriverEarnings(driverId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [earningsRows, total, aggregates] = await Promise.all([
      this.prisma.driverEarnings.findMany({
        where: { driverId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.driverEarnings.count({ where: { driverId } }),
      this.prisma.driverEarnings.aggregate({
        where: { driverId },
        _sum: { grossFare: true, platformFee: true, bonus: true, penalty: true, netEarnings: true, cashDebt: true },
      }),
    ]);

    const unpaidCashDebt = await this.prisma.driverEarnings.aggregate({
      where: { driverId, driverCollected: true, isPaid: false },
      _sum: { cashDebt: true },
    });

    return {
      earnings: earningsRows,
      total,
      summary: {
        totalGrossFare:  aggregates._sum.grossFare   || 0,
        totalPlatformFee: aggregates._sum.platformFee || 0,
        totalBonus:      aggregates._sum.bonus       || 0,
        totalPenalty:    aggregates._sum.penalty     || 0,
        totalNetEarnings: aggregates._sum.netEarnings || 0,
        unpaidCashDebt:  unpaidCashDebt._sum.cashDebt || 0,
      },
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

    if (payment.provider === PaymentProvider.STRIPE && payment.paymentIntentId) {
      await paymentGatewayManager.createRefund({
        provider: PaymentGatewayType.STRIPE,
        paymentIntentId: payment.paymentIntentId,
        amount: payment.amount,
        reason,
      });
    }

    if (payment.provider === PaymentProvider.MOMO && payment.transactionId && config.momo.enabled) {
      await momoGateway.createRefund({
        orderId: payment.rideId,
        requestId: `refund_${uuidv4()}`,
        amount: Math.round(payment.amount),
        transId: payment.transactionId,
        description: reason,
      });
    }

    if (payment.provider === PaymentProvider.ZALOPAY && payment.transactionId && config.zalopay.enabled) {
      await zaloPayGateway.createRefund({
        zpTransId: payment.transactionId,
        amount: Math.round(payment.amount),
        description: reason,
        refundId: uuidv4(),
      });
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

  async getAllPayments(page = 1, limit = 20, status?: PaymentStatus) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : undefined;

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { payments, total };
  }

  async getAdminStats() {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalRevenue, todayRevenue, weekRevenue, monthRevenue, pending, completed, failed] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.COMPLETED },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.COMPLETED, createdAt: { gte: startOfDay } },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.COMPLETED, createdAt: { gte: startOfWeek } },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.COMPLETED, createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      this.prisma.payment.count({
        where: { status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING, PaymentStatus.REQUIRES_ACTION] } },
      }),
      this.prisma.payment.count({ where: { status: PaymentStatus.COMPLETED } }),
      this.prisma.payment.count({ where: { status: PaymentStatus.FAILED } }),
    ]);

    return {
      revenue: {
        total: totalRevenue._sum.amount || 0,
        today: todayRevenue._sum.amount || 0,
        week: weekRevenue._sum.amount || 0,
        month: monthRevenue._sum.amount || 0,
      },
      payments: {
        pending,
        completed,
        failed,
      },
    };
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

  /**
   * Map payment method string to PaymentMethod enum
   */
  private mapPaymentMethod(method: string): PaymentMethod {
    const methodUpper = method.toUpperCase();
    switch (methodUpper) {
      case 'CASH':
        return PaymentMethod.CASH;
      case 'MOMO':
        return PaymentMethod.MOMO;
      case 'VNPAY':
        return PaymentMethod.VNPAY;
      case 'VISA':
      case 'CARD':
        return PaymentMethod.VISA;
      case 'WALLET':
        return PaymentMethod.WALLET;
      default:
        logger.warn(`Unknown payment method: ${method}, defaulting to CASH`);
        return PaymentMethod.CASH;
    }
  }

  /**
   * Map payment method to provider
   */
  private mapPaymentProvider(method: string): PaymentProvider {
    const methodUpper = method.toUpperCase();
    switch (methodUpper) {
      case 'MOMO':
        return PaymentProvider.MOMO;
      case 'VNPAY':
        return PaymentProvider.VNPAY;
      case 'VISA':
      case 'CARD':
        return PaymentProvider.VISA;
      default:
        return PaymentProvider.MOCK;
    }
  }

  private resolveGatewayType(method: PaymentMethod): PaymentGatewayType {
    switch (method) {
      case PaymentMethod.MOMO:
        return config.momo.enabled ? PaymentGatewayType.MOMO : PaymentGatewayType.MOCK;
      case PaymentMethod.VNPAY:
        return config.vnpay.enabled ? PaymentGatewayType.VNPAY : PaymentGatewayType.MOCK;
      case PaymentMethod.WALLET:
        if (config.momo.enabled) {
          return PaymentGatewayType.MOMO;
        }
        if (config.zalopay.enabled) {
          return PaymentGatewayType.ZALOPAY;
        }
        return PaymentGatewayType.MOCK;
      case PaymentMethod.VISA:
      case PaymentMethod.CARD:
        return config.stripe.enabled ? PaymentGatewayType.STRIPE : PaymentGatewayType.MOCK;
      case PaymentMethod.CASH:
      default:
        return PaymentGatewayType.MOCK;
    }
  }

  private mapPaymentProviderFromGateway(provider: PaymentGatewayType): PaymentProvider {
    switch (provider) {
      case PaymentGatewayType.STRIPE:
        return PaymentProvider.STRIPE;
      case PaymentGatewayType.MOMO:
        return PaymentProvider.MOMO;
      case PaymentGatewayType.VNPAY:
        return PaymentProvider.VNPAY;
      case PaymentGatewayType.ZALOPAY:
        return PaymentProvider.ZALOPAY;
      case PaymentGatewayType.MOCK:
      default:
        return PaymentProvider.MOCK;
    }
  }

  private parseGatewayResponse(raw: string | null): Record<string, any> | null {
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private async synchronizePaymentByIntentId(input: {
    paymentIntentId: string;
    nextStatus: PaymentStatus;
    transactionId?: string;
    failureReason?: string;
    gatewayMetadata?: Record<string, any>;
  }): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { paymentIntentId: input.paymentIntentId },
    });

    if (!payment) {
      throw new Error('Payment intent not found');
    }

    await this.persistPaymentStatusTransition(payment, input);
  }

  private async synchronizePaymentByRideId(input: {
    rideId: string;
    nextStatus: PaymentStatus;
    transactionId?: string;
    failureReason?: string;
    gatewayMetadata?: Record<string, any>;
  }): Promise<void> {
    const payment = await this.prisma.payment.findUnique({ where: { rideId: input.rideId } });

    if (!payment) {
      throw new Error('Payment not found for ride');
    }

    await this.persistPaymentStatusTransition(payment, input);
  }

  private async persistPaymentStatusTransition(
    payment: {
      id: string;
      rideId: string;
      customerId: string;
      driverId?: string | null;
      amount: number;
      status: PaymentStatus;
    },
    input: {
      nextStatus: PaymentStatus;
      transactionId?: string;
      failureReason?: string;
      gatewayMetadata?: Record<string, any>;
    },
  ): Promise<void> {
    if (payment.status === input.nextStatus) {
      return;
    }

    // Idempotency guard: do not override terminal states once finalized.
    if (
      payment.status === PaymentStatus.COMPLETED ||
      payment.status === PaymentStatus.FAILED ||
      payment.status === PaymentStatus.REFUNDED
    ) {
      return;
    }

    const gatewayResponse = input.gatewayMetadata ? JSON.stringify(input.gatewayMetadata) : undefined;

    if (input.nextStatus === PaymentStatus.COMPLETED) {
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.COMPLETED,
            completedAt: new Date(),
            transactionId: input.transactionId ?? payment.id,
            gatewayResponse,
            failureReason: null,
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
              transactionId: input.transactionId,
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
        transactionId: input.transactionId,
      }, payment.rideId);

      await this.eventPublisher.publish('payment.success', {
        paymentId: payment.id,
        orderId: payment.rideId,
        service: 'BOOKING',
        amount: payment.amount,
        transactionId: input.transactionId,
      }, payment.rideId);

      await this.notifyBookingPaymentCallback({
        orderId: payment.rideId,
        status: 'SUCCESS',
        paymentId: payment.id,
        transactionId: input.transactionId,
      });
      return;
    }

    if (input.nextStatus === PaymentStatus.FAILED) {
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            failedAt: new Date(),
            failureReason: input.failureReason ?? 'Provider reported failure',
            gatewayResponse,
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

      await this.notifyBookingPaymentCallback({
        orderId: payment.rideId,
        status: 'FAILED',
        paymentId: payment.id,
        transactionId: input.transactionId,
        failureReason: input.failureReason,
      });
      return;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: input.nextStatus,
        gatewayResponse,
      },
    });
  }

  private async notifyBookingPaymentCallback(payload: {
    orderId: string;
    status: 'SUCCESS' | 'FAILED';
    paymentId: string;
    transactionId?: string;
    failureReason?: string;
  }): Promise<void> {
    const callbackUrl = config.booking.callbackUrl;
    if (!callbackUrl) {
      return;
    }

    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        await axios.post(callbackUrl, payload, {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json',
          },
        });

        logger.info('Booking callback delivered', {
          orderId: payload.orderId,
          status: payload.status,
          attempt,
        });
        return;
      } catch (error) {
        logger.warn('Booking callback attempt failed', {
          orderId: payload.orderId,
          status: payload.status,
          attempt,
          error: error instanceof Error ? error.message : String(error),
        });

        if (attempt >= maxAttempts) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
  }
}
