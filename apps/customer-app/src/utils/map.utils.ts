import { Location, RouteData } from '../types';
import axiosInstance from '../api/axios.config';

/**
 * Geocode address to coordinates (Forward Geocoding)
 */
export const geocodeAddress = async (
  address: string,
  options?: { signal?: AbortSignal }
): Promise<Location[]> => {
  try {
    const response = await axiosInstance.get('/map/geocode', {
      params: { q: address, limit: 7 },
      signal: options?.signal,
    });

    return response.data?.data?.results || [];
  } catch (error) {
    console.error('Geocoding error:', error);
    return [];
  }
};

/**
 * Reverse geocode coordinates to address
 */
export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const response = await axiosInstance.get('/map/reverse', {
      params: { lat, lng },
    });

    return response.data?.data?.address || 'Unknown location';
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return 'Unknown location';
  }
};

/**
 * Get route between two locations
 */
export const getRoute = async (
  from: Location,
  to: Location,
  options?: { signal?: AbortSignal }
): Promise<RouteData | null> => {
  try {
    const response = await axiosInstance.get('/map/route', {
      params: {
        fromLat: from.lat,
        fromLng: from.lng,
        toLat: to.lat,
        toLng: to.lng,
      },
      signal: options?.signal,
    });

    return response.data?.data || null;
  } catch (error) {
    console.error('Routing error:', error);
    return null;
  }
};

/**
 * Calculate distance between two points (Haversine formula)
 */
export const calculateDistance = (from: Location, to: Location): number => {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.lat)) *
      Math.cos(toRad(to.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100; // Round to 2 decimals
};

const toRad = (degrees: number): number => {
  return (degrees * Math.PI) / 180;
};

/**
 * Format distance for display
 */
export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
};

/**
 * Format duration for display
 */
export const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
};

/**
 * Get current location from browser
 */
export const getCurrentLocation = (): Promise<Location> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
};

/**
 * Check if location is valid
 */
export const isValidLocation = (location: Location): boolean => {
  return (
    location.lat >= -90 &&
    location.lat <= 90 &&
    location.lng >= -180 &&
    location.lng <= 180
  );
};
