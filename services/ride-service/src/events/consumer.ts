import amqp, { Channel, Connection } from 'amqplib';
import { config } from '../config';
import { logger } from '../utils/logger';
import { RideService } from '../services/ride.service';

const EXCHANGE_NAME = 'domain-events';

export class EventConsumer {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private queue = 'ride-service-queue';
  private rideService: RideService;

  constructor(rideService: RideService) {
    this.rideService = rideService;
  }

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();
      
      await this.channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
      await this.channel.assertQueue(this.queue, { durable: true });
      
      // Bind to booking.created event from Booking Service
      await this.channel.bindQueue(this.queue, EXCHANGE_NAME, 'booking.created');
      
      await this.channel.prefetch(10);
      
      logger.info('Ride Service consumer connected to RabbitMQ');
      
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
      case 'booking.created':
        await this.handleBookingCreated(payload);
        break;
      default:
        logger.warn(`Unhandled event type: ${eventType}`);
    }
  }

  private async handleBookingCreated(payload: any): Promise<void> {
    logger.info('Creating ride from booking', { bookingId: payload.bookingId });
    
    try {
      // Create ride from booking data
      await this.rideService.createRideFromBooking({
        bookingId: payload.bookingId,
        customerId: payload.customerId,
        pickupAddress: payload.pickupAddress,
        pickupLat: payload.pickupLat,
        pickupLng: payload.pickupLng,
        dropoffAddress: payload.dropoffAddress,
        dropoffLat: payload.dropoffLat,
        dropoffLng: payload.dropoffLng,
        vehicleType: payload.vehicleType,
        paymentMethod: payload.paymentMethod,
        fare: payload.estimatedFare,
        distance: payload.estimatedDistance,
        duration: payload.estimatedDuration,
        surgeMultiplier: payload.surgeMultiplier,
      });
    } catch (error) {
      logger.error('Failed to create ride from booking:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch (error) {
      logger.error('Error closing RabbitMQ connection:', error);
    }
  }
}
