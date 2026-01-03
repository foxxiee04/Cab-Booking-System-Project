// Domain Events - Shared across all services
export enum EventType {
  // User/Auth events
  USER_REGISTERED = 'user.registered',
  USER_LOGGED_IN = 'user.logged_in',
  USER_ROLE_CHANGED = 'user.role_changed',

  // Ride events
  RIDE_CREATED = 'ride.created',
  RIDE_ASSIGNMENT_REQUESTED = 'ride.assignment.requested',
  RIDE_ASSIGNED = 'ride.assigned',
  RIDE_ACCEPTED = 'ride.accepted',
  RIDE_REJECTED = 'ride.rejected',
  RIDE_STARTED = 'ride.started',
  RIDE_COMPLETED = 'ride.completed',
  RIDE_CANCELLED = 'ride.cancelled',

  // Driver events
  DRIVER_ONLINE = 'driver.online',
  DRIVER_OFFLINE = 'driver.offline',
  DRIVER_LOCATION_UPDATED = 'driver.location.updated',
  DRIVER_BECAME_BUSY = 'driver.became_busy',
  DRIVER_BECAME_AVAILABLE = 'driver.became_available',

  // Payment events
  FARE_CALCULATED = 'fare.calculated',
  PAYMENT_INITIATED = 'payment.initiated',
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_FAILED = 'payment.failed',
  REFUND_COMPLETED = 'refund.completed',
}

export interface DomainEvent<T = unknown> {
  eventId: string;
  eventType: EventType;
  occurredAt: string;
  correlationId: string;
  causationId?: string;
  payload: T;
}

// Ride Status enum
export enum RideStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  ACCEPTED = 'ACCEPTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// Driver Status enum
export enum DriverStatus {
  OFFLINE = 'OFFLINE',
  ONLINE = 'ONLINE',
  BUSY = 'BUSY',
  SUSPENDED = 'SUSPENDED',
}

// Payment Status enum
export enum PaymentStatus {
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

// User Role enum
export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN',
}

// GeoPoint value object
export interface GeoPoint {
  lat: number;
  lng: number;
}

// Location with address
export interface Location {
  address: string;
  geoPoint: GeoPoint;
}

// Ride payload
export interface RidePayload {
  rideId: string;
  customerId: string;
  driverId?: string;
  pickup: Location;
  dropoff: Location;
  status: RideStatus;
  fare?: number;
  distance?: number;
  duration?: number;
}

// Driver location payload
export interface DriverLocationPayload {
  driverId: string;
  location: GeoPoint;
  heading?: number;
  speed?: number;
  timestamp: string;
}

// Payment payload
export interface PaymentPayload {
  paymentId: string;
  rideId: string;
  customerId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
}
