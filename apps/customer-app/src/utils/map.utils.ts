import axios from 'axios';
import { Location, NominatimResult, RouteData } from '../types';

const NOMINATIM_URL = process.env.REACT_APP_NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
const OSRM_URL = process.env.REACT_APP_OSRM_URL || 'http://router.project-osrm.org';

/**
 * Geocode address to coordinates (Forward Geocoding)
 */
export const geocodeAddress = async (address: string): Promise<Location[]> => {
  try {
    const response = await axios.get(`${NOMINATIM_URL}/search`, {
      params: {
        q: address,
        format: 'json',
        limit: 5,
        addressdetails: 1,
      },
      headers: {
        'User-Agent': 'CabBookingCustomerApp/1.0',
      },
    });

    const results: NominatimResult[] = response.data;
    return results.map((result) => ({
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      address: result.display_name,
    }));
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
    const response = await axios.get(`${NOMINATIM_URL}/reverse`, {
      params: {
        lat,
        lon: lng,
        format: 'json',
      },
      headers: {
        'User-Agent': 'CabBookingCustomerApp/1.0',
      },
    });

    return response.data.display_name || 'Unknown location';
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
  to: Location
): Promise<RouteData | null> => {
  try {
    const response = await axios.get(
      `${OSRM_URL}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}`,
      {
        params: {
          overview: 'full',
          geometries: 'geojson',
        },
      }
    );

    if (response.data.routes && response.data.routes.length > 0) {
      return {
        distance: response.data.routes[0].distance,
        duration: response.data.routes[0].duration,
        geometry: response.data.routes[0].geometry,
      };
    }

    return null;
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
