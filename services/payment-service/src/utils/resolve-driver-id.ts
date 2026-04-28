import axios from 'axios';
import { config } from '../config';
import { logger } from './logger';

/**
 * Resolve the driver profile entity ID from the auth user ID.
 *
 * The DriverEarnings / DriverWallet tables store `driverId` as the
 * driver-service profile UUID, which is different from the auth userId.
 * This helper calls the driver-service internal endpoint to map one to
 * the other.  Falls back to userId when the lookup fails (legacy data
 * may still use userId as driverId).
 */
export async function resolveDriverId(userId: string): Promise<string> {
  try {
    const { data } = await axios.get(
      `${config.services.driver}/internal/drivers/by-user/${userId}`,
      {
        headers: { 'x-internal-token': config.internalServiceToken },
        timeout: 3000,
      },
    );

    const driverId = data?.data?.driver?.id;
    if (driverId) return driverId;
  } catch (err) {
    logger.warn(`resolveDriverId: failed to look up driver for userId=${userId}, falling back to userId`, err);
  }

  // Fallback: legacy rows may have stored userId directly as driverId
  return userId;
}

/**
 * Resolve the auth userId from a driver profile entity ID.
 *
 * wallet-service stores DriverWallet rows keyed by the auth userId,
 * but the ride/payment event chain carries the driver-service profile ID.
 * This helper reverses the mapping so wallet credits/debits hit the
 * correct wallet row.  Returns null on failure so the caller can
 * fall back to the profileId (which may work for legacy/seed data).
 */
export async function resolveDriverUserId(profileId: string): Promise<string | null> {
  try {
    const { data } = await axios.get(
      `${config.services.driver}/internal/drivers/${profileId}`,
      {
        headers: { 'x-internal-token': config.internalServiceToken },
        timeout: 3000,
      },
    );

    const userId = data?.data?.driver?.userId;
    if (userId) return userId;
  } catch (err) {
    logger.warn(`resolveDriverUserId: failed to look up userId for profileId=${profileId}`, err);
  }

  return null;
}
