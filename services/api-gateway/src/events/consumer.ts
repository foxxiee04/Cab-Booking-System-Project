import amqp, { Channel, Connection, ConsumeMessage } from 'amqplib';
import { config } from '../config';
import { logger } from '../utils/logger';
import { SocketServer } from '../socket/socket-server';
import Redis from 'ioredis';
import { driverGrpcClient } from '../grpc/driver.client';
import {
  DriverMatcher,
  DriverCandidate,
  ScoredDriver,
  DriverStats,
  buildCandidate,
  driverStatsKey,
} from '../matching/driver-matcher';

const EXCHANGE_NAME = 'domain-events';
const QUEUE_NAME = 'api-gateway-events';
const DRIVER_GEO_KEY = 'drivers:geo:online';
const DEFAULT_MATCH_RADIUS_METERS = 5000;
const DEFAULT_OFFER_TIMEOUT_SECONDS = 30;

// Singleton matcher — sequential dispatch, top-5 candidates
const matcher = new DriverMatcher({ topN: 5, dispatchMode: 'sequential' });

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

function getCompatibleDriverVehicleTypes(requestedVehicleType?: string): string[] | null {
  switch ((requestedVehicleType || '').toUpperCase()) {
    case 'MOTORBIKE':
      return ['MOTORBIKE'];
    case 'SCOOTER':
      return ['SCOOTER'];
    case 'CAR_4':
      return ['CAR_4'];
    case 'CAR_7':
      return ['CAR_7'];
    // legacy fallback
    case 'ECONOMY':
      return ['MOTORBIKE'];
    case 'COMFORT':
      return ['CAR_4'];
    case 'PREMIUM':
      return ['CAR_7'];
    default:
      return null;
  }
}

