import { PrismaClient } from '../generated/prisma-client';

export const prisma = new PrismaClient();

export async function checkDatabaseReadiness(): Promise<boolean> {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return true;
  } catch {
    return false;
  }
}