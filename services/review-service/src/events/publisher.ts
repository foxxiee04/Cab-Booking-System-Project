import amqp, { Channel, Connection } from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { logger } from '../utils/logger';

const EXCHANGE_NAME = 'domain-events';

export class EventPublisher {
  private connection: Connection | null = null;
  private channel: Channel | null = null;

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(config.rabbitmq.url) as any as Connection;
      this.channel = await (this.connection as any).createChannel();
      await this.channel!.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
      logger.info('Review Service connected to RabbitMQ');
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ:', error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  async publish(eventType: string, payload: unknown, correlationId?: string): Promise<void> {
    if (!this.channel) {
      logger.warn('RabbitMQ channel not available');
      return;
    }

    const event = {
      eventId: uuidv4(),
      eventType,
      occurredAt: new Date().toISOString(),
      correlationId: correlationId || uuidv4(),
      payload,
    };

    try {
      this.channel.publish(
        EXCHANGE_NAME,
        eventType,
        Buffer.from(JSON.stringify(event)),
        { persistent: true }
      );
      logger.info(`Event published: ${eventType}`, { eventId: event.eventId });
    } catch (error) {
      logger.error('Failed to publish event:', error);
    }
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await (this.connection as any)?.close();
  }
}
