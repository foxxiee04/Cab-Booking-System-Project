import amqp, { Channel, Connection, ConsumeMessage } from 'amqplib';
import { PrismaClient } from '../generated/prisma-client';
import { config } from '../config';
import { PaymentService } from '../services/payment.service';
import { EventPublisher } from './publisher';
import { logger } from '../utils/logger';

export class EventConsumer {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private paymentService: PaymentService;
  private exchange = 'domain-events';
  private queue = 'payment-service-queue';

  constructor(prisma: PrismaClient, eventPublisher: EventPublisher) {
    this.paymentService = new PaymentService(prisma, eventPublisher);
  }

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();
      
      await this.channel.assertExchange(this.exchange, 'topic', { durable: true });
      await this.channel.assertQueue(this.queue, { durable: true });
      
      // Bind to relevant events
      await this.channel.bindQueue(this.queue, this.exchange, 'ride.completed');
      await this.channel.bindQueue(this.queue, this.exchange, 'ride.cancelled');
      
      await this.channel.prefetch(1);
      
      logger.info('Payment Service consumer connected to RabbitMQ');
      
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
        const event = JSON.parse(msg.content.toString());
        const { eventType, payload } = event;

        logger.info(`Received event: ${eventType}`, { correlationId: event.metadata?.correlationId });

        switch (eventType) {
          case 'ride.completed':
            await this.handleRideCompleted(payload);
            break;
          case 'ride.cancelled':
            await this.handleRideCancelled(payload);
            break;
          default:
            logger.warn(`Unknown event type: ${eventType}`);
        }

        this.channel?.ack(msg);
      } catch (error) {
        logger.error('Error processing message:', error);
        // Nack and requeue if processing fails
        this.channel?.nack(msg, false, true);
      }
    });
  }

  private async handleRideCompleted(payload: any): Promise<void> {
    logger.info(`Processing ride.completed for ride ${payload.rideId}`);
    await this.paymentService.processRideCompleted(payload);
  }

  private async handleRideCancelled(payload: any): Promise<void> {
    logger.info(`Processing ride.cancelled for ride ${payload.rideId}`);
    
    // Check if payment exists and needs refund
    try {
      const payment = await this.paymentService.getPaymentByRideId(payload.rideId);
      if (payment && payment.status === 'COMPLETED') {
        await this.paymentService.refundPayment(
          payload.rideId,
          payload.reason || 'Ride cancelled'
        );
      }
    } catch (error) {
      logger.error(`Error handling ride cancellation for ${payload.rideId}:`, error);
    }
  }

  async close(): Promise<void> {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
    logger.info('Payment Service consumer disconnected from RabbitMQ');
  }
}
