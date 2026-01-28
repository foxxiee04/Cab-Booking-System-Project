import amqp, { Channel, Connection } from 'amqplib';
import { config } from '../config';
import { logger } from '../utils/logger';

const EXCHANGE_NAME = 'domain-events';

export class EventConsumer {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private queue = 'user-service-queue';

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(config.rabbitmq.url) as any as Connection;
      this.channel = await (this.connection as any).createChannel();
      
      await this.channel!.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
      await this.channel!.assertQueue(this.queue, { durable: true });
      
      // Bind to user.registered event from Auth Service
      await this.channel!.bindQueue(this.queue, EXCHANGE_NAME, 'user.registered');
      
      await this.channel!.prefetch(10);
      
      logger.info('User Service consumer connected to RabbitMQ');
      
      this.startConsuming();
    } catch (error) {
      logger.error('Failed to connect consumer to RabbitMQ:', error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  private startConsuming(): void {
    if (!this.channel) return;

    this.channel.consume(this.queue, async (msg) => {
      if (!msg) return;

      try {
        const event = JSON.parse(msg.content.toString());
        const { eventType, payload } = event;

        logger.info(`Processing event: ${eventType}`);

        await this.handleEvent(eventType, payload);
        this.channel!.ack(msg);
      } catch (error) {
        logger.error('Error processing message:', error);
        this.channel!.nack(msg, false, false);
      }
    });
  }

  private async handleEvent(eventType: string, payload: any): Promise<void> {
    switch (eventType) {
      case 'user.registered':
        await this.handleUserRegistered(payload);
        break;
      default:
        logger.warn(`Unhandled event type: ${eventType}`);
    }
  }

  private async handleUserRegistered(payload: any): Promise<void> {
    const { userId, email, role, firstName, lastName, phone } = payload;
    
    logger.info('Creating user profile from registration event', { userId });
    
    // Import UserService here to avoid circular dependency
    const { UserService } = await import('../services/user.service');
    const userService = new UserService();
    
    await userService.createProfileFromAuth({
      userId,
      firstName,
      lastName,
      phone,
    });
  }

  async close(): Promise<void> {
    try {
      await this.channel?.close();
      await (this.connection as any)?.close();
    } catch (error) {
      logger.error('Error closing RabbitMQ connection:', error);
    }
  }
}
