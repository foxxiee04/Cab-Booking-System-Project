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

interface RideSubscriptionPayload {
  rideId?: string;
}

interface DriverLocationPayload {
  rideId?: string;
  location?: {
    lat?: number;
    lng?: number;
    heading?: number;
  };
  lat?: number;
  lng?: number;
  heading?: number;
  timestamp?: number;
}

export class SocketServer {
  private io: Server;
  private pubClient: Redis;
  private subClient: Redis;

  // Track online users: userId -> socketId[]
  private onlineUsers: Map<string, Set<string>> = new Map();
  // Track socket -> userId mapping
  private socketToUser: Map<string, string> = new Map();

  // ── Location throttle ──────────────────────────────────────────────────────
  // Prevent a driver from flooding the room with GPS updates.
  // Only the first update in each LOCATION_THROTTLE_MS window is forwarded.
  private readonly LOCATION_THROTTLE_MS = 3_000;
  private lastLocationBroadcast: Map<string, number> = new Map(); // socketId → epoch ms

  // ── Redis online-presence TTL ──────────────────────────────────────────────
  // user:online:{userId} = role, expires after PRESENCE_TTL_S seconds.
  // Renewed on every ping from the client.
  private readonly PRESENCE_TTL_S = 60;

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

      // Publish online presence to Redis (survives across pods)
      this.pubClient.setex(`user:online:${userId}`, this.PRESENCE_TTL_S, role).catch(() => {});

