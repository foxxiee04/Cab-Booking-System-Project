// User & Auth Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  role: 'DRIVER';
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

// Driver Types
export interface Driver {
  id: string;
  userId: string;
  vehicleType: VehicleType;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  licensePlate: string;
  licenseNumber: string;
  rating: number;
  totalRides: number;
  isOnline: boolean;
  isAvailable: boolean;
  currentLocation: Location | null;
  createdAt: string;
  updatedAt: string;
}

export type VehicleType = 'ECONOMY' | 'COMFORT' | 'PREMIUM';

export interface DriverRegistration {
  userId: string;
  vehicleType: VehicleType;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  licensePlate: string;
  licenseNumber: string;
}

// Location Types
export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

// Ride Types
export type RideStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface Ride {
  id: string;
  customerId: string;
  driverId: string | null;
  pickupLocation: Location;
  dropoffLocation: Location;
  status: RideStatus;
  vehicleType: VehicleType;
  fare: number;
  distance: number;
  duration: number;
  paymentMethod: PaymentMethod;
  paymentStatus: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  startedAt?: string;
  completedAt?: string;
  customer?: {
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    rating?: number;
  };
}

export type PaymentMethod = 'CASH' | 'CARD' | 'WALLET';

// Earnings Types
export interface Earnings {
  today: number;
  week: number;
  month: number;
  totalRides: number;
}

// Socket Event Types
export interface SocketEvents {
  // Driver receives
  'ride:new-request': (data: { ride: Ride; timeoutSeconds: number }) => void;
  'ride:timeout': (data: { rideId: string }) => void;
  'ride:cancelled': (data: { rideId: string; reason: string }) => void;
  'ride:reassigned': (data: { rideId: string }) => void;
  
  // Driver emits
  'driver:update-location': (data: { location: Location }) => void;
}

// Nominatim Types
export interface NominatimResult {
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

// Route Types
export interface RouteData {
  coordinates: [number, number][];
  distance: number;
  duration: number;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
}

// UI State Types
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}
