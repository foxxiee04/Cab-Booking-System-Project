/**
 * TrackAsia Routing Service
 * Provides real road navigation routes for vehicles
 */

const TRACKASIA_API_KEY = process.env.NEXT_PUBLIC_TRACKASIA_KEY || '6ce5471f943d628580a17695354821b1d4';
const ROUTING_BASE_URL = 'https://api.track-asia.com/v2';

export interface RouteResponse {
  coordinates: [number, number][]; // [lng, lat] pairs
  distance: number; // in meters
  duration: number; // in seconds
}

/**
 * Get driving route between two points
 * @param start Start coordinates {lat, lng}
 * @param end End coordinates {lat, lng}
 * @returns Route with coordinates, distance, and duration
 */
export async function getDrivingRoute(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number }
): Promise<RouteResponse | null> {
  try {
    // TrackAsia uses lng,lat format
    const coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`;
    
    const url = `${ROUTING_BASE_URL}/directions/driving/${coordinates}.json?key=${TRACKASIA_API_KEY}&overview=full&geometries=geojson`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('Routing API error:', response.status);
      // Fallback to straight line
      return {
        coordinates: [
          [start.lng, start.lat],
          [end.lng, end.lat],
        ],
        distance: calculateDistance(start, end) * 1000,
        duration: 0,
      };
    }

    const data = await response.json();
    
    if (!data.routes || data.routes.length === 0) {
      console.warn('No routes found');
      return null;
    }

    const route = data.routes[0];
    
    return {
      coordinates: route.geometry.coordinates,
      distance: route.distance,
      duration: route.duration,
    };
  } catch (error) {
    console.error('Error getting route:', error);
    // Fallback to straight line
    return {
      coordinates: [
        [start.lng, start.lat],
        [end.lng, end.lat],
      ],
      distance: calculateDistance(start, end) * 1000,
      duration: 0,
    };
  }
}

/**
 * Calculate straight-line distance between two points (Haversine formula)
 */
function calculateDistance(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number }
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(point2.lat - point1.lat);
  const dLng = toRad(point2.lng - point1.lng);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.lat)) *
      Math.cos(toRad(point2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}
