import { connect } from 'amqplib';
import type { Channel, Connection, ConsumeMessage } from 'amqplib';
import axios from 'axios';
import { config } from '../config';
import { SocketManager } from '../socket/socket-manager';
import { logger } from '../utils/logger';

export class EventConsumer {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private socketManager: SocketManager;
  private exchange = 'domain-events';
  private queue = 'notification-service-queue';

  constructor(socketManager: SocketManager) {
    this.socketManager = socketManager;
  }

  async connect(): Promise<void> {
    try {
      const connection = await connect(config.rabbitmqUrl);
      const channel = await connection.createChannel();

      this.connection = connection;
      this.channel = channel;
      
      await channel.assertExchange(this.exchange, 'topic', { durable: true });
      await channel.assertQueue(this.queue, { durable: true });
      
      // Subscribe to all relevant domain events
      const events = [
        'ride.created',
        'ride.assigned',
        'ride.accepted',
        'ride.started',
        'ride.completed',
        'ride.cancelled',
        'ride.assignment.requested',
        'payment.completed',
        'payment.failed',
        'driver.location.updated',
      ];

      for (const event of events) {
        await channel.bindQueue(this.queue, this.exchange, event);
      }
      
      await channel.prefetch(10);
      
      logger.info('Notification Service consumer connected to RabbitMQ');
      
      this.startConsuming();
    } catch (error) {
      logger.error('Failed to connect consumer to RabbitMQ:', error);
      throw error;
    }
  }

  private startConsuming(): void {
    const channel = this.channel;
    if (!channel) return;

    channel.consume(this.queue, async (msg: ConsumeMessage | null) => {
      if (!msg) return;

      try {
        const event = JSON.parse(msg.content.toString());
        const { eventType, payload } = event;

        logger.info(`Processing event: ${eventType}`);

        this.handleEvent(eventType, payload);
        channel.ack(msg);
      } catch (error) {
        logger.error('Error processing message:', error);
        channel.nack(msg, false, false); // Don't requeue bad messages
      }
    });
  }

  private getInternalHeaders(): Record<string, string> {
    if (!config.internalToken) return {};
    return { 'x-internal-token': config.internalToken };
  }

  private async fetchRideInternal(rideId: string): Promise<any | null> {
    try {
      const res = await axios.get(`${config.services.ride}/internal/rides/${rideId}`, {
        headers: this.getInternalHeaders(),
        timeout: 1500,
      });
      return res.data?.data?.ride ?? res.data?.ride ?? null;
    } catch (err) {
      logger.warn('Failed to fetch ride internal data', { rideId, error: err instanceof Error ? err.message : err });
      return null;
    }
  }

  private async fetchDriverInternal(driverIdOrUserId: string): Promise<any | null> {
    const headers = this.getInternalHeaders();

    // Try by userId first (most likely in this codebase)
    try {
      const res = await axios.get(`${config.services.driver}/internal/drivers/by-user/${driverIdOrUserId}`, {
        headers,
        timeout: 1500,
      });
      return res.data?.data?.driver ?? res.data?.driver ?? null;
    } catch {
      // ignore and try by driverId
    }

    try {
      const res = await axios.get(`${config.services.driver}/internal/drivers/${driverIdOrUserId}`, {
        headers,
        timeout: 1500,
      });
      return res.data?.data?.driver ?? res.data?.driver ?? null;
    } catch (err) {
      logger.warn('Failed to fetch driver internal data', { driverIdOrUserId, error: err instanceof Error ? err.message : err });
      return null;
    }
  }

  private async fetchUserInternal(userId: string): Promise<any | null> {
    try {
      const res = await axios.get(`${config.services.auth}/internal/users/${userId}`, {
        headers: this.getInternalHeaders(),
        timeout: 1500,
      });
      return res.data?.data?.user ?? res.data?.user ?? null;
    } catch (err) {
      logger.warn('Failed to fetch user internal data', { userId, error: err instanceof Error ? err.message : err });
      return null;
    }
  }

  private handleEvent(eventType: string, payload: any): void {
    switch (eventType) {
      case 'ride.created':
        this.handleRideCreated(payload);
        break;
      case 'ride.assigned':
        this.handleRideAssigned(payload);
        break;
      case 'ride.accepted':
        this.handleRideAccepted(payload);
        break;
      case 'ride.started':
        this.handleRideStarted(payload);
        break;
      case 'ride.completed':
        this.handleRideCompleted(payload);
        break;
      case 'ride.cancelled':
        this.handleRideCancelled(payload);
        break;
      case 'ride.assignment.requested':
        this.handleRideAssignmentRequested(payload);
        break;
      case 'payment.completed':
        this.handlePaymentCompleted(payload);
        break;
      case 'payment.failed':
        this.handlePaymentFailed(payload);
        break;
      case 'driver.location.updated':
        this.handleDriverLocationUpdated(payload);
        break;
      default:
        logger.warn(`Unhandled event type: ${eventType}`);
    }
  }

