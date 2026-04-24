import amqp, { Channel } from 'amqplib';
import { config } from '../config';
import { logger } from '../utils/logger';

export class EventPublisher {
  // amqplib v0.10+ returns ChannelModel from connect()
  private connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;
  private channel: Channel | null = null;
  private readonly exchange = 'domain-events';

  isConnected(): boolean {
    return Boolean(this.connection && this.channel);
  }

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(this.exchange, 'topic', { durable: true });
      logger.info('Wallet Service connected to RabbitMQ (publisher)');
    } catch (error) {
      logger.error('Failed to connect publisher to RabbitMQ:', error);
      throw error;
    }
  }

  async publish(eventType: string, payload: object, correlationId?: string): Promise<void> {
    if (!this.channel) throw new Error('RabbitMQ channel not initialized');

    const message = {
      eventType,
      payload,
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'wallet-service',
        correlationId,
      },
    };

    this.channel.publish(
      this.exchange,
      eventType,
      Buffer.from(JSON.stringify(message)),
      { persistent: true },
    );

    logger.debug(`Published event ${eventType}`, { correlationId });
  }

  async close(): Promise<void> {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
    logger.info('Wallet Service publisher disconnected from RabbitMQ');
  }
}
