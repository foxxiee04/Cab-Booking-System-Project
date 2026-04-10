import { axiosInstance } from './axios.config';

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

export interface ResolvedLocation {
  lat: number;
  lng: number;
  street: string;
  ward: string;
  province: string;
  ward_id: number | null;
  province_id: number | null;
  display_address: string;
  osm_place_id: string;
  source: 'OSM';
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
   * Geocode an address string → coordinates
   */
  geocode: (query: string, limit = 7) => {
    return axiosInstance.get('/map/geocode', {
      params: { q: query, limit },
    });
  },

  /**
   * Reverse geocode coordinates → address string
   */
  reverseGeocode: (lat: number, lng: number) => {
    return axiosInstance.get('/map/reverse', {
      params: { lat, lng },
    });
  },

  /**
   * Resolve lat/lng to Vietnam-2026 normalized administrative address.
   */
  resolveLocation: (lat: number, lng: number, snapToRoad = true) => {
    return axiosInstance.get<{ success: boolean; data: ResolvedLocation; meta?: { latency_ms: number } }>(
      '/location/resolve-location',
      {
        params: { lat, lng, snapToRoad },
      }
    );
  },
};
