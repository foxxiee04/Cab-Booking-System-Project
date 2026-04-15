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
