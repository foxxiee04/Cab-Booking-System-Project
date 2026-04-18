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

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  rideId?: string;
  persistMs?: number;
  createdAt: string;
  read: boolean;
}

export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export type VehicleType = 'MOTORBIKE' | 'SCOOTER' | 'CAR_4' | 'CAR_7';
export type PaymentMethod = 'CASH' | 'CARD' | 'WALLET' | 'MOMO' | 'VNPAY';

export type RideStatus = 
  | 'PENDING' 
  | 'CREATED'
  | 'FINDING_DRIVER'
  | 'OFFERED'
  | 'ASSIGNED' 
  | 'ACCEPTED' 
  | 'PICKING_UP'
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
  pickupLocation?: Location;
  dropoffLocation?: Location;
  vehicleType: VehicleType;
  paymentMethod: PaymentMethod;
  distance: number | null;
  duration: number | null;
  fare: number | null;
  estimatedFare?: number | null;
  estimatedDistance?: number | null;
  estimatedDuration?: number | null;
  surgeMultiplier: number;
  voucherCode?: string | null;
  requestedAt: string;
  assignedAt: string | null;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  updatedAt?: string | null;
  driver?: Driver | null;
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
  heading?: number;
  acceptanceRate?: number;
}

export interface FareEstimate {
  fare: number;
  distance: number;
  duration: number;
  surgeMultiplier: number;
  estimatedWaitMinutes?: number;
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
  discountAmount?: number | null;
  finalAmount?: number | null;
  driverEarnings?: {
    grossFare: number;
    commissionRate: number;
    platformFee: number;
    bonus: number;
    penalty: number;
    netEarnings: number;
    paymentMethod: string;
    driverCollected: boolean;
    cashDebt: number;
  } | null;
  method: PaymentMethod;
  provider?: 'MOCK' | 'STRIPE' | 'MOMO' | 'VNPAY' | 'ZALOPAY';
  status: 'PENDING' | 'PROCESSING' | 'REQUIRES_ACTION' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  transactionId?: string;
  voucherCode?: string | null;
  refundedAt?: string;
  updatedAt?: string;
  refund?: {
    provider?: string;
    amount?: number;
    description?: string;
    initiatedAt?: string;
    status?: string;
    /** MoMo: request ID gửi đến MoMo */
    requestId?: string;
    /** MoMo: orderId hoàn tiền (ro_...) */
    refundOrderId?: string;
    /** MoMo / VNPay: transactionId của giao dịch hoàn */
    refundTransactionId?: string;
    /** MoMo: result code (0 = thành công) */
    resultCode?: number;
    /** MoMo: message phản hồi */
    message?: string;
    /** VNPay: txnRef gốc (vnp_TxnRef) */
    txnRef?: string;
    /** VNPay: mã phản hồi hoàn tiền ('00' = thành công) */
    responseCode?: string;
    queryData?: Record<string, any> | null;
    providerResponse?: Record<string, any> | null;
  } | null;
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
