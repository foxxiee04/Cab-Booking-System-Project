import { createClient } from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';

export const redisClient = createClient({
  url: config.redis.url,
});

redisClient.on('error', (err: Error) => {
  logger.error('Redis Client Error', err);
});

redisClient.on('connect', () => {
  logger.info('Connected to Redis');
});

export async function connectRedis() {
  await redisClient.connect();
}
