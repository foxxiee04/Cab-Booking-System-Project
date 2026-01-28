import { Server as SocketServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Notification, NotificationType, NotificationStatus } from '../models/notification.model';

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

interface AuthenticatedSocket extends Socket {
  user?: JwtPayload;
}

export class SocketManager {
  private io: SocketServer;
  private pubClient: Redis;
  private subClient: Redis;

  constructor(io: SocketServer) {
    this.io = io;
    this.pubClient = new Redis(config.redisUrl);
    this.subClient = this.pubClient.duplicate();
  }

  async initialize(): Promise<void> {
    // Setup Redis adapter for horizontal scaling
    this.io.adapter(createAdapter(this.pubClient, this.subClient));

    // Authentication middleware
    this.io.use((socket: AuthenticatedSocket, next) => {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      try {
        const decoded = jwt.verify(token as string, config.jwtSecret) as JwtPayload;
        socket.user = decoded;
        next();
      } catch {
        next(new Error('Invalid token'));
      }
    });

    // Connection handler
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.user!.userId;
      const role = socket.user!.role;

      logger.info(`User connected: ${userId} (${role})`);

      // Join user's personal room
      socket.join(`user:${userId}`);

      // Join role-based room
      socket.join(`role:${role}`);

      // Handle ride room subscription
      socket.on('join:ride', (rideId: string) => {
        socket.join(`ride:${rideId}`);
        logger.debug(`User ${userId} joined ride room: ${rideId}`);
      });

      socket.on('leave:ride', (rideId: string) => {
        socket.leave(`ride:${rideId}`);
        logger.debug(`User ${userId} left ride room: ${rideId}`);
      });

      // Driver location update (for drivers only)
      socket.on('driver:location', (data: { lat: number; lng: number }) => {
        const isDriver = role && role.toUpperCase() === 'DRIVER';
        if (isDriver) {
          // Broadcast to subscribers tracking this driver
          socket.broadcast.to(`tracking:${userId}`).emit('driver:location:update', {
            driverId: userId,
            ...data,
            timestamp: new Date().toISOString(),
          });
        }
      });

      // Subscribe to driver tracking (for customers)
      socket.on('track:driver', (driverId: string) => {
        socket.join(`tracking:${driverId}`);
        logger.debug(`User ${userId} started tracking driver: ${driverId}`);
      });

      socket.on('untrack:driver', (driverId: string) => {
        socket.leave(`tracking:${driverId}`);
        logger.debug(`User ${userId} stopped tracking driver: ${driverId}`);
      });

      socket.on('disconnect', () => {
        logger.info(`User disconnected: ${userId}`);
      });
    });

    logger.info('Socket.IO initialized with Redis adapter');
  }

  // Emit to specific user
  async emitToUser(userId: string, event: string, data: any): Promise<void> {
    this.io.to(`user:${userId}`).emit(event, data);
    logger.debug(`Emitted ${event} to user:${userId}`);
    
    // Persist notification
    await this.persistNotification(userId, event, data);
  }

  // Emit to ride room
  async emitToRide(rideId: string, event: string, data: any): Promise<void> {
    this.io.to(`ride:${rideId}`).emit(event, data);
    logger.debug(`Emitted ${event} to ride:${rideId}`);
  }

  // Emit to role
  async emitToRole(role: string, event: string, data: any): Promise<void> {
    this.io.to(`role:${role}`).emit(event, data);
    logger.debug(`Emitted ${event} to role:${role}`);
  }

  // Emit to all drivers in area (for ride requests)
  async emitToDrivers(event: string, data: any): Promise<void> {
    this.io.to('role:driver').emit(event, data);
    logger.debug(`Emitted ${event} to all drivers`);
  }

  // Persist notification to MongoDB
  private async persistNotification(userId: string, event: string, data: any): Promise<void> {
    try {
      const notificationTypeMap: Record<string, NotificationType> = {
        'ride:request': NotificationType.RIDE_REQUEST,
        'ride:accepted': NotificationType.RIDE_ACCEPTED,
        'ride:started': NotificationType.RIDE_STARTED,
        'ride:completed': NotificationType.RIDE_COMPLETED,
        'ride:cancelled': NotificationType.RIDE_CANCELLED,
        'payment:success': NotificationType.PAYMENT_SUCCESS,
        'payment:failed': NotificationType.PAYMENT_FAILED,
        'driver:approved': NotificationType.DRIVER_APPROVED,
        'driver:rejected': NotificationType.DRIVER_REJECTED,
      };

      const type = notificationTypeMap[event] || NotificationType.SYSTEM_MESSAGE;

      await Notification.create({
        userId,
        type,
        title: data.title || event,
        message: data.message || JSON.stringify(data),
        data,
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      });
    } catch (error) {
      logger.error('Failed to persist notification:', error);
    }
  }

  async close(): Promise<void> {
    await this.pubClient.quit();
    await this.subClient.quit();
    this.io.close();
    logger.info('Socket.IO closed');
  }
}
