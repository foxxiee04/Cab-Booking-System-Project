import { PrismaClient } from '../generated/prisma-client';
import { logger } from '../utils/logger';

export const prisma = new PrismaClient();

export async function connectDB() {
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL');
  } catch (error) {
    logger.error('PostgreSQL connection error:', error);
    throw error;
  }
}

export async function disconnectDB() {
  try {
    await prisma.$disconnect();
    logger.info('Disconnected from PostgreSQL');
  } catch (error) {
    logger.error('PostgreSQL disconnection error:', error);
    throw error;
  }
}

export async function checkDatabaseReadiness(): Promise<boolean> {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