      // Handle disconnect
      socket.on('disconnect', () => {
        logger.info(`Socket disconnected: ${socket.id}, userId=${userId}`);

        // Remove from tracking
        const userSockets = this.onlineUsers.get(userId);
        if (userSockets) {
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            this.onlineUsers.delete(userId);
            // Remove Redis presence only when the LAST socket for this user disconnects
            this.pubClient.del(`user:online:${userId}`).catch(() => {});
          }
        }
        this.socketToUser.delete(socket.id);
        this.lastLocationBroadcast.delete(socket.id);
      });

      // Ping-pong for connection health + presence renewal
      socket.on('ping', () => {
        socket.emit('pong');
        // Renew Redis presence TTL on each client heartbeat
        this.pubClient.setex(`user:online:${userId}`, this.PRESENCE_TTL_S, role).catch(() => {});
      });

      // Subscribe customer/driver socket into a ride-scoped room for realtime tracking.
      const subscribeToRideRoom = (payload: RideSubscriptionPayload) => {
        const rideId = payload?.rideId?.trim();
        if (!rideId) {
          return;
        }

        const rideRoom = `ride:${rideId}`;
        socket.join(rideRoom);
        logger.info(`Socket ${socket.id} joined room: ${rideRoom}`);
      };

      const unsubscribeFromRideRoom = (payload: RideSubscriptionPayload) => {
        const rideId = payload?.rideId?.trim();
        if (!rideId) {
          return;
        }

        const rideRoom = `ride:${rideId}`;
        socket.leave(rideRoom);
        logger.info(`Socket ${socket.id} left room: ${rideRoom}`);
      };

      socket.on('ride:subscribe', subscribeToRideRoom);
      socket.on('subscribe_ride_tracking', subscribeToRideRoom);
      socket.on('ride:unsubscribe', unsubscribeFromRideRoom);

      // ── In-ride Chat ──────────────────────────────────────────────────────────
      // Relay text messages between customer and driver inside an active ride room.
      socket.on('chat:send', (payload: { rideId?: string; message?: string }) => {
        const rideId = payload?.rideId?.trim();
        const message = payload?.message?.trim();
        if (!rideId || !message || message.length > 500) return;

        const rideRoom = `ride:${rideId}`;
        this.io.to(rideRoom).emit('chat:message', {
          from: userId,
          role,
          message,
          timestamp: Date.now(),
        });
        logger.debug(`Chat relay: userId=${userId} → room=${rideRoom}`);
      });

      // ── WebRTC Signaling (Voice Call) ─────────────────────────────────────────
      // Relay SDP offer/answer and ICE candidates between the two peers in a ride room.
      // The media stream is P2P — it never passes through this server.
      socket.on('call:offer', (payload: { rideId?: string; sdp?: unknown }) => {
        const rideId = payload?.rideId?.trim();
        if (!rideId || !payload.sdp) return;
        socket.to(`ride:${rideId}`).emit('call:offer', { from: userId, role, sdp: payload.sdp });
        logger.debug(`WebRTC offer relayed: userId=${userId} → ride:${rideId}`);
      });

      socket.on('call:answer', (payload: { rideId?: string; sdp?: unknown }) => {
        const rideId = payload?.rideId?.trim();
        if (!rideId || !payload.sdp) return;
        socket.to(`ride:${rideId}`).emit('call:answer', { from: userId, role, sdp: payload.sdp });
        logger.debug(`WebRTC answer relayed: userId=${userId} → ride:${rideId}`);
      });

      socket.on('call:ice-candidate', (payload: { rideId?: string; candidate?: unknown }) => {
        const rideId = payload?.rideId?.trim();
        if (!rideId || !payload.candidate) return;
        socket.to(`ride:${rideId}`).emit('call:ice-candidate', { from: userId, candidate: payload.candidate });
      });

      socket.on('call:end', (payload: { rideId?: string }) => {
        const rideId = payload?.rideId?.trim();
        if (!rideId) return;
        socket.to(`ride:${rideId}`).emit('call:end', { from: userId });
        logger.debug(`Call ended: userId=${userId} → ride:${rideId}`);
      });
      // ─────────────────────────────────────────────────────────────────────────

      socket.on('driver:update-location', (payload: DriverLocationPayload) => {
        if (role !== 'DRIVER') {
          logger.warn(`Rejected driver:update-location from non-driver socket ${socket.id}`);
          return;
        }

        // ── Rate limiter ────────────────────────────────────────────────────
        // Discard updates that arrive within LOCATION_THROTTLE_MS of the last
        // broadcast for this socket.  Drivers may send GPS events at up to 1 Hz;
        // customers only need a refresh every 3 s to animate the marker smoothly.
        const now = Date.now();
        const lastBroadcast = this.lastLocationBroadcast.get(socket.id) ?? 0;
        if (now - lastBroadcast < this.LOCATION_THROTTLE_MS) {
          return; // Too soon — drop this update silently
        }
        this.lastLocationBroadcast.set(socket.id, now);
        // ────────────────────────────────────────────────────────────────────

        const rideId = payload?.rideId?.trim();
        const lat = payload?.lat ?? payload?.location?.lat;
        const lng = payload?.lng ?? payload?.location?.lng;
        const heading = payload?.heading ?? payload?.location?.heading;

        if (!rideId || typeof lat !== 'number' || typeof lng !== 'number') {
          return;
        }

        const eventPayload = {
          rideId,
          lat,
          lng,
          heading,
          timestamp: payload?.timestamp ?? now,
        };

        const rideRoom = `ride:${rideId}`;
        this.io.to(rideRoom).emit('driver_location_update', eventPayload);
        this.io.to(rideRoom).emit('driver:location', eventPayload);
      });
    });
  }

  /**
   * Check if a user is currently online (in-process check).
   * Only reliable in single-pod deployments; use isUserOnlineRedis() for multi-pod.
   */
  public isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  /**
   * Check if a user is currently online via Redis presence key.
   * Works correctly in multi-pod / horizontally-scaled deployments.
   */
  public async isUserOnlineRedis(userId: string): Promise<boolean> {
    const exists = await this.pubClient.exists(`user:online:${userId}`);
    return exists === 1;
  }

  /**
   * Get the role of a connected user from Redis presence.
   * Returns null if the user is offline or the key has expired.
   */
  public async getUserRoleRedis(userId: string): Promise<string | null> {
    return this.pubClient.get(`user:online:${userId}`);
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

  public isReady(): boolean {
    return this.pubClient.status === 'ready' && this.subClient.status === 'ready';
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
