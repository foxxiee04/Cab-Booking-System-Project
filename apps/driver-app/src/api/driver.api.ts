import axiosInstance from './axios.config';
import { ApiResponse, Driver, DriverRegistration, Location, Earnings } from '../types';

const mapVehicleType = (type: DriverRegistration['vehicleType']): 'CAR' | 'SUV' | 'MOTORCYCLE' => {
  switch (type) {
    case 'ECONOMY':
      return 'CAR';
    case 'COMFORT':
      return 'CAR';
    case 'PREMIUM':
      return 'SUV';
    case 'CAR':
      return 'CAR';
    case 'SUV':
      return 'SUV';
    case 'MOTORCYCLE':
      return 'MOTORCYCLE';
    default:
      return 'CAR';
  }
};

export const driverApi = {
  // Register as driver (complete profile)
  registerDriver: async (data: DriverRegistration): Promise<ApiResponse<{ driver: Driver }>> => {
    const payload = {
      vehicle: {
        type: mapVehicleType(data.vehicleType),
        brand: data.vehicleMake,
        model: data.vehicleModel,
        color: data.vehicleColor,
        plate: data.licensePlate,
        year: data.vehicleYear || new Date().getFullYear(),
      },
      license: {
        number: data.licenseNumber,
        expiryDate: data.licenseExpiryDate,
      },
    };
    const response = await axiosInstance.post('/drivers/register', payload);
    return response.data;
  },

  // Get driver profile
  getProfile: async (): Promise<ApiResponse<{ driver: Driver }>> => {
    const response = await axiosInstance.get('/drivers/me');
    return response.data;
  },

  // Update driver profile
  updateProfile: async (data: Partial<Driver>): Promise<ApiResponse<{ driver: Driver }>> => {
    const response = await axiosInstance.put('/drivers/me', data);
    return response.data;
  },

  // Go online
  goOnline: async (): Promise<ApiResponse<{ driver: Driver }>> => {
    const response = await axiosInstance.post('/drivers/me/online');
    return response.data;
  },

  // Go offline
  goOffline: async (): Promise<ApiResponse<{ driver: Driver }>> => {
    const response = await axiosInstance.post('/drivers/me/offline');
    return response.data;
  },

  // Update location
  updateLocation: async (location: Location): Promise<ApiResponse> => {
    const response = await axiosInstance.post('/drivers/me/location', {
      lat: location.lat,
      lng: location.lng,
    });
    return response.data;
  },

  // Get earnings - Using alternative endpoint since /drivers/me/earnings doesn't exist
  getEarnings: async (): Promise<ApiResponse<{ earnings: Earnings }>> => {
    // Backend doesn't have dedicated earnings endpoint yet
    // Calculate from completed rides via driver history
    try {
      const ridesResponse = await axiosInstance.get('/rides/driver/history', { 
        params: { status: 'COMPLETED', limit: 1000 } 
      });
      
      const completedRides = ridesResponse.data.data?.rides || [];
      const totalEarnings = completedRides.reduce((sum: number, ride: any) => sum + (ride.fare || 0), 0);
      const todayEarnings = completedRides
        .filter((r: any) => {
          const rideDate = new Date(r.completedAt || r.updatedAt);
          const today = new Date();
          return rideDate.toDateString() === today.toDateString();
        })
        .reduce((sum: number, ride: any) => sum + (ride.fare || 0), 0);
      
      return {
        success: true,
        data: {
          earnings: {
            today: todayEarnings,
            week: totalEarnings, // Simplified: treat all as weekly
            month: totalEarnings,
            totalRides: completedRides.length,
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        data: {
          earnings: {
            today: 0,
            week: 0,
            month: 0,
            totalRides: 0,
          }
        }
      };
    }
  },

  // Get ride history - Using /rides/driver/history endpoint
  getRideHistory: async (params?: {
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<{ rides: any[]; total: number }>> => {
    // Use driver-specific ride history endpoint
    const response = await axiosInstance.get('/rides/driver/history', { 
      params: {
        ...params,
        // Include all relevant statuses for driver history
        status: ['COMPLETED', 'CANCELLED'].join(',')
      } 
    });
    
    const ridesData = response.data.data || response.data;
    return {
      ...response.data,
      data: {
        rides: ridesData.rides || [],
        total: ridesData.total || 0,
      }
    };
  },
};
