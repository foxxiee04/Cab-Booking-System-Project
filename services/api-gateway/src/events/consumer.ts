import amqp, { Channel, Connection, ConsumeMessage } from 'amqplib';
import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { SocketServer } from '../socket/socket-server';
import Redis from 'ioredis';

const EXCHANGE_NAME = 'domain-events';
const QUEUE_NAME = 'api-gateway-events';
const DRIVER_GEO_KEY = 'drivers:geo:online';
const DEFAULT_MATCH_RADIUS_METERS = 5000;
const DEFAULT_OFFER_TIMEOUT_SECONDS = 30;

interface MatchingLocation {
  lat: number;
  lng: number;
  address?: string;
}

interface RideEventPayload {
  rideId: string;
  customerId: string;
  driverId?: string;
  status: string;
  pickup?: MatchingLocation;
  dropoff?: MatchingLocation;
  fare?: number;
  distance?: number;
  duration?: number;
}

interface MatchingRequestedPayload {
  rideId: string;
  customerId: string;
  vehicleType?: string;
  pickup: MatchingLocation;
  dropoff?: MatchingLocation;
  fare?: number;
  estimatedFare?: number;
  distance?: number;
  duration?: number;
  searchRadiusKm?: number;
  excludeDriverIds?: string[];
  attempt?: number;
  maxAttempts?: number;
}

interface RideOfferedPayload {
  rideId: string;
  driverId: string;
  customerId: string;
  pickup: MatchingLocation;
  dropoff: MatchingLocation;
  fare?: number;
  distance?: number;
  duration?: number;
  ttlSeconds?: number;
  expiresAt?: string;
}

interface DriverRecipient {
  driverId: string;
  userId: string;
}

export class EventConsumer {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private socketServer: SocketServer;
  private redis: Redis;
  private driverUserCache = new Map<string, string>();

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
      await this.channel!.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.finding_driver_requested');
      await this.channel!.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.reassignment_requested');
      await this.channel!.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.offered');
      await this.channel!.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.assigned');
      await this.channel!.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.offer_timeout');
      await this.channel!.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.accepted');
      await this.channel!.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.picking_up');
      await this.channel!.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.started');
      await this.channel!.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.completed');
      await this.channel!.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.cancelled');

      await this.channel!.consume(QUEUE_NAME, this.handleMessage.bind(this), { noAck: false });

