import axiosInstance from './axios.config';

export interface POI {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  address?: string;
}

export interface POIQueryParams {
  lat: number;
  lng: number;
  radius?: number;
  types?: string[];
}

export const mapApi = {
  /**
   * Fetch POIs from backend (proxied Overpass API with Redis cache)
   */
  getPOIs: (params: POIQueryParams) => {
    return axiosInstance.get<{ success: boolean; data: { pois: POI[] } }>(
      '/map/pois',
      {
        params: {
          lat: params.lat,
          lng: params.lng,
          radius: params.radius || 2000,
          types: params.types?.join(',') || '',
        },
      }
    );
  },

  /**
   * Geocode an address → coordinates
   */
  geocode: (query: string, limit = 7) => {
    return axiosInstance.get('/map/geocode', {
      params: { q: query, limit },
    });
  },

  /**
   * Reverse geocode coordinates → address
   */
  reverseGeocode: (lat: number, lng: number) => {
    return axiosInstance.get('/map/reverse', {
      params: { lat, lng },
    });
  },
};
