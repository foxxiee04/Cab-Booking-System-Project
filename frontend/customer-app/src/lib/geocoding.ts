/**
 * TrackAsia Geocoding Service
 * Provides location search and reverse geocoding using TrackAsia API
 */

const TRACKASIA_API_KEY = process.env.NEXT_PUBLIC_TRACKASIA_KEY || '6ce5471f943d628580a17695354821b1d4';
const GEOCODING_BASE_URL = 'https://api.track-asia.com/v2';

export interface LocationSuggestion {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  placeType?: string;
}

export interface GeocodingResult {
  lat: number;
  lng: number;
  address: string;
  name: string;
}

/**
 * Search for locations based on user input
 * @param query Search query string
 * @param limit Maximum number of results (default: 5)
 * @returns Array of location suggestions
 */
export async function searchLocations(query: string, limit: number = 5): Promise<LocationSuggestion[]> {
  // Bỏ gọi API, luôn trả về 2 địa chỉ mẫu để test nghiệp vụ
  return [
    {
      id: '1',
      name: 'Bến xe Miền Đông',
      address: '292 Đinh Bộ Lĩnh, Bình Thạnh, TP.HCM',
      lat: 10.8022,
      lng: 106.7113,
      placeType: 'place',
    },
    {
      id: '2',
      name: 'Chợ Bến Thành',
      address: 'Lê Lợi, Bến Thành, Quận 1, TP.HCM',
      lat: 10.7721,
      lng: 106.6983,
      placeType: 'place',
    },
  ];
}

/**
 * Get address from coordinates (Reverse Geocoding)
 * @param lat Latitude
 * @param lng Longitude
 * @returns Address information
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodingResult | null> {
  try {
    const url = `${GEOCODING_BASE_URL}/reverse/${lng},${lat}.json?key=${TRACKASIA_API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('Reverse geocoding error:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      return null;
    }

    const feature = data.features[0];
    
    return {
      lat,
      lng,
      address: feature.place_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      name: feature.text || feature.place_name || '',
    };
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    return null;
  }
}

/**
 * Get popular places in Ho Chi Minh City for quick selection
 */
export function getPopularPlaces(): LocationSuggestion[] {
  return [
    {
      id: 'ben-thanh',
      name: 'Chợ Bến Thành',
      address: 'Bến Thành, Quận 1, TP.HCM',
      lat: 10.7726,
      lng: 106.6980,
      placeType: 'landmark',
    },
    {
      id: 'tan-son-nhat',
      name: 'Sân bay Tân Sơn Nhất',
      address: 'Tân Bình, TP.HCM',
      lat: 10.8188,
      lng: 106.6519,
      placeType: 'airport',
    },
    {
      id: 'nha-tho-duc-ba',
      name: 'Nhà thờ Đức Bà',
      address: 'Quận 1, TP.HCM',
      lat: 10.7798,
      lng: 106.6990,
      placeType: 'landmark',
    },
    {
      id: 'pham-ngu-lao',
      name: 'Phạm Ngũ Lão',
      address: 'Quận 1, TP.HCM',
      lat: 10.7676,
      lng: 106.6909,
      placeType: 'neighborhood',
    },
    {
      id: 'landmark-81',
      name: 'Landmark 81',
      address: 'Bình Thạnh, TP.HCM',
      lat: 10.7948,
      lng: 106.7218,
      placeType: 'landmark',
    },
  ];
}
