import axiosInstance from './axios.config';
import { FareEstimate, Location, VehicleType } from '../types';

export interface EstimateRequest {
  pickup: Location;
  dropoff: Location;
  vehicleType?: VehicleType;
}

export interface EstimateResponse {
  success: boolean;
  data: FareEstimate;
}

export interface SurgeResponse {
  success: boolean;
  data: {
    multiplier: number;
    activeRides?: number;
    availableDrivers?: number;
  };
}

export const pricingApi = {
  estimateFare: async (data: EstimateRequest): Promise<EstimateResponse> => {
    const response = await axiosInstance.post('/pricing/estimate', {
      pickupLat: data.pickup.lat,
      pickupLng: data.pickup.lng,
      dropoffLat: data.dropoff.lat,
      dropoffLng: data.dropoff.lng,
      vehicleType: data.vehicleType || 'CAR_4',
    });
    const payload = response.data || {};
    const rawEstimate = payload?.data?.data || payload?.data || {};

    const fare = Number(rawEstimate.fare);
    const distance = Number(rawEstimate.distance);
    const duration = Number(rawEstimate.duration);
    const surgeMultiplier = Number(rawEstimate.surgeMultiplier);

    return {
      success: Boolean(payload?.success ?? true),
      data: {
        fare: Number.isFinite(fare) ? fare : 0,
        distance: Number.isFinite(distance) ? distance : 0,
        duration: Number.isFinite(duration) ? duration : 0,
        surgeMultiplier: Number.isFinite(surgeMultiplier) && surgeMultiplier > 0 ? surgeMultiplier : 1,
        breakdown: rawEstimate.breakdown
          ? {
              baseFare: Number(rawEstimate.breakdown.baseFare) || 0,
              distanceFare: Number(rawEstimate.breakdown.distanceFare) || 0,
              timeFare: Number(rawEstimate.breakdown.timeFare) || 0,
              surgeFare: Number(rawEstimate.breakdown.surgeFare ?? rawEstimate.breakdown.surgeAmount) || 0,
            }
          : undefined,
      },
    };
  },

  getSurge: async (): Promise<SurgeResponse> => {
    const response = await axiosInstance.get('/pricing/surge');
    return response.data;
  },

};
