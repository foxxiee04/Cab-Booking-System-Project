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
      vehicleType: data.vehicleType || 'ECONOMY',
    });
    return response.data;
  },

  getSurge: async (): Promise<SurgeResponse> => {
    const response = await axiosInstance.get('/pricing/surge');
    return response.data;
  },

};
