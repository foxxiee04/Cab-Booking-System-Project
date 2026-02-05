import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Manages driver offer TTLs and tracking using Redis
 * Handles automatic timeout and re-assignment triggering
 */
export class DriverOfferManager {
  private redis: Redis;
  private readonly OFFER_TTL_SECONDS = 20; // 20 seconds for driver to respond
  private readonly MAX_REASSIGN_ATTEMPTS = 3;
  private readonly OFFER_KEY_PREFIX = 'ride:offer:';
  private readonly OFFERED_DRIVERS_PREFIX = 'ride:offered:';
  
  constructor(redis?: Redis) {
    this.redis = redis || new Redis(config.redis.url);
    
    this.redis.on('error', (err) => {
      logger.error('Redis error in DriverOfferManager:', err);
    });
  }

  /**
   * Create an offer for a driver with TTL
   * @param rideId The ride ID
   * @param driverId The driver being offered
   * @param ttlSeconds Optional TTL override (default: 20s)
   */
  async createOffer(rideId: string, driverId: string, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds || this.OFFER_TTL_SECONDS;
    const offerKey = `${this.OFFER_KEY_PREFIX}${rideId}`;
    
    // Store the current offer with TTL
    await this.redis.setex(
      offerKey,
      ttl,
      JSON.stringify({
        rideId,
        driverId,
        offeredAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
      })
    );

    // Add to offered drivers set (permanent record for this ride)
    await this.redis.sadd(`${this.OFFERED_DRIVERS_PREFIX}${rideId}`, driverId);

    logger.info(`Offer created for driver ${driverId} on ride ${rideId} with TTL ${ttl}s`);
  }

  /**
   * Accept an offer (removes TTL key)
   */
  async acceptOffer(rideId: string, driverId: string): Promise<boolean> {
    const offerKey = `${this.OFFER_KEY_PREFIX}${rideId}`;
    const offer = await this.getOffer(rideId);

    if (!offer) {
      logger.warn(`No active offer found for ride ${rideId}`);
      return false;
    }

    if (offer.driverId !== driverId) {
      logger.warn(`Driver ${driverId} tried to accept offer for ride ${rideId} but was not offered`);
      return false;
    }

    // Remove the offer key (accepted)
    await this.redis.del(offerKey);
    logger.info(`Driver ${driverId} accepted offer for ride ${rideId}`);
    return true;
  }

  /**
   * Cancel an offer (removes TTL key, adds to rejected list)
   */
  async cancelOffer(rideId: string, reason: 'timeout' | 'rejected' | 'manual' = 'manual'): Promise<string | null> {
    const offerKey = `${this.OFFER_KEY_PREFIX}${rideId}`;
    const offer = await this.getOffer(rideId);

    if (!offer) {
      return null;
    }

    // Add to rejected drivers
    await this.redis.sadd(`ride:rejected:${rideId}`, offer.driverId);

    // Remove offer key
    await this.redis.del(offerKey);

    logger.info(`Offer cancelled for ride ${rideId}, driver ${offer.driverId}, reason: ${reason}`);
    return offer.driverId;
  }

  /**
   * Get current active offer
   */
  async getOffer(rideId: string): Promise<{ rideId: string; driverId: string; offeredAt: string; expiresAt: string } | null> {
    const offerKey = `${this.OFFER_KEY_PREFIX}${rideId}`;
    const data = await this.redis.get(offerKey);

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to parse offer data:', error);
      return null;
    }
  }

  /**
   * Check if a driver has already been offered this ride
   */
  async hasBeenOffered(rideId: string, driverId: string): Promise<boolean> {
    const result = await this.redis.sismember(`${this.OFFERED_DRIVERS_PREFIX}${rideId}`, driverId);
    return result === 1;
  }

  /**
   * Get all drivers who have been offered (including rejected/timed out)
   */
  async getOfferedDrivers(rideId: string): Promise<string[]> {
    return await this.redis.smembers(`${this.OFFERED_DRIVERS_PREFIX}${rideId}`);
  }

  /**
   * Get all drivers who rejected or timed out
   */
  async getRejectedDrivers(rideId: string): Promise<string[]> {
    return await this.redis.smembers(`ride:rejected:${rideId}`);
  }

  /**
   * Get remaining TTL for an offer
   */
  async getRemainingTTL(rideId: string): Promise<number> {
    const offerKey = `${this.OFFER_KEY_PREFIX}${rideId}`;
    const ttl = await this.redis.ttl(offerKey);
    return ttl > 0 ? ttl : 0;
  }

  /**
   * Check if offer has expired
   */
  async hasExpired(rideId: string): Promise<boolean> {
    const offerKey = `${this.OFFER_KEY_PREFIX}${rideId}`;
    const exists = await this.redis.exists(offerKey);
    return exists === 0;
  }

  /**
   * Setup keyspace notifications for TTL expiration
   * This enables automatic timeout detection
   */
  async setupExpirationNotifications(): Promise<void> {
    // Enable keyspace notifications for expired events
    try {
      await this.redis.config('SET', 'notify-keyspace-events', 'Ex');
      logger.info('Redis keyspace notifications enabled for offer expiration');
    } catch (error) {
      logger.warn('Failed to enable keyspace notifications:', error);
    }
  }

  /**
   * Subscribe to offer expiration events
   * Returns a new Redis client for subscriptions (pub/sub requires separate connection)
   */
  async subscribeToExpirations(callback: (rideId: string) => Promise<void>): Promise<Redis> {
    const subscriber = new Redis(config.redis.url);
    
    // Subscribe to expired events for our offer keys
    const pattern = `__keyevent@0__:expired`;
    await subscriber.psubscribe(pattern);

    subscriber.on('pmessage', async (pattern, channel, expiredKey) => {
      // Check if this is one of our offer keys
      if (expiredKey.startsWith(this.OFFER_KEY_PREFIX)) {
        const rideId = expiredKey.replace(this.OFFER_KEY_PREFIX, '');
        logger.info(`Offer expired for ride ${rideId}`);
        
        try {
          await callback(rideId);
        } catch (error) {
          logger.error(`Error handling offer expiration for ride ${rideId}:`, error);
        }
      }
    });

    logger.info('Subscribed to Redis key expiration events');
    return subscriber;
  }

  /**
   * Clean up offer data for a ride (call after ride is completed/cancelled)
   */
  async cleanup(rideId: string): Promise<void> {
    await this.redis.del(
      `${this.OFFER_KEY_PREFIX}${rideId}`,
      `${this.OFFERED_DRIVERS_PREFIX}${rideId}`,
      `ride:rejected:${rideId}`
    );
    logger.debug(`Cleaned up offer data for ride ${rideId}`);
  }

  /**
   * Get max reassignment attempts allowed
   */
  getMaxReassignAttempts(): number {
    return this.MAX_REASSIGN_ATTEMPTS;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}
