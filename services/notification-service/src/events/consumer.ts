import { connect } from 'amqplib';
import type { Channel, Connection, ConsumeMessage } from 'amqplib';
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
    // Notify customer
    this.socketManager.emitToUser(payload.customerId, 'ride:driver_assigned', {
      rideId: payload.rideId,
      driverId: payload.driverId,
      driverName: payload.driverName,
      driverPhone: payload.driverPhone,
      vehicleInfo: payload.vehicleInfo,
      eta: payload.eta,
    });

    // Notify driver
    this.socketManager.emitToUser(payload.driverId, 'ride:assigned', {
      rideId: payload.rideId,
      customerId: payload.customerId,
      pickup: payload.pickup,
      destination: payload.destination,
    });
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