  private handleRideCreated(payload: any): void {
    this.socketManager.emitToUser(payload.customerId, 'ride:created', {
      rideId: payload.rideId,
      status: 'PENDING',
      message: 'Looking for nearby drivers...',
    });
  }

  private handleRideAssigned(payload: any): void {
    // Enrich from Ride/Driver services (internal) then emit
    void (async () => {
      const rideId = payload.rideId;
      const driverId = payload.driverId;
      const customerId = payload.customerId;

      const ridePromise = rideId ? this.fetchRideInternal(rideId) : Promise.resolve(null);
      const driverPromise = driverId ? this.fetchDriverInternal(driverId) : Promise.resolve(null);

      const [ride, driver] = await Promise.all([ridePromise, driverPromise]);

      const user = driver?.userId ? await this.fetchUserInternal(driver.userId) : null;

      const pickup = ride
        ? { lat: ride.pickupLat, lng: ride.pickupLng, address: ride.pickupAddress }
        : payload.pickup;

      const dropoff = ride
        ? { lat: ride.dropoffLat, lng: ride.dropoffLng, address: ride.dropoffAddress }
        : payload.dropoff;

      const driverName =
        user?.profile?.firstName || user?.profile?.lastName
          ? `${user?.profile?.firstName ?? ''} ${user?.profile?.lastName ?? ''}`.trim()
          : user?.email || payload.driverName;

      const driverPhone = user?.phone || payload.driverPhone;
      const vehicleInfo = driver?.vehicle || payload.vehicleInfo;

      // Notify customer
      this.socketManager.emitToUser(customerId, 'ride:driver_assigned', {
        rideId,
        driverId,
        driverName,
        driverPhone,
        vehicleInfo,
        pickup,
        dropoff,
      });

      // Notify driver (prefer driver.userId when available)
      const driverEmitUserId = driver?.userId || driverId;
      this.socketManager.emitToUser(driverEmitUserId, 'ride:assigned', {
        rideId,
        customerId,
        pickup,
        dropoff,
      });
    })();
  }

  private handleRideAccepted(payload: any): void {
    this.socketManager.emitToUser(payload.customerId, 'ride:accepted', {
      rideId: payload.rideId,
      driverId: payload.driverId,
      eta: payload.eta,
      message: 'Driver is on the way!',
    });
  }

  private handleRideStarted(payload: any): void {
    this.socketManager.emitToRide(payload.rideId, 'ride:started', {
      rideId: payload.rideId,
      startedAt: payload.startedAt,
      message: 'Ride has started',
    });
  }

  private handleRideCompleted(payload: any): void {
    this.socketManager.emitToRide(payload.rideId, 'ride:completed', {
      rideId: payload.rideId,
      fare: payload.fare,
      distance: payload.distance,
      duration: payload.duration,
      completedAt: payload.completedAt,
    });
  }

  private handleRideCancelled(payload: any): void {
    this.socketManager.emitToRide(payload.rideId, 'ride:cancelled', {
      rideId: payload.rideId,
      reason: payload.reason,
      cancelledBy: payload.cancelledBy,
    });
  }

  private handleRideAssignmentRequested(payload: any): void {
    // Broadcast to nearby drivers (in production, filter by location)
    this.socketManager.emitToDrivers('ride:new_request', {
      rideId: payload.rideId,
      pickup: payload.pickup,
      destination: payload.destination,
      estimatedFare: payload.estimatedFare,
    });
  }

  private handlePaymentCompleted(payload: any): void {
    // Notify customer
    this.socketManager.emitToUser(payload.customerId, 'payment:completed', {
      rideId: payload.rideId,
      amount: payload.amount,
      message: 'Payment successful!',
    });

    // Notify driver
    this.socketManager.emitToUser(payload.driverId, 'payment:received', {
      rideId: payload.rideId,
      amount: payload.amount,
      message: 'Payment received!',
    });
  }

  private handlePaymentFailed(payload: any): void {
    this.socketManager.emitToUser(payload.customerId, 'payment:failed', {
      rideId: payload.rideId,
      reason: payload.reason,
      message: 'Payment failed. Please try again.',
    });
  }

  private handleDriverLocationUpdated(payload: any): void {
    // This is handled directly via Socket.IO for real-time updates
    // RabbitMQ is backup for cross-instance sync
    if (payload.rideId) {
      this.socketManager.emitToRide(payload.rideId, 'driver:location', {
        driverId: payload.driverId,
        lat: payload.lat,
        lng: payload.lng,
        heading: payload.heading,
      });
    }
  }

  async close(): Promise<void> {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
    logger.info('Notification Service consumer disconnected');
  }
}
