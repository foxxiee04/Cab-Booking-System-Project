import { PrismaClient, PaymentStatus, PaymentMethod, PaymentProvider, WalletTransactionType } from '../generated/prisma-client';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { config } from '../config';
import { EventPublisher } from '../events/publisher';
import { logger } from '../utils/logger';
import { momoGateway } from './momo.gateway';
import { paymentGatewayManager, PaymentGatewayType } from './payment-gateway.manager';
import { commissionService, TripContext, DriverStats } from './commission.service';
import { WalletService } from './wallet.service';
import { IncentiveService } from './incentive.service';
import { VoucherService } from './voucher.service';
import { resolveDriverUserId } from '../utils/resolve-driver-id';

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
  /** Optional voucher code applied by the customer */
  voucherCode?: string;
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
  private walletService: WalletService;
  private incentiveService: IncentiveService;
  private voucherService: VoucherService;

  constructor(prisma: PrismaClient, eventPublisher: EventPublisher) {
    this.prisma = prisma;
    this.eventPublisher = eventPublisher;
    this.walletService = new WalletService(prisma);
    this.incentiveService = new IncentiveService(prisma, this.walletService);
    this.voucherService = new VoucherService(prisma);
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
      voucherCode,
    } = payload;

    try {
      // Idempotency snapshot: the same ride.completed event may be delivered multiple times.
      const [existingFare, existingPayment, existingDriverEarnings] = await Promise.all([
        this.prisma.fare.findUnique({ where: { rideId } }),
        this.prisma.payment.findUnique({ where: { rideId } }),
        this.prisma.driverEarnings.findUnique({ where: { rideId } }),
      ]);

      if (existingFare && existingPayment && existingDriverEarnings) {
        logger.warn(`Ride ${rideId} already processed, skipping duplicate ride.completed`);
        return;
      }

      // Use the fare already calculated by pricing-service when available.
      // Fall back to calculateFare() only if the event didn't include it.
      const fareDetails = payload.fare && payload.fare > 0
        ? {
            baseFare:        0,
            distanceFare:    0,
            timeFare:        0,
            surgeMultiplier,
            totalFare:       payload.fare,
            vehicleType,
          }
        : this.calculateFare(distance || 0, duration || 0, surgeMultiplier, vehicleType);

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

      // Apply voucher discount (discount absorbs cost, driver unaffected)
      let discountAmount = 0;
      let voucherId: string | null = null;
      if (voucherCode) {
        try {
          const voucherResult = await this.voucherService.applyVoucher(
            customerId,
            voucherCode,
            fareDetails.totalFare,
          );
          discountAmount = voucherResult.discountAmount;
          voucherId = voucherResult.voucherId;
        } catch (voucherError) {
          // Non-critical: log but continue without discount
          logger.warn(`Voucher apply failed for ride ${rideId}:`, voucherError);
        }
      }
      const finalAmount = fareDetails.totalFare - discountAmount;

      // Generate idempotency key for payment
      const idempotencyKey = `ride_${rideId}_${Date.now()}`;

      // Map payment method string to enum
      const mappedMethod = this.mapPaymentMethod(paymentMethod);
      const mappedProvider = this.mapPaymentProvider(paymentMethod);

      // Upsert fare, payment, and driver earnings in a single transaction for idempotency safety.
      const createdPayment = await this.prisma.$transaction(async (tx) => {
        // Upsert fare record
        await tx.fare.upsert({
          where: { rideId },
          update: {
            baseFare: fareDetails.baseFare,
            distanceFare: fareDetails.distanceFare,
            timeFare: fareDetails.timeFare,
            surgeMultiplier,
            totalFare: fareDetails.totalFare,
            distanceKm: distance || 0,
            durationMinutes: Math.ceil((duration || 0) / 60),
            currency: 'VND',
          },
          create: {
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

        // Upsert driver earnings record
        await tx.driverEarnings.upsert({
          where: { rideId },
          update: {
            driverId,
            grossFare: earnings.grossFare,
            commissionRate: earnings.commissionRate,
            platformFee: earnings.platformFee,
            bonus: earnings.bonus,
            penalty: earnings.penalty,
            netEarnings: earnings.netEarnings,
            paymentMethod: mappedMethod,
            driverCollected: earnings.driverCollected,
            cashDebt: earnings.cashDebt,
            isPaid: !earnings.driverCollected || earnings.cashDebt === 0,
            bonusBreakdown: earnings.breakdown.bonuses as any,
            penaltyBreakdown: earnings.breakdown.penalties as any,
          },
          create: {
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
            isPaid:          !earnings.driverCollected || earnings.cashDebt === 0,
            bonusBreakdown:   earnings.breakdown.bonuses   as any,
            penaltyBreakdown: earnings.breakdown.penalties as any,
          },
        });

        // Upsert payment record. Do not overwrite status for existing records.
        const payment = await tx.payment.upsert({
          where: { rideId },
          update: {
            customerId,
            driverId,
            amount: fareDetails.totalFare,
            currency: 'VND',
            method: mappedMethod,
            provider: mappedProvider,
            discountAmount,
            finalAmount,
            voucherId,
          },
          create: {
            rideId,
            customerId,
            driverId,
            amount: fareDetails.totalFare,
            currency: 'VND',
            method: mappedMethod,
            provider: mappedProvider,
            status: PaymentStatus.PENDING,
            idempotencyKey,
            discountAmount,
            finalAmount,
            voucherId,
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

      // Redeem voucher now that payment record is created
      if (voucherId && voucherCode) {
        try {
          await this.voucherService.redeemVoucher(customerId, voucherId);
        } catch (voucherError) {
          logger.error(`Voucher redemption failed for ride ${rideId}:`, voucherError);
        }
      }

      // Process payment only when it is still pending.
      if (createdPayment.status === PaymentStatus.PENDING) {
        if (mappedMethod === PaymentMethod.CASH) {
          // Cash payment: mark as completed immediately (COD)
          await this.processPaymentRecord(createdPayment);
          // CASH: driver already has the full fare in hand; platform settles the
          // remaining obligation from wallet after per-trip bonus/penalty adjustments.
          if (driverId && earnings.cashDebt > 0) {
            await this.walletService.debitCommission(driverId, earnings.cashDebt, rideId);
            await this.prisma.driverEarnings.updateMany({
              where: { rideId, driverId, driverCollected: true },
              data: { isPaid: true },
            });
          }
        } else {
          // Electronic payment (MOMO/VISA): process with gateway mock
          await this.processElectronicPaymentRecord(createdPayment);
          // ONLINE: platform collected → credit driver's net earnings to wallet
          // Driver earnings are always from gross fare; voucher is the platform's cost
          if (driverId) {
            await this.walletService.creditEarning(driverId, earnings.netEarnings, rideId);
          }
        }
      } else if (createdPayment.status === PaymentStatus.COMPLETED) {
        // Payment already COMPLETED (online) — credit wallet if not already done
        // (idempotency: only credit when DriverEarnings was just created)
        if (mappedMethod !== PaymentMethod.CASH && driverId && !existingDriverEarnings) {
          await this.walletService.creditEarning(driverId, earnings.netEarnings, rideId);
        }
      }

      // Notify wallet-service of the settled earnings (idempotent via rideId key)
      if (driverId) {
        try {
          // Resolve the auth userId for this driver profile so wallet-service can
          // find the correct DriverWallet row (keyed by userId, not profileId).
          const driverUserId = await resolveDriverUserId(driverId).catch(() => null);

          await this.eventPublisher.publish('driver.earning.settled', {
            rideId,
            driverId,
            driverUserId: driverUserId ?? driverId,
            paymentMethod: mappedMethod,
            grossFare:     earnings.grossFare,
            commissionRate: earnings.commissionRate,
            platformFee:   earnings.platformFee,
            netEarnings:   earnings.netEarnings,
            cashDebt:      earnings.cashDebt,
            bonus:         earnings.bonus,
            voucherDiscount: discountAmount,
          }, rideId);
        } catch (publishError) {
          logger.error(`Failed to publish driver.earning.settled for ride ${rideId}:`, publishError);
        }
      }

      // Evaluate incentives for every completed ride
      if (driverId) {
        try {
          await this.incentiveService.evaluateAfterRide({
            rideId,
            driverId,
            distanceKm: distance || 0,
            completedAt: new Date(),
          });
        } catch (incentiveError) {
          // Non-critical: log but do not fail the ride completion
          logger.error(`Incentive evaluation failed for ride ${rideId}:`, incentiveError);
        }
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

    const [fare, driverEarnings] = await Promise.all([
      this.prisma.fare.findUnique({ where: { rideId: payment.rideId } }),
      this.prisma.driverEarnings.findUnique({ where: { rideId: payment.rideId } }),
    ]);

    return this.serializePaymentRecord(payment, fare, driverEarnings);
  }

  /**
   * Zero the payment_db wallet mirror for a driver who has deactivated.
   * Called when wallet-service publishes driver.wallet.deactivated event so that
   * subsequent top-ups start fresh from 0 instead of stale accumulated balance.
   */
  async zeroDriverWallet(driverId: string): Promise<void> {
    await this.prisma.driverWallet.updateMany({
      where: { driverId },
      data: { balance: 0 },
    });
    logger.info(`Payment DB wallet zeroed for deactivated driver ${driverId}`);
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
      payments: payments.map((payment) => this.serializePaymentRecord(payment, fareByRideId.get(payment.rideId) || null)),
      total,
    };
  }

  async getDriverEarnings(driverId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    await this.reconcileWalletSettledCashDebt(driverId);

    const [earningsRows, total, aggregates, walletBonusAggregate] = await Promise.all([
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
      this.prisma.walletTransaction.aggregate({
        where: { driverId, type: WalletTransactionType.BONUS },
        _sum: { amount: true },
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
        totalBonus:      (aggregates._sum.bonus || 0) + (walletBonusAggregate._sum.amount || 0),
        totalPenalty:    aggregates._sum.penalty     || 0,
        totalNetEarnings: aggregates._sum.netEarnings || 0,
        unpaidCashDebt:  unpaidCashDebt._sum.cashDebt || 0,
      },
    };
  }

  private async reconcileWalletSettledCashDebt(driverId: string): Promise<void> {
    const settledTransactions = await this.prisma.walletTransaction.findMany({
      where: {
        driverId,
        type: WalletTransactionType.COMMISSION,
        rideId: { not: null },
      },
      select: { rideId: true },
    });

    const settledRideIds = [...new Set(
      settledTransactions
        .map((transaction) => transaction.rideId)
        .filter((rideId): rideId is string => Boolean(rideId)),
    )];

    if (settledRideIds.length === 0) {
      return;
    }

    await this.prisma.driverEarnings.updateMany({
      where: {
        driverId,
        driverCollected: true,
        isPaid: false,
        rideId: { in: settledRideIds },
      },
      data: { isPaid: true },
    });
  }

  async refundPayment(rideId: string, reason: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({ where: { rideId } });
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new Error('Can only refund completed payments');
    }

    const refundInitiatedAt = new Date();
    let refundMetadata: Record<string, any> = {
      provider: payment.provider,
      amount: Math.round(payment.amount),
      description: reason,
      initiatedAt: refundInitiatedAt.toISOString(),
      status: 'RECORDED',
    };

    if (payment.provider === PaymentProvider.STRIPE && payment.paymentIntentId) {
      // Stripe removed — no refund action
      logger.warn(`Stripe refund attempted for payment ${payment.id} — Stripe integration removed`);
    }

    if (payment.provider === PaymentProvider.MOMO) {
      if (!config.momo.enabled) {
        throw new Error('MoMo refund is not available because the gateway is disabled');
      }

      if (!payment.transactionId) {
        throw new Error('MoMo payment is missing transactionId for refund');
      }

      const requestId = `refund_${uuidv4()}`;
      const refundOrderId = `ro_${uuidv4()}`;
      const refundResponse = await momoGateway.createRefund({
        orderId: refundOrderId,
        requestId,
        amount: Math.round(payment.amount),
        transId: payment.transactionId,
        description: reason,
      });

      const resultCode = Number(refundResponse?.resultCode ?? -1);
      if (![0, 43].includes(resultCode)) {
        throw new Error(refundResponse?.message || `MoMo refund failed with resultCode ${resultCode}`);
      }

      let queryData: Record<string, any> | null = null;
      try {
        queryData = await momoGateway.queryPaymentStatus({
          orderId: payment.rideId,
          requestId: `query_${uuidv4()}`,
        });
      } catch (error) {
        logger.warn('MoMo refund query failed after refund request was accepted', {
          rideId: payment.rideId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      refundMetadata = {
        ...refundMetadata,
        status: 'ACCEPTED',
        requestId,
        refundOrderId,
        resultCode,
        message: refundResponse?.message,
        refundTransactionId: refundResponse?.transId ? String(refundResponse.transId) : undefined,
        providerResponse: refundResponse,
        queryData,
      };
    }

    if (payment.provider === PaymentProvider.VNPAY) {
      if (!config.vnpay.enabled) {
        throw new Error('VNPay refund is not available because the gateway is disabled');
      }

      // Parse stored IPN/return params for txnRef, transactionNo, payDate
      const gw = this.buildGatewayResponseEnvelope(payment.gatewayResponse);
      const vnpTxnRef: string = String(gw.vnp_TxnRef || '');
      const vnpTransactionNo: string = String(gw.vnp_TransactionNo || payment.transactionId || '0');
      const vnpPayDate: string = String(gw.vnp_PayDate || '');
      const vnpBankCode: string = String(gw.vnp_BankCode || '');
      const vnpBankTranNo: string = String(gw.vnp_BankTranNo || '');
      const vnpCardType: string = String(gw.vnp_CardType || '');
      const vnpCardNo: string = String(gw.vnp_CardNo || gw.vnp_CardNumber || '');

      const vnpQueryData = {
        vnp_TxnRef: vnpTxnRef || undefined,
        vnp_TransactionNo: vnpTransactionNo || undefined,
        vnp_BankCode: vnpBankCode || undefined,
        vnp_BankTranNo: vnpBankTranNo || undefined,
        vnp_CardType: vnpCardType || undefined,
        vnp_CardNo: vnpCardNo || undefined,
        vnp_PayDate: vnpPayDate || undefined,
      };

      if (!vnpTxnRef) {
        throw new Error('VNPay payment is missing vnp_TxnRef for refund – ensure IPN was processed');
      }

      const { vnpayGateway: vg } = require('./vnpay.gateway');
      const refundResponse = await vg.createRefund({
        txnRef: vnpTxnRef,
        transactionNo: vnpTransactionNo,
        transactionDate: vnpPayDate,
        amount: Math.round(payment.amount),
        reason,
      });

      if (refundResponse.responseCode !== '00') {
        throw new Error(`VNPay refund failed: ${refundResponse.message} (code ${refundResponse.responseCode})`);
      }

      refundMetadata = {
        ...refundMetadata,
        status: 'ACCEPTED',
        txnRef: vnpTxnRef,
        refundTransactionId: refundResponse.transactionNo,
        bankCode: vnpBankCode || undefined,
        bankTransactionNo: vnpBankTranNo || undefined,
        cardType: vnpCardType || undefined,
        bankAccount: vnpCardNo || undefined,
        responseCode: refundResponse.responseCode,
        message: refundResponse.message,
        queryData: vnpQueryData,
        providerResponse: refundResponse,
      };
    }

    if (payment.provider === PaymentProvider.ZALOPAY && payment.transactionId) {
      // ZaloPay removed — no refund action
      logger.warn(`ZaloPay refund attempted for payment ${payment.id} — ZaloPay integration removed`);
    }

    // Fetch driver earnings BEFORE publishing the event so we have the correct refundAmount
    let driverEarnings = null;
    if (payment.driverId) {
      try {
        driverEarnings = await this.prisma.driverEarnings.findUnique({
          where: { rideId: payment.rideId },
        });
      } catch (err) {
        logger.warn(`Could not fetch driverEarnings for refund on ride ${rideId}:`, err);
      }
    }

    // For online rides: refundAmount = netEarnings (what was credited to driver)
    // For cash rides: refundAmount = platformFee (commission that was debited)
    const refundAmount = driverEarnings
      ? (payment.method === PaymentMethod.CASH ? driverEarnings.platformFee : driverEarnings.netEarnings)
      : 0;

    const gatewayResponse = this.buildGatewayResponseEnvelope(payment.gatewayResponse);
    const nextGatewayResponse = JSON.stringify({
      ...gatewayResponse,
      refund: refundMetadata,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.REFUNDED,
          refundedAt: refundInitiatedAt,
          gatewayResponse: nextGatewayResponse,
        },
      });

      await tx.outboxEvent.create({
        data: {
          eventType: 'refund.completed',
          payload: JSON.stringify({
            paymentId: payment.id,
            rideId: payment.rideId,
            customerId: payment.customerId,
            driverId: payment.driverId,
            amount: payment.amount,
            refundAmount,
            reason,
            refund: refundMetadata,
          }),
          correlationId: payment.rideId,
        },
      });
    });

    await this.eventPublisher.publish('refund.completed', {
      paymentId: payment.id,
      rideId: payment.rideId,
      customerId: payment.customerId,
      driverId: payment.driverId,
      amount: payment.amount,
      refundAmount,
      reason,
      refund: refundMetadata,
    }, payment.rideId);

    // Reverse wallet entry for the driver (updates payment-service internal wallet)
    if (payment.driverId && driverEarnings) {
      try {
        if (payment.method === PaymentMethod.CASH) {
          // For cash rides: reverse the commission deduction → credit commission back
          await this.walletService.creditBonus(
            payment.driverId,
            driverEarnings.platformFee,
            `Hoàn hoa hồng (huỷ chuyến cash)`,
            payment.rideId,
          );
        } else {
          // For online rides: reverse the net-earnings credit → debit netEarnings
          await this.walletService.reverseEarning(
            payment.driverId,
            driverEarnings.netEarnings,
            payment.rideId,
          );
        }
      } catch (walletError) {
        logger.error(`Wallet reversal failed for refund on ride ${rideId}:`, walletError);
      }
    }

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

    return { payments: payments.map((payment) => this.serializePaymentRecord(payment)), total };
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
    vehicleType: string = 'MOTORBIKE',
  ) {
    // Rates aligned with pricing-service/src/config/index.ts
    // ECONOMY/MOTORBIKE alias kept for backward-compat with legacy events
    const RATES: Record<string, { base: number; km: number; min: number }> = {
      MOTORBIKE: { base: 10_000, km: 6_200,  min: 450   },
      SCOOTER:   { base: 14_000, km: 8_400,  min: 700   },
      CAR_4:     { base: 24_000, km: 15_000, min: 1_900 },
      CAR_7:     { base: 32_000, km: 18_500, min: 2_400 },
    };

    // Map legacy / aliased names
    const ALIAS: Record<string, string> = {
      ECONOMY:  'MOTORBIKE',
      COMFORT:  'CAR_4',
      PREMIUM:  'CAR_7',
    };

    const canonical = ALIAS[vehicleType.toUpperCase()] ?? vehicleType.toUpperCase();
    const rate = RATES[canonical] ?? RATES.MOTORBIKE;

    const distanceFare = distanceKm * rate.km;
    const timeFare     = (durationSeconds / 60) * rate.min;
    const subtotal     = rate.base + distanceFare + timeFare;
    const totalFare    = Math.max(15_000, Math.round(subtotal * surgeMultiplier));

    return {
      baseFare:        rate.base,
      distanceFare:    Math.round(distanceFare),
      timeFare:        Math.round(timeFare),
      surgeMultiplier,
      totalFare,
      vehicleType:     canonical,
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
        return config.momo.enabled ? PaymentGatewayType.MOMO : PaymentGatewayType.MOCK;
      case PaymentMethod.VISA:
      case PaymentMethod.CARD:
        // Stripe removed — treat card as mock
        return PaymentGatewayType.MOCK;
      case PaymentMethod.CASH:
      default:
        return PaymentGatewayType.MOCK;
    }
  }

  private mapPaymentProviderFromGateway(provider: PaymentGatewayType): PaymentProvider {
    switch (provider) {
      case PaymentGatewayType.MOMO:
        return PaymentProvider.MOMO;
      case PaymentGatewayType.VNPAY:
        return PaymentProvider.VNPAY;
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

  private buildGatewayResponseEnvelope(raw: string | null): Record<string, any> {
    const parsed = this.parseGatewayResponse(raw);
    if (!parsed || Array.isArray(parsed)) {
      return {};
    }

    return parsed;
  }

  private serializePaymentRecord(payment: any, fare: any = null, driverEarnings: any = null) {
    const gatewayResponse = this.buildGatewayResponseEnvelope(payment.gatewayResponse);
    const rawRefund = gatewayResponse.refund && typeof gatewayResponse.refund === 'object'
      ? { ...(gatewayResponse.refund as Record<string, any>) }
      : null;

    let refund = rawRefund;
    if (refund && payment.provider === PaymentProvider.VNPAY) {
      const existingQueryData = refund.queryData && typeof refund.queryData === 'object'
        ? { ...(refund.queryData as Record<string, any>) }
        : {};

      const enrichedQueryData = {
        ...existingQueryData,
        vnp_BankCode: existingQueryData.vnp_BankCode || gatewayResponse.vnp_BankCode,
        vnp_BankTranNo: existingQueryData.vnp_BankTranNo || gatewayResponse.vnp_BankTranNo,
        vnp_CardType: existingQueryData.vnp_CardType || gatewayResponse.vnp_CardType,
        vnp_CardNo: existingQueryData.vnp_CardNo || gatewayResponse.vnp_CardNo || gatewayResponse.vnp_CardNumber,
      };

      refund = {
        ...refund,
        bankCode: refund.bankCode || gatewayResponse.vnp_BankCode,
        bankTransactionNo: refund.bankTransactionNo || gatewayResponse.vnp_BankTranNo,
        bankAccount: refund.bankAccount || gatewayResponse.vnp_CardNo || gatewayResponse.vnp_CardNumber,
        cardType: refund.cardType || gatewayResponse.vnp_CardType,
        queryData: enrichedQueryData,
      };
    }

    return {
      ...payment,
      fare,
      refund,
      driverEarnings: driverEarnings
        ? {
            grossFare: driverEarnings.grossFare,
            commissionRate: driverEarnings.commissionRate,
            platformFee: driverEarnings.platformFee,
            bonus: driverEarnings.bonus,
            penalty: driverEarnings.penalty,
            netEarnings: driverEarnings.netEarnings,
            paymentMethod: driverEarnings.paymentMethod,
            driverCollected: driverEarnings.driverCollected,
            cashDebt: driverEarnings.cashDebt,
          }
        : null,
    };
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

  async getDriverWallet(driverId: string) {
    return this.walletService.getDriverWallet(driverId);
  }

  async adjustDriverWalletBalance(driverId: string, delta: number): Promise<void> {
    return this.walletService.adjustDriverWalletBalance(driverId, delta);
  }
}
