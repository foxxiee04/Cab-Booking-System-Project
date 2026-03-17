import axios from 'axios';
import { createGrpcClient, invokeUnary } from '../../../../shared/dist';
import { config } from '../config';
import { logger } from '../utils/logger';

export class DriverGrpcClient {
  private client: Record<string, any> | null = null;

  private getClient(): Record<string, any> | null {
    const address = config.grpcServices?.driver;
    if (!address) {
      return null;
    }

    if (!this.client) {
      this.client = createGrpcClient<Record<string, any>>(
        'driver.proto',
        'cab.booking.grpc.driver',
        'DriverService',
        address,
      );
    }

    return this.client;
  }

  async getDriverByUserId(userId: string): Promise<any | null> {
    const client = this.getClient();

    if (config.nodeEnv !== 'test' && client) {
      try {
        const response = await invokeUnary<{ userId: string }, any>(client, 'GetDriverByUserId', { userId }, 1500);
        return response?.driver?.id ? response.driver : null;
      } catch (error) {
        logger.warn('gRPC driver lookup failed, falling back to HTTP');
      }
    }

    const response = await axios.get(`${config.services.driver}/internal/drivers/by-user/${userId}`, {
      headers: { 'x-internal-token': config.internalServiceToken },
      timeout: 3000,
    });

    return response.data?.data?.driver ?? null;
  }
}

export const driverGrpcClient = new DriverGrpcClient();