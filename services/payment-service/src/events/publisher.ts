import amqp, { Channel, Connection } from 'amqplib';
import { config } from '../config';
import { logger } from '../utils/logger';

export class EventPublisher {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private exchange = 'domain-events';

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(this.exchange, 'topic', { durable: true });
      logger.info('Payment Service connected to RabbitMQ');
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  async publish(eventType: string, payload: object, correlationId?: string): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    const message = {
      eventType,
      payload,
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'payment-service',
        correlationId,
      },
    };

    this.channel.publish(
      this.exchange,
      eventType,
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );

    logger.debug(`Published event ${eventType}`, { correlationId });
  }

  async close(): Promise<void> {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
    logger.info('Payment Service disconnected from RabbitMQ');
  }
}