      logger.info('API Gateway EventConsumer connected to RabbitMQ');
    } catch (error) {
      this.channel = null;
      this.connection = null;
      logger.error('Failed to connect to RabbitMQ:', error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  isConnected(): boolean {
    return this.connection !== null && this.channel !== null;
  }

  private async handleMessage(msg: ConsumeMessage | null): Promise<void> {
    if (!msg) return;

    try {
      const content = JSON.parse(msg.content.toString());
      const eventType = content.eventType || msg.fields.routingKey;

      logger.info(`Received event: ${eventType}`);

      switch (eventType) {
        case 'ride.finding_driver_requested':
        case 'ride.reassignment_requested':
          await this.handleMatchingRequested(content.payload);
          break;
        case 'ride.offered':
          await this.handleRideOffered(content.payload);
          break;
        case 'ride.assigned':
          await this.handleRideAssigned(content.payload);
          break;
        case 'ride.offer_timeout':
          await this.handleRideOfferTimeout(content.payload);
          break;
        case 'ride.accepted':
          await this.handleRideAccepted(content.payload);
          break;
        case 'ride.picking_up':
          await this.handleRidePickingUp(content.payload);
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

  private async handleMatchingRequested(payload: MatchingRequestedPayload): Promise<void> {
    logger.info(`Processing driver matching request for ride ${payload.rideId}`);

    try {
      const nearbyDrivers = await this.findNearbyOnlineDrivers(
        payload.pickup,
        this.getMatchRadiusMeters(payload.searchRadiusKm),
        payload.excludeDriverIds
      );

      if (nearbyDrivers.length === 0) {
        logger.warn(`No online drivers found for ride ${payload.rideId}`);
        return;
      }

      const notificationData = {
        rideId: payload.rideId,
        customerId: payload.customerId,
        pickup: payload.pickup,
        dropoff: payload.dropoff,
        estimatedFare: payload.fare ?? payload.estimatedFare,
        vehicleType: payload.vehicleType,
        distance: payload.distance,
        duration: payload.duration,
        timeoutSeconds: DEFAULT_OFFER_TIMEOUT_SECONDS,
        searchAttempt: payload.attempt,
      };

      this.socketServer.emitToDrivers(
        nearbyDrivers.map((driver) => driver.userId),
        'NEW_RIDE_AVAILABLE',
        notificationData
      );

      logger.info(
        `Pushed NEW_RIDE_AVAILABLE to ${nearbyDrivers.length} drivers for ride ${payload.rideId}`
      );
    } catch (error) {
      logger.error('Error handling driver matching request:', error);
    }
  }

  private async handleRideOffered(payload: RideOfferedPayload): Promise<void> {
    logger.info(`Processing ride.offered for ride ${payload.rideId}`);

    const driverUserId = await this.resolveDriverUserId(payload.driverId);
    if (!driverUserId) {
      logger.warn(`Unable to resolve realtime recipient for driver ${payload.driverId}`);
      return;
    }

    this.socketServer.emitToDriver(driverUserId, 'NEW_RIDE_AVAILABLE', {
      rideId: payload.rideId,
      customerId: payload.customerId,
      pickup: payload.pickup,
      dropoff: payload.dropoff,
      estimatedFare: payload.fare,
      distance: payload.distance,
      duration: payload.duration,
      timeoutSeconds: payload.ttlSeconds ?? DEFAULT_OFFER_TIMEOUT_SECONDS,
      expiresAt: payload.expiresAt,
    });
  }

  private async handleRideAssigned(payload: RideEventPayload): Promise<void> {
    logger.info(`Processing ride.assigned for ride ${payload.rideId}`);

    const data = {
      rideId: payload.rideId,
      status: 'ASSIGNED',
      driverId: payload.driverId,
      message: 'A driver has been assigned to your ride',
    };

    this.socketServer.emitToCustomer(payload.customerId, 'RIDE_STATUS_UPDATE', data);

    const driverUserId = await this.resolveDriverUserId(payload.driverId);
    if (driverUserId) {
      this.socketServer.emitToDriver(driverUserId, 'ride:status', {
        rideId: payload.rideId,
        status: 'ASSIGNED',
      });
    }
  }

  private async handleRideOfferTimeout(payload: RideEventPayload & { timedOutDriverId?: string }): Promise<void> {
    logger.info(`Processing ride.offer_timeout for ride ${payload.rideId}`);

    if (payload.timedOutDriverId) {
      const driverUserId = await this.resolveDriverUserId(payload.timedOutDriverId);
      if (driverUserId) {
        this.socketServer.emitToDriver(driverUserId, 'ride:timeout', {
          rideId: payload.rideId,
        });
      }
    }

    this.socketServer.emitToCustomer(payload.customerId, 'RIDE_STATUS_UPDATE', {
      rideId: payload.rideId,
      status: 'FINDING_DRIVER',
      message: 'Looking for another driver',
    });
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

    const driverUserId = await this.resolveDriverUserId(payload.driverId);
    if (driverUserId) {
      this.socketServer.emitToDriver(driverUserId, 'ride:status', {
        rideId: payload.rideId,
        status: 'ACCEPTED',
      });
    }
  }

  private async handleRideStarted(payload: RideEventPayload): Promise<void> {
    logger.info(`Processing ride.started for ride ${payload.rideId}`);

    const data = {
      rideId: payload.rideId,
      status: 'IN_PROGRESS',
      message: 'Your ride has started',
    };

    this.socketServer.emitToCustomer(payload.customerId, 'RIDE_STATUS_UPDATE', data);

    const driverUserId = await this.resolveDriverUserId(payload.driverId);
    if (driverUserId) {
      this.socketServer.emitToDriver(driverUserId, 'ride:status', {
        rideId: payload.rideId,
        status: 'IN_PROGRESS',
      });
    }
  }

  private async handleRidePickingUp(payload: RideEventPayload): Promise<void> {
    logger.info(`Processing ride.picking_up for ride ${payload.rideId}`);

    const data = {
      rideId: payload.rideId,
      status: 'PICKING_UP',
      driverId: payload.driverId,
      message: 'Driver has arrived and is picking you up',
    };

    this.socketServer.emitToCustomer(payload.customerId, 'RIDE_STATUS_UPDATE', data);

    const driverUserId = await this.resolveDriverUserId(payload.driverId);
    if (driverUserId) {
      this.socketServer.emitToDriver(driverUserId, 'ride:status', {
        rideId: payload.rideId,
        status: 'PICKING_UP',
      });
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

    this.socketServer.emitToCustomer(payload.customerId, 'RIDE_COMPLETED', data);

    const driverUserId = await this.resolveDriverUserId(payload.driverId);
    if (driverUserId) {
      this.socketServer.emitToDriver(driverUserId, 'ride:status', {
        rideId: payload.rideId,
        status: 'COMPLETED',
      });
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

    const driverUserId = await this.resolveDriverUserId(payload.driverId);
    if (driverUserId) {
      this.socketServer.emitToDriver(driverUserId, 'ride:cancelled', {
        rideId: payload.rideId,
        reason: payload.status,
      });
    }
  }

  /**
   * Find nearby online drivers using Redis geospatial queries
   * Assumes driver locations are stored in Redis with GEOADD
   */
  private async findNearbyOnlineDrivers(
    location: { lat: number; lng: number },
    radiusMeters: number,
    excludeDriverIds: string[] = []
  ): Promise<DriverRecipient[]> {
    try {
      const results = await this.redis.georadius(
        DRIVER_GEO_KEY,
        location.lng,
        location.lat,
        radiusMeters,
        'm',
        'WITHDIST'
      );

      if (!results || results.length === 0) {
        return [];
      }

      const excluded = new Set(excludeDriverIds);
      const driverRecipients: DriverRecipient[] = [];

      for (const result of results) {
        const driverId = Array.isArray(result) ? result[0] : result;
        if (excluded.has(driverId)) {
          continue;
        }

        const userId = await this.resolveDriverUserId(driverId);
        if (userId && this.socketServer.isUserOnline(userId)) {
          driverRecipients.push({ driverId, userId });
        }
      }

      return driverRecipients;
    } catch (error) {
      logger.error('Error finding nearby drivers:', error);
      return [];
    }
  }

  private getMatchRadiusMeters(searchRadiusKm?: number): number {
    if (!searchRadiusKm || searchRadiusKm <= 0) {
      return DEFAULT_MATCH_RADIUS_METERS;
    }

    return Math.round(searchRadiusKm * 1000);
  }

  private async resolveDriverUserId(driverId?: string): Promise<string | null> {
    if (!driverId) {
      return null;
    }

    const cachedUserId = this.driverUserCache.get(driverId);
    if (cachedUserId) {
      return cachedUserId;
    }

    try {
      const response = await axios.get(`${config.services.driver}/internal/drivers/${driverId}`, {
        headers: {
          'x-internal-token': config.internalServiceToken,
        },
        timeout: 3000,
      });

      const userId = response.data?.data?.driver?.userId;
      if (userId) {
        this.driverUserCache.set(driverId, userId);
        return userId;
      }
    } catch (error) {
      logger.warn(`Failed to resolve driver ${driverId} to socket user`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return null;
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await (this.connection as any)?.close();
    await this.redis.quit();
    this.channel = null;
    this.connection = null;
    logger.info('EventConsumer closed');
  }
}
