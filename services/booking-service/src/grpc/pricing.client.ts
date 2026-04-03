import axios from 'axios';
import { createGrpcClient, invokeUnary } from '../../../../shared/dist';
import { config } from '../config';
import { logger } from '../utils/logger';

interface EstimateFareRequest {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  vehicleType: 'MOTORBIKE' | 'SCOOTER' | 'CAR_4' | 'CAR_7';
}

export class PricingGrpcClient {
  private client: Record<string, any> | null = null;

  private getClient(): Record<string, any> | null {
    const address = config.grpcServices?.pricing;
    if (!address) {
      return null;
    }

    if (!this.client) {
      this.client = createGrpcClient<Record<string, any>>(
        'pricing.proto',
        'cab.booking.grpc.pricing',
        'PricingService',
        address,
      );
    }

    return this.client;
  }

  async estimateFare(payload: EstimateFareRequest): Promise<any> {
    const client = this.getClient();

    if (config.nodeEnv !== 'test' && client) {
      try {
        return await invokeUnary<EstimateFareRequest, any>(client, 'EstimateFare', payload, 1500);
      } catch (error) {
        logger.warn('gRPC pricing call failed, falling back to HTTP', error);
      }
    }

    const response = await axios.post(`${config.services.pricing}/api/pricing/estimate`, payload, {
      timeout: 5000,
    });

    return response.data.data;
  }
}

export const pricingGrpcClient = new PricingGrpcClient();