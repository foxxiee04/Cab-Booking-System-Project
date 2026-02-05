import axiosInstance from './axios.config';
import axios from 'axios';
import { FareEstimate, Location } from '../types';

const AI_API_URL = process.env.REACT_APP_AI_API_URL || 'http://localhost:8000/api';

export interface EstimateRequest {
  pickup: Location;
  dropoff: Location;
  vehicleType?: string;
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

export interface AIPredictionRequest {
  distance_km: number;
  time_of_day: 'PEAK' | 'OFF_PEAK';
  day_type: 'WEEKDAY' | 'WEEKEND';
}

export interface AIPredictionResponse {
  eta_minutes: number;
  price_multiplier: number;
  distance_km: number;
  time_of_day: string;
  day_type: string;
}

export const pricingApi = {
  estimateFare: async (data: EstimateRequest): Promise<EstimateResponse> => {
    const response = await axiosInstance.post('/pricing/estimate', data);
    return response.data;
  },

  getSurge: async (): Promise<SurgeResponse> => {
    const response = await axiosInstance.get('/pricing/surge');
    return response.data;
  },

  predictWithAI: async (data: AIPredictionRequest): Promise<AIPredictionResponse> => {
    const response = await axios.post(`${AI_API_URL}/predict`, data);
    return response.data;
  },
};
