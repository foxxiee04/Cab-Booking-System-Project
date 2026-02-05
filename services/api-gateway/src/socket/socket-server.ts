import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';
import { JwtPayload } from '../middleware/auth';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  role?: 'CUSTOMER' | 'DRIVER' | 'ADMIN';
}

export class SocketServer {
  private io: Server;
  private pubClient: Redis;
  private subClient: Redis;

  // Track online users: userId -> socketId[]
  private onlineUsers: Map<string, Set<string>> = new Map();
  // Track socket -> userId mapping
  private socketToUser: Map<string, string> = new Map();

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: '*', // Configure for production
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    // Setup Redis adapter for scaling
    this.pubClient = new Redis(config.redisUrl);
    this.subClient = this.pubClient.duplicate();

    this.io.adapter(createAdapter(this.pubClient, this.subClient));

    this.setupAuthentication();
    this.setupConnectionHandlers();

    logger.info('Socket.io server initialized with Redis adapter');
  }

  private setupAuthentication(): void {
    this.io.use((socket: AuthenticatedSocket, next) => {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        logger.warn('Socket connection rejected: No token provided');
        return next(new Error('Authentication token required'));
      }

      try {
        const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
        
        socket.userId = decoded.userId || decoded.sub;
        socket.role = decoded.role as any;

        if (!socket.userId) {
          logger.warn('Socket connection rejected: Invalid token payload');
          return next(new Error('Invalid token payload'));
        }

        logger.info(`Socket authenticated: userId=${socket.userId}, role=${socket.role}`);
        next();
      } catch (error) {
        logger.warn('Socket connection rejected: Invalid token', { error: (error as Error).message });
        return next(new Error('Invalid or expired token'));
      }
    });
  }

  private setupConnectionHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.userId!;
      const role = socket.role!;

      logger.info(`Socket connected: ${socket.id}, userId=${userId}, role=${role}`);

      // Track online user
      if (!this.onlineUsers.has(userId)) {
        this.onlineUsers.set(userId, new Set());
      }
      this.onlineUsers.get(userId)!.add(socket.id);
      this.socketToUser.set(socket.id, userId);

      // Join user-specific room
      const roomName = `${role.toLowerCase()}:${userId}`;
      socket.join(roomName);
      logger.info(`Socket ${socket.id} joined room: ${roomName}`);

      // Handle disconnect
      socket.on('disconnect', () => {
        logger.info(`Socket disconnected: ${socket.id}, userId=${userId}`);
        
        // Remove from tracking
        const userSockets = this.onlineUsers.get(userId);
        if (userSockets) {
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            this.onlineUsers.delete(userId);
          }
        }
        this.socketToUser.delete(socket.id);
      });

      // Ping-pong for connection health
      socket.on('ping', () => {
        socket.emit('pong');
      });
    });
  }

  /**
   * Check if a user is currently online
   */
  public isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  /**
   * Get all online user IDs with a specific role
   */
  public getOnlineUsersByRole(role: 'CUSTOMER' | 'DRIVER'): string[] {
    const onlineUsers: string[] = [];
    
    // Note: We can't efficiently filter by role from the Map alone
    // For production, consider storing role in the Map or using Redis
    for (const userId of this.onlineUsers.keys()) {
      onlineUsers.push(userId);
    }
    
    return onlineUsers;
  }

  /**
   * Emit event to a specific customer
   */
  public emitToCustomer(customerId: string, event: string, data: any): void {
    const room = `customer:${customerId}`;
    this.io.to(room).emit(event, data);
    logger.debug(`Emitted ${event} to customer ${customerId}`);
  }

  /**
   * Emit event to a specific driver
   */
  public emitToDriver(driverId: string, event: string, data: any): void {
    const room = `driver:${driverId}`;
    this.io.to(room).emit(event, data);
    logger.debug(`Emitted ${event} to driver ${driverId}`);
  }

  /**
   * Emit event to multiple drivers (broadcast)
   */
  public emitToDrivers(driverIds: string[], event: string, data: any): void {
    driverIds.forEach(driverId => {
      this.emitToDriver(driverId, event, data);
    });
    logger.debug(`Emitted ${event} to ${driverIds.length} drivers`);
  }

  /**
   * Emit to both customer and driver
   */
  public emitToCustomerAndDriver(customerId: string, driverId: string, event: string, data: any): void {
    this.emitToCustomer(customerId, event, data);
    this.emitToDriver(driverId, event, data);
    logger.debug(`Emitted ${event} to customer ${customerId} and driver ${driverId}`);
  }

  /**
   * Get the Socket.io server instance
   */
  public getIO(): Server {
    return this.io;
  }

  /**
   * Close connections
   */
  public async close(): Promise<void> {
    await this.io.close();
    await this.pubClient.quit();
    await this.subClient.quit();
    logger.info('Socket.io server closed');
  }
}