function isCompatibleDriverVehicleType(driverVehicleType: string | undefined, requestedVehicleType?: string): boolean {
  const compatibleDriverTypes = getCompatibleDriverVehicleTypes(requestedVehicleType);
  if (!compatibleDriverTypes || !driverVehicleType) {
    return true;
  }

  return compatibleDriverTypes.includes(driverVehicleType.toUpperCase());
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
      // 1. Fetch all geo-candidates and enrich with stats
      const candidates = await this.buildCandidates(
        payload.pickup,
        this.getMatchRadiusMeters(payload.searchRadiusKm),
        payload.excludeDriverIds,
      );

      // 2. Score & rank — returns top-N ordered by composite score
      const result = matcher.match(candidates, payload.vehicleType);

      if (DriverMatcher.noDriverFound(result)) {
        logger.warn(`No suitable drivers found for ride ${payload.rideId} (candidates=${candidates.length})`);
        return;
      }

      const baseNotification = {
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

      if (result.dispatchMode === 'sequential') {
        // Sequential: offer to the best-scored driver only.
        // The ride-service will emit ride.offer_timeout → reassignment_requested
        // which re-triggers this handler with the timed-out driver in excludeDriverIds.
        const top = result.dispatchList[0];
        this.socketServer.emitToDriver(top.userId, 'NEW_RIDE_AVAILABLE', {
          ...baseNotification,
          etaMinutes: top.etaMinutes,
          etaText: top.etaText,
          driverScore: top.score.toFixed(3),
        });
        logger.info(
          `[Sequential] Dispatched to driver ${top.driverId} (score=${top.score.toFixed(3)}, ` +
          `eta=${top.etaText}, distance=${top.distanceKm.toFixed(2)} km) for ride ${payload.rideId}`,
        );
      } else {
        // Broadcast: push to all topN simultaneously (first-accept-wins).
        const userIds = result.dispatchList.map((d) => d.userId);
        this.socketServer.emitToDrivers(userIds, 'NEW_RIDE_AVAILABLE', baseNotification);
        logger.info(
          `[Broadcast] Dispatched to ${userIds.length} drivers for ride ${payload.rideId}`,
        );
      }

      logger.info(
        `Matching summary for ride ${payload.rideId}: ` +
        result.ranked.slice(0, 5).map(
          (d, i) => `#${i + 1} driver=${d.driverId} score=${d.score.toFixed(3)} eta=${d.etaText}`,
        ).join(' | '),
      );
    } catch (error) {
      logger.error('Error handling driver matching request:', error);
    }
  }

  /**
   * Build scored DriverCandidate list from Raw Redis geo results.
   * Enriches each candidate with stats (idle time, acceptance/cancel rates)
   * stored in driver:stats:{driverId} Redis hash.
   */
  private async buildCandidates(
    location: { lat: number; lng: number },
    radiusMeters: number,
    excludeDriverIds: string[] = [],
  ): Promise<DriverCandidate[]> {
    const geoResults = await this.redis.georadius(
      DRIVER_GEO_KEY,
      location.lng,
      location.lat,
      radiusMeters,
      'm',
      'WITHDIST',
      'ASC',
    ).catch(() => [] as any[]);

    if (!geoResults || geoResults.length === 0) return [];

    const excluded = new Set(excludeDriverIds);
    const candidates: DriverCandidate[] = [];

    for (const entry of geoResults) {
      const driverId = Array.isArray(entry) ? String(entry[0]) : String(entry);
      const distanceKm = Array.isArray(entry) ? parseFloat(entry[1]) / 1000 : 0;

      if (excluded.has(driverId)) continue;

      const driver = await driverGrpcClient.getDriverById(driverId).catch(() => null);
      if (!driver?.userId) continue;
      if (!this.socketServer.isUserOnline(driver.userId)) continue;

      // Cache userId
      this.driverUserCache.set(driverId, driver.userId);

      // Fetch stats from Redis hash
      const statsRaw = await this.redis.hgetall(driverStatsKey(driverId)).catch(() => null);
      const stats: DriverStats | null = statsRaw && Object.keys(statsRaw).length > 0
        ? {
            lastTripEndAt: parseInt(statsRaw.lastTripEndAt || '0', 10),
            totalAccepted: parseInt(statsRaw.totalAccepted || '0', 10),
            totalDeclined: parseInt(statsRaw.totalDeclined || '0', 10),
            totalCancelled: parseInt(statsRaw.totalCancelled || '0', 10),
          }
        : null;

      candidates.push(
        buildCandidate(
          driverId,
          driver.userId,
          driver.lastLocationLat ?? location.lat,
          driver.lastLocationLng ?? location.lng,
          distanceKm,
          driver.vehicleType ?? 'CAR',
          driver.ratingAverage ?? 5.0,
          stats,
        ),
      );
    }

    return candidates;
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
      // Count timeout as a declined offer for scoring purposes
      this.redis.hincrby(driverStatsKey(payload.timedOutDriverId), 'totalDeclined', 1).catch(() => {});
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

    // Track acceptance for scoring
    if (payload.driverId) {
      this.redis.hincrby(driverStatsKey(payload.driverId), 'totalAccepted', 1).catch(() => {});
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

    // Track idle-time start for future matching scoring
    if (payload.driverId) {
      this.redis.hset(driverStatsKey(payload.driverId), 'lastTripEndAt', String(Date.now())).catch(() => {});
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

    // Track driver-side cancellation (penalises cancel rate in future scoring)
    if (payload.driverId) {
      this.redis.hincrby(driverStatsKey(payload.driverId), 'totalCancelled', 1).catch(() => {});
    }
  }

  /**
   * Find nearby online drivers using Redis geospatial queries
   * Assumes driver locations are stored in Redis with GEOADD
   */
  /** @deprecated Use buildCandidates + matcher.match() instead */
  private async findNearbyOnlineDrivers(
    location: { lat: number; lng: number },
    radiusMeters: number,
    excludeDriverIds: string[] = [],
    requestedVehicleType?: string,
  ): Promise<DriverRecipient[]> {
    const candidates = await this.buildCandidates(location, radiusMeters, excludeDriverIds);
    return candidates
      .filter((c) => !requestedVehicleType || isCompatibleDriverVehicleType(c.vehicleType, requestedVehicleType))
      .map((c) => ({ driverId: c.driverId, userId: c.userId }));
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
      const driver = await driverGrpcClient.getDriverById(driverId);
      const userId = driver?.userId;
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
