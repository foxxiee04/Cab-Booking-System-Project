import axios from 'axios';
import { createGrpcClient, invokeUnary } from '../../../../shared/dist';
import { config } from '../config';

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

  async getDriverById(driverId: string): Promise<any | null> {
    const client = this.getClient();

    if (config.nodeEnv !== 'test' && client) {
      try {
        const response = await invokeUnary<{ driverId: string }, any>(client, 'GetDriverById', { driverId }, 1500);
        return response?.driver?.id ? response.driver : null;
      } catch {
        // fall through to HTTP fallback
      }
    }

    const response = await axios.get(`${config.services.driver}/internal/drivers/${driverId}`, {
      headers: {
        'x-internal-token': config.internalServiceToken,
      },
      timeout: 3000,
    });

    return response.data?.data?.driver ?? null;
  }
}

export const driverGrpcClient = new DriverGrpcClient();