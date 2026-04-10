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
  vehicleYear?: number;
  vehicleImageUrl?: string;
  licensePlate: string;
  licenseClass?: LicenseClass;
  licenseNumber: string;
  licenseExpiryDate?: string;
  status?: DriverApprovalStatus;
  rating: number;
  reviewCount?: number;
  totalRides: number;
  isOnline: boolean;
  isAvailable: boolean;
  currentLocation: Location | null;
  createdAt: string;
  updatedAt: string;
}

export type DriverApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type LicenseClass = 'A1' | 'A' | 'B' | 'C1' | 'C' | 'D1' | 'D2' | 'D' | 'BE' | 'C1E' | 'CE' | 'D1E' | 'D2E' | 'DE';

export type VehicleType = 'MOTORBIKE' | 'SCOOTER' | 'CAR_4' | 'CAR_7';

export interface DriverRegistration {
  vehicleType: VehicleType;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  vehicleYear: number;
  vehicleImageUrl?: string;
  licensePlate: string;
  licenseClass: LicenseClass;
  licenseNumber: string;
  licenseExpiryDate: string;
}

// Location Types
export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export interface NearbyDriver {
  id: string;
  lat: number;
  lng: number;
  vehicleType?: string;
  heading?: number;
}

// Ride Types
export type RideStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'PICKING_UP'
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
  vehicleType?: VehicleType;
  fare?: number;
  distance?: number;
  duration?: number;
  estimatedDuration?: number;
  paymentMethod?: PaymentMethod;
  paymentStatus?: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt?: string;
  updatedAt?: string;
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

export type PaymentMethod = 'CASH' | 'CARD' | 'WALLET' | 'MOMO' | 'VNPAY';

// Earnings Types
export interface EarningsDailyPoint {
  label: string;
  gross: number;
  commission: number;
  net: number;
  rides: number;
}

export interface EarningsTripBreakdown {
  rideId: string;
  completedAt: string;
  pickupAddress: string;
  dropoffAddress: string;
  gross: number;
  commission: number;
  net: number;
  paymentMethod?: PaymentMethod;
  vehicleType?: VehicleType;
}

export interface Earnings {
  today: number;
  week: number;
  month: number;
  totalRides: number;
  grossTotal: number;
  commissionTotal: number;
  netTotal: number;
  commissionRate: number;
  daily: EarningsDailyPoint[];
  recentTrips: EarningsTripBreakdown[];
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
