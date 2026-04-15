import axiosInstance from './axios.config';
import { NearbyDriver } from '../features/booking';
import { Driver } from '../types';

interface NearbyDriversResponse {
  success: boolean;
  data: {
    drivers: NearbyDriver[];
  };
}

export const driverApi = {
  getNearbyDrivers: async (params: {
    lat: number;
    lng: number;
    radius?: number;
  }): Promise<NearbyDriversResponse> => {
    const response = await axiosInstance.get('/drivers/nearby', { params });
    const payload = response.data?.data || response.data;
    const drivers = (payload?.drivers || [])
      .filter((driver: any) => driver?.id && driver?.lat != null && driver?.lng != null)
      .map((driver: any) => ({
        id: driver.id,
        lat: Number(driver.lat),
        lng: Number(driver.lng),
        status: driver.availabilityStatus,
        vehicleType: driver.vehicleType,
      }));

    return {
      ...response.data,
      data: { drivers },
    };
  },

  getDriverPublicProfile: async (driverId: string): Promise<Driver | null> => {
    try {
      const response = await axiosInstance.get(`/drivers/${driverId}/profile`);
      return response.data?.data?.driver ?? null;
    } catch {
      return null;
    }
  },
};