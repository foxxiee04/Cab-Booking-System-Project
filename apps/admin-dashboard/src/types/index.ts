// User & Auth Types
export interface User {
  id: string;
  email: string | null;
  phone?: string;
  status?: string;
  avatar?: string | null;
  firstName: string | null;
  lastName: string | null;
  role: 'ADMIN';
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

// Stats Types
export interface SystemStats {
  rides: {
    total: number;
    today: number;
    pending: number;
    active: number;
    completed: number;
    cancelled: number;
  };
  drivers: {
    total: number;
    online: number;
    offline: number;
    busy: number;
  };
  customers: {
    total: number;
    active: number;
  };
  revenue: {
    total: number;
    today: number;
    week: number;
    month: number;
  };
  payments: {
    pending: number;
    completed: number;
    failed: number;
  };
}

// Ride Types
export type RideStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export interface Ride {
  id: string;
  customerId: string;
  driverId: string | null;
  pickupLocation: Location;
  dropoffLocation: Location;
  status: RideStatus;
  vehicleType: 'ECONOMY' | 'COMFORT' | 'PREMIUM';
  fare: number;
  distance: number;
  duration: number;
  paymentMethod: 'CASH' | 'CARD' | 'WALLET';
  paymentStatus: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
  customer?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  driver?: {
    firstName: string;
    lastName: string;
    vehicleMake: string;
    vehicleModel: string;
    licensePlate: string;
  };
}

// Driver Types
export interface Driver {
  id: string;
  userId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  vehicleType: 'MOTORBIKE' | 'SCOOTER' | 'CAR_4' | 'CAR_7';
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  vehicleYear?: number;
  vehicleImageUrl?: string;
  licensePlate: string;
  licenseClass?: 'A1' | 'A' | 'B' | 'C1' | 'C' | 'D1' | 'D2' | 'D' | 'BE' | 'C1E' | 'CE' | 'D1E' | 'D2E' | 'DE';
  licenseNumber: string;
  licenseExpiryDate?: string;
  rating: number;
  reviewCount: number;
  totalRides: number;
  isOnline: boolean;
  isAvailable: boolean;
  currentLocation: Location | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
  };
}

// Customer Types
export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  totalRides: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

// Payment Types
export interface Payment {
  id: string;
  rideId: string;
  amount: number;
  method: 'CASH' | 'CARD' | 'WALLET' | 'MOMO' | 'VNPAY';
  provider?: 'MOCK' | 'STRIPE' | 'MOMO' | 'VNPAY' | 'ZALOPAY';
  status: 'PENDING' | 'PROCESSING' | 'REQUIRES_ACTION' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  transactionId?: string;
  createdAt: string;
  updatedAt: string;
  refundedAt?: string;
  refund?: {
    provider?: string;
    amount?: number;
    description?: string;
    initiatedAt?: string;
    status?: string;
    requestId?: string;
    refundOrderId?: string;
    refundTransactionId?: string;
    resultCode?: number;
    message?: string;
  } | null;
  ride?: Ride;
}

// Pricing Types
export interface SurgePricing {
  multiplier: number;
  reason: string;
  validUntil: string;
  isActive: boolean;
}

// Chart Data Types
export interface ChartData {
  name: string;
  value: number;
}

export interface TimeSeriesData {
  time: string;
  rides: number;
  revenue: number;
  drivers: number;
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

// Socket Event Types
export interface SocketEvents {
  'ride:created': (data: { ride: Ride }) => void;
  'ride:completed': (data: { ride: Ride }) => void;
  'ride:cancelled': (data: { rideId: string }) => void;
  'driver:online': (data: { driverId: string }) => void;
  'driver:offline': (data: { driverId: string }) => void;
  'payment:completed': (data: { payment: Payment }) => void;
}

// UI State Types
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}
