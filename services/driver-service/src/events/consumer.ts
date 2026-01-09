import amqp, { Channel, Connection, ConsumeMessage } from 'amqplib';
import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { DriverService } from '../services/driver.service';

const EXCHANGE_NAME = 'domain-events';
const QUEUE_NAME = 'driver-service.queue';

export class EventConsumer {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private driverService: DriverService;

  constructor(driverService: DriverService) {
    this.driverService = driverService;
  }

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();
      
      await this.channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
      await this.channel.assertQueue(QUEUE_NAME, { durable: true });
      
      // Bind to relevant events
      await this.channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.assignment.requested');
      await this.channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.completed');
      await this.channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.cancelled');

      await this.channel.consume(QUEUE_NAME, this.handleMessage.bind(this), { noAck: false });
      
      logger.info('Event consumer connected and listening');
    } catch (error) {
      logger.error('Failed to connect event consumer:', error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  private async handleMessage(msg: ConsumeMessage | null): Promise<void> {
    if (!msg) return;

    try {
      const event = JSON.parse(msg.content.toString());
      logger.info(`Received event: ${event.eventType}`, { eventId: event.eventId });

      switch (event.eventType) {
        case 'ride.assignment.requested':
          await this.handleRideAssignmentRequested(event);
          break;
        case 'ride.completed':
        case 'ride.cancelled':
          await this.handleRideEnded(event);
          break;
      }

      this.channel?.ack(msg);
    } catch (error) {
      logger.error('Error processing message:', error);
      // Reject and requeue
      this.channel?.nack(msg, false, true);
    }
  }

  private async handleRideAssignmentRequested(event: any): Promise<void> {
    const { rideId, pickup, searchRadiusKm } = event.payload;

    // Find nearby available drivers
    const nearbyDrivers = await this.driverService.findNearbyDrivers(
      pickup,
      searchRadiusKm || config.driver.searchRadiusKm,
      5
    );

    if (nearbyDrivers.length === 0) {
      logger.warn(`No available drivers for ride ${rideId}`);
      // TODO: notify customer no drivers available
      return;
    }

    // For simplicity, assign the nearest driver
    // In production, could use AI service for smarter matching
    const selectedDriver = nearbyDrivers[0];

    try {
      // Call ride service to assign driver
      await axios.post(
        `${config.services.ride}/internal/rides/${rideId}/assign`,
        { driverId: selectedDriver.driverId },
        { 
          timeout: 5000,
          headers: {
            'x-internal-token': config.internalServiceToken
          }
        }
      );

      logger.info(`Assigned driver ${selectedDriver.driverId} to ride ${rideId}`);
    } catch (error) {
      logger.error(`Failed to assign driver to ride ${rideId}:`, error);
    }
  }

  private async handleRideEnded(event: any): Promise<void> {
    const { driverId } = event.payload;
    if (!driverId) return;

    try {
      // Find driver by driverId (MongoDB _id)
      const driver = await this.driverService.getDriverById(driverId);
      if (driver) {
        await this.driverService.markAvailable(driver.userId);
        logger.info(`Driver ${driverId} marked available after ride ended`);
      }
    } catch (error) {
      logger.error(`Failed to mark driver available:`, error);
    }
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}
