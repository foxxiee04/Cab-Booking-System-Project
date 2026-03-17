export interface BookingMapLocation {
  lat: number;
  lng: number;
  address?: string;
  placeId?: string;
}

export interface NearbyDriver {
  id: string;
  lat: number;
  lng: number;
  heading?: number;
  status?: string;
  vehicleType?: string;
}

export interface DriverLocationUpdate {
  driverId?: string;
  rideId?: string;
  lat: number;
  lng: number;
  heading?: number;
  speedKph?: number;
  timestamp?: string | number;
}

export interface RouteSummary {
  distanceMeters: number;
  durationSeconds: number;
  distanceText: string;
  durationText: string;
  polylinePath: google.maps.LatLngLiteral[];
}

export interface DriverLocationSocketPayload {
  driverId?: string;
  rideId?: string;
  lat?: number;
  lng?: number;
  heading?: number;
  location?: {
    lat?: number;
    lng?: number;
    heading?: number;
  };
  coordinates?: {
    lat?: number;
    lng?: number;
  };
  timestamp?: string | number;
}

export interface RideStatusSocketPayload {
  rideId: string;
  status: string;
  message?: string;
  driverId?: string;
}