// ============================================================================
// TYPES - Customer App
// ============================================================================

export interface User {
  id: string;
  email: string;
  role: 'CUSTOMER' | 'DRIVER' | 'ADMIN';
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  avatar?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export type VehicleType = 'ECONOMY' | 'COMFORT' | 'PREMIUM';
export type PaymentMethod = 'CASH' | 'MOMO' | 'VISA';

export type RideStatus = 
  | 'PENDING' 
  | 'ASSIGNED' 
  | 'ACCEPTED' 
  | 'IN_PROGRESS' 
  | 'COMPLETED' 
  | 'CANCELLED'
  | 'NO_DRIVER_AVAILABLE';

export interface Ride {
  id: string;
  customerId: string;
  driverId: string | null;
  status: RideStatus;
  pickup: Location;
  dropoff: Location;
  vehicleType: VehicleType;
  paymentMethod: PaymentMethod;
  distance: number | null;
  duration: number | null;
  fare: number | null;
  surgeMultiplier: number;
  requestedAt: string;
  assignedAt: string | null;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
}

export interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  avatar?: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  licensePlate: string;
  rating: number;
  totalRides: number;
  currentLocation?: Location;
}

export interface FareEstimate {
  fare: number;
  distance: number;
  duration: number;
  surgeMultiplier: number;
  breakdown?: {
    baseFare: number;
    distanceFare: number;
    timeFare: number;
    surgeFare: number;
  };
}

export interface Payment {
  id: string;
  rideId: string;
  amount: number;
  method: PaymentMethod;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  transactionId?: string;
  createdAt: string;
}

export interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    road?: string;
    suburb?: string;
    city?: string;
    country?: string;
  };
}

export interface RouteData {
  distance: number; // meters
  duration: number; // seconds
  geometry: {
    coordinates: [number, number][]; // [lng, lat]
  };
}

export interface SocketEvents {
  'ride:assigned': (data: { ride: Ride; driver: Driver }) => void;
  'ride:accepted': (data: { rideId: string }) => void;
  'ride:status': (data: { rideId: string; status: RideStatus }) => void;
  'driver:location': (data: { lat: number; lng: number }) => void;
  'ride:cancelled': (data: { rideId: string; reason: string }) => void;
}
