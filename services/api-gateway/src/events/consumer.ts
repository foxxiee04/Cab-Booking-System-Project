import amqp, { Channel, Connection, ConsumeMessage } from 'amqplib';
import { config } from '../config';
import { logger } from '../utils/logger';
import { SocketServer } from '../socket/socket-server';
import Redis from 'ioredis';

const EXCHANGE_NAME = 'domain-events';
const QUEUE_NAME = 'api-gateway-events';

interface Location {
  address: string;
  geoPoint: { lat: number; lng: number };
}

interface BookingCreatedPayload {
  bookingId: string;
  customerId: string;
  pickup: Location;
  dropoff: Location;
  estimatedFare: number;
  estimatedDistance: number;
  createdAt: string;
}

interface RideEventPayload {
  rideId: string;
  customerId: string;
  driverId?: string;
  status: string;
  pickup?: Location;
  dropoff?: Location;
  fare?: number;
  distance?: number;
  duration?: number;
}

export class EventConsumer {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private socketServer: SocketServer;
  private redis: Redis;

  constructor(socketServer: SocketServer) {
    this.socketServer = socketServer;
    this.redis = new Redis(config.redisUrl);
  }

  async connect(): Promise<void> {
    try {
      const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
      this.connection = await amqp.connect(rabbitmqUrl) as any as Connection;
      this.channel = await (this.connection as any).createChannel();

      await this.channel!.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
      await this.channel!.assertQueue(QUEUE_NAME, { durable: true });

      // Bind to events we care about
      await this.channel!.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'booking.created');
      await this.channel!.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.accepted');
      await this.channel!.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.started');
      await this.channel!.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.completed');
      await this.channel!.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.cancelled');

      await this.channel!.consume(QUEUE_NAME, this.handleMessage.bind(this), { noAck: false });

      logger.info('API Gateway EventConsumer connected to RabbitMQ');
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ:', error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  private async handleMessage(msg: ConsumeMessage | null): Promise<void> {
    if (!msg) return;

    try {
      const content = JSON.parse(msg.content.toString());
      const eventType = content.eventType || msg.fields.routingKey;

      logger.info(`Received event: ${eventType}`);

      switch (eventType) {
        case 'booking.created':
          await this.handleBookingCreated(content.payload);
          break;
        case 'ride.accepted':
          await this.handleRideAccepted(content.payload);
          break;
        case 'ride.started':
          await this.handleRideStarted(content.payload);
          break;
        case 'ride.completed':
          await this.handleRideCompleted(content.payload);
          break;
        case 'ride.cancelled':
          await this.handleRideCancelled(content.payload);
          break;
        default:
          logger.debug(`Unhandled event type: ${eventType}`);
      }

      this.channel?.ack(msg);
    } catch (error) {
      logger.error('Error processing message:', error);
      this.channel?.nack(msg, false, false);
    }
  }

  private async handleBookingCreated(payload: BookingCreatedPayload): Promise<void> {
    logger.info(`Processing booking.created for booking ${payload.bookingId}`);

    try {
      // Find nearby online drivers
      const nearbyDrivers = await this.findNearbyOnlineDrivers(
        payload.pickup.geoPoint,
        5000 // 5km radius
      );

      if (nearbyDrivers.length === 0) {
        logger.warn(`No online drivers found for booking ${payload.bookingId}`);
        return;
      }

      // Push notification to all nearby drivers
      const notificationData = {
        bookingId: payload.bookingId,
        customerId: payload.customerId,
        pickup: payload.pickup,
        dropoff: payload.dropoff,
        estimatedFare: payload.estimatedFare,
        estimatedDistance: payload.estimatedDistance,
        createdAt: payload.createdAt,
      };

      this.socketServer.emitToDrivers(nearbyDrivers, 'NEW_RIDE_AVAILABLE', notificationData);

      logger.info(
        `Pushed NEW_RIDE_AVAILABLE to ${nearbyDrivers.length} drivers for booking ${payload.bookingId}`
      );
    } catch (error) {
      logger.error('Error handling booking.created:', error);
    }
  }

  private async handleRideAccepted(payload: RideEventPayload): Promise<void> {
    logger.info(`Processing ride.accepted for ride ${payload.rideId}`);

    const data = {
      rideId: payload.rideId,
      status: 'ACCEPTED',
      driverId: payload.driverId,
      message: 'Driver has accepted your ride',
    };

    // Notify customer
    this.socketServer.emitToCustomer(payload.customerId, 'RIDE_STATUS_UPDATE', data);

    // Also notify driver
    if (payload.driverId) {
      this.socketServer.emitToDriver(payload.driverId, 'RIDE_STATUS_UPDATE', data);
    }
  }

  private async handleRideStarted(payload: RideEventPayload): Promise<void> {
    logger.info(`Processing ride.started for ride ${payload.rideId}`);

    const data = {
      rideId: payload.rideId,
      status: 'IN_PROGRESS',
      message: 'Your ride has started',
    };

    // Notify both customer and driver
    if (payload.driverId) {
      this.socketServer.emitToCustomerAndDriver(
        payload.customerId,
        payload.driverId,
        'RIDE_STATUS_UPDATE',
        data
      );
    }
  }

  private async handleRideCompleted(payload: RideEventPayload): Promise<void> {
    logger.info(`Processing ride.completed for ride ${payload.rideId}`);

    const data = {
      rideId: payload.rideId,
      status: 'COMPLETED',
      fare: payload.fare,
      distance: payload.distance,
      duration: payload.duration,
      message: 'Your ride has been completed',
    };

    // Notify both customer and driver
    if (payload.driverId) {
      this.socketServer.emitToCustomerAndDriver(
        payload.customerId,
        payload.driverId,
        'RIDE_COMPLETED',
        data
      );
    }
  }

  private async handleRideCancelled(payload: RideEventPayload): Promise<void> {
    logger.info(`Processing ride.cancelled for ride ${payload.rideId}`);

    const data = {
      rideId: payload.rideId,
      status: 'CANCELLED',
      message: 'Ride has been cancelled',
    };

    // Notify customer
    this.socketServer.emitToCustomer(payload.customerId, 'RIDE_STATUS_UPDATE', data);

    // Notify driver if assigned
    if (payload.driverId) {
      this.socketServer.emitToDriver(payload.driverId, 'RIDE_STATUS_UPDATE', data);
    }
  }

  /**
   * Find nearby online drivers using Redis geospatial queries
   * Assumes driver locations are stored in Redis with GEOADD
   */
  private async findNearbyOnlineDrivers(
    location: { lat: number; lng: number },
    radiusMeters: number
  ): Promise<string[]> {
    try {
      // Query Redis for nearby drivers
      // Format: GEORADIUS driver-locations lng lat radius m
      const results = await this.redis.georadius(
        'driver-locations',
        location.lng,
        location.lat,
        radiusMeters,
        'm',
        'WITHDIST'
      );

      if (!results || results.length === 0) {
        return [];
      }

      // Extract driver IDs and filter only online drivers
      const driverIds: string[] = [];
      
      for (const result of results) {
        const driverId = Array.isArray(result) ? result[0] : result;
        
        // Check if driver is online using our socket server
        if (this.socketServer.isUserOnline(driverId)) {
          driverIds.push(driverId);
        }
      }

      return driverIds;
    } catch (error) {
      logger.error('Error finding nearby drivers:', error);
      return [];
    }
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await (this.connection as any)?.close();
    await this.redis.quit();
    logger.info('EventConsumer closed');
  }
}
