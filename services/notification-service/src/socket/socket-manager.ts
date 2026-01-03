import { Server as SocketServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';

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
        if (role === 'driver') {
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
  emitToUser(userId: string, event: string, data: any): void {
    this.io.to(`user:${userId}`).emit(event, data);
    logger.debug(`Emitted ${event} to user:${userId}`);
  }

  // Emit to ride room
  emitToRide(rideId: string, event: string, data: any): void {
    this.io.to(`ride:${rideId}`).emit(event, data);
    logger.debug(`Emitted ${event} to ride:${rideId}`);
  }

  // Emit to role
  emitToRole(role: string, event: string, data: any): void {
    this.io.to(`role:${role}`).emit(event, data);
    logger.debug(`Emitted ${event} to role:${role}`);
  }

  // Emit to all drivers in area (for ride requests)
  emitToDrivers(event: string, data: any): void {
    this.io.to('role:driver').emit(event, data);
    logger.debug(`Emitted ${event} to all drivers`);
  }

  async close(): Promise<void> {
    await this.pubClient.quit();
    await this.subClient.quit();
    this.io.close();
    logger.info('Socket.IO closed');
  }
}
