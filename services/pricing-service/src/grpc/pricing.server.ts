import { createHealthServiceRegistration } from '../../../../shared/dist';
import { PricingService } from '../services/pricing.service';
import { config } from '../config';

export function createPricingGrpcRegistrations(
  pricingService: PricingService,
  getReadiness: () => Promise<Record<string, boolean>>,
) {
  return [
    createHealthServiceRegistration(config.serviceName, getReadiness),
    {
      protoFile: 'pricing.proto',
      packageName: 'cab.booking.grpc.pricing',
      serviceName: 'PricingService',
      implementation: {
        EstimateFare: async (
          call: { request: { pickupLat: number; pickupLng: number; dropoffLat: number; dropoffLng: number; vehicleType: 'MOTORBIKE' | 'SCOOTER' | 'CAR_4' | 'CAR_7' } },
          callback: (error: Error | null, response?: unknown) => void,
        ) => {
          try {
            const result = await pricingService.estimateFare(call.request);
            callback(null, result);
          } catch (error) {
            callback(error as Error);
          }
        },
      },
    },
  ];
}