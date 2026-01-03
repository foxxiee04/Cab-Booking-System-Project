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
      this.connection = await amqp.connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
      logger.info('Connected to RabbitMQ');
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
      logger.debug(`Event published: ${eventType}`);
    } catch (error) {
      logger.error('Failed to publish event:', error);
    }
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}
