import amqp, { Channel, ConsumeMessage } from 'amqplib';
import { PrismaClient } from '../generated/prisma-client';
import { config } from '../config';
import { logger } from '../utils/logger';
import { DriverWalletService } from '../services/driver-wallet.service';
import { MerchantLedgerService } from '../services/merchant-ledger.service';
import { BonusService } from '../services/bonus.service';
import { EventPublisher } from './publisher';

/**
 * Payload emitted by payment-service after a ride earning is settled.
 * Includes full commission/bonus breakdown so wallet-service can update
 * balances without needing to call payment-service.
 */
interface DriverEarningSettledPayload {
  rideId: string;
  driverId: string;
  paymentMethod: string;    // CASH | MOMO | VNPAY | VISA | CARD | WALLET
  grossFare: number;
  commissionRate: number;
  platformFee: number;
  netEarnings: number;
  cashDebt: number;         // >0 for CASH rides
  bonus: number;
  voucherDiscount: number;
}

interface RefundCompletedPayload {
  rideId: string;
  driverId?: string;
  refundAmount: number;
  reason?: string;
}

interface WalletTopupCompletedPayload {
  orderId: string;
  driverId: string;
  amount: number;
  provider: string;
  gatewayTxnId?: string;
}

export class EventConsumer {
  // amqplib v0.10+ returns ChannelModel from connect()
  private connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;
  private channel: Channel | null = null;
  private readonly exchange = 'domain-events';
  private readonly queue = 'wallet-service-queue';

  private walletService: DriverWalletService;
  private ledgerService: MerchantLedgerService;
  private bonusService: BonusService;

  isConnected(): boolean {
    return Boolean(this.connection && this.channel);
  }

  constructor(prisma: PrismaClient, eventPublisher: EventPublisher) {
    this.walletService = new DriverWalletService(prisma, eventPublisher);
    this.ledgerService = new MerchantLedgerService(prisma);
    this.bonusService  = new BonusService(prisma, this.walletService, this.ledgerService);
  }

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(config.rabbitmq.url);
      this.channel    = await this.connection.createChannel();

      await this.channel.assertExchange(this.exchange, 'topic', { durable: true });
      await this.channel.assertQueue(this.queue, { durable: true });

      // Events from payment-service
      await this.channel.bindQueue(this.queue, this.exchange, 'driver.earning.settled');
      await this.channel.bindQueue(this.queue, this.exchange, 'refund.completed');
      await this.channel.bindQueue(this.queue, this.exchange, 'wallet.topup.completed');

      await this.channel.prefetch(1);

      logger.info('Wallet Service consumer connected to RabbitMQ');
      this.startConsuming();
    } catch (error) {
      logger.error('Failed to connect consumer to RabbitMQ:', error);
      throw error;
    }
  }

  private startConsuming(): void {
    if (!this.channel) return;

    this.channel.consume(this.queue, async (msg: ConsumeMessage | null) => {
      if (!msg) return;

      try {
        const event     = JSON.parse(msg.content.toString());
        const { eventType, payload } = event;

        logger.info(`Received event: ${eventType}`, {
          correlationId: event.metadata?.correlationId,
        });

        switch (eventType) {
          case 'driver.earning.settled':
            await this.handleDriverEarningSettled(payload as DriverEarningSettledPayload);
            break;
          case 'refund.completed':
            await this.handleRefundCompleted(payload as RefundCompletedPayload);
            break;
          case 'wallet.topup.completed':
            await this.handleWalletTopupCompleted(payload as WalletTopupCompletedPayload);
            break;
          default:
            logger.warn(`Unknown event type: ${eventType}`);
        }

        this.channel?.ack(msg);
      } catch (error) {
        logger.error('Error processing message:', error);
        this.channel?.nack(msg, false, true);
      }
    });
  }

  // ─── Handlers ─────────────────────────────────────────────────────────────

  private async handleDriverEarningSettled(payload: DriverEarningSettledPayload): Promise<void> {
    const {
      rideId,
      driverId,
      paymentMethod,
      grossFare,
      platformFee,
      netEarnings,
      cashDebt,
      bonus,
      voucherDiscount,
    } = payload;

    logger.info(`Processing driver.earning.settled for ride ${rideId}`, { driverId, paymentMethod });

    const isCash = paymentMethod === 'CASH';

    if (isCash) {
      // Cash ride: driver collected fare directly → debit commission owed to platform
      if (cashDebt > 0) {
        await this.walletService.debitCommission({ driverId, commission: cashDebt, rideId });
      }
    } else {
      // Online ride: platform collected fare → credit driver net earnings
      await this.walletService.creditEarning({
        driverId,
        netEarnings,
        grossFare,
        platformFee,
        voucherDiscount,
        rideId,
      });
    }

    // Credit any per-ride bonus
    if (bonus > 0) {
      await this.walletService.creditBonus({
        driverId,
        amount: bonus,
        description: 'Thưởng chuyến đi',
        rideId,
      });
    }
  }

  private async handleRefundCompleted(payload: RefundCompletedPayload): Promise<void> {
    const { rideId, driverId, refundAmount, reason } = payload;
    if (!driverId || refundAmount <= 0) return;

    logger.info(`Processing refund.completed for ride ${rideId}`, { driverId, refundAmount });

    await this.walletService.processRefund({ driverId, netEarnings: refundAmount, rideId, reason });
  }

  private async handleWalletTopupCompleted(payload: WalletTopupCompletedPayload): Promise<void> {
    const { orderId, driverId, amount, provider, gatewayTxnId } = payload;
    logger.info(`Processing wallet.topup.completed for order ${orderId}`, { driverId, amount, provider, gatewayTxnId });

    await this.walletService.creditTopUp({ driverId, amount, orderId, provider, gatewayTxnId });
  }

  async close(): Promise<void> {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
    logger.info('Wallet Service consumer disconnected from RabbitMQ');
  }
}
