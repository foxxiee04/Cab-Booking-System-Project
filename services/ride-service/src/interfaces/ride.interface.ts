import { RideStatus } from '../generated/prisma-client';

// Location interface
export interface ILocation {
  lat: number;
  lng: number;
  address?: string;
}

// Ride Entity interface
export interface IRide {
  id: string;
  customerId: string;
  driverId: string | null;
  status: RideStatus;
  pickup: ILocation;
  dropoff: ILocation;
  distance: number | null;
  duration: number | null;
  fare: number | null;
  surgeMultiplier: number;
  requestedAt: Date;
  assignedAt: Date | null;
  acceptedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  cancelledBy: string | null;
}

// Service interfaces
export interface IRideService {
  createRide(input: ICreateRideInput): Promise<IRide>;
  getRideById(rideId: string): Promise<IRide | null>;
  acceptRide(rideId: string, driverId: string): Promise<IRide>;
  rejectRide(rideId: string, driverId: string): Promise<IRide>;
  startRide(rideId: string, driverId: string): Promise<IRide>;
  completeRide(rideId: string, driverId: string): Promise<IRide>;
  cancelRide(rideId: string, userId: string, userType: 'CUSTOMER' | 'DRIVER', reason?: string): Promise<IRide>;
  getActiveRideForCustomer(customerId: string): Promise<IRide | null>;
  getActiveRideForDriver(driverId: string): Promise<IRide | null>;
  getCustomerRides(customerId: string, page: number, limit: number): Promise<{ rides: IRide[]; total: number }>;
}

export interface ICreateRideInput {
  customerId: string;
  pickup: ILocation;
  dropoff: ILocation;
  vehicleType?: string;
  paymentMethod?: string;
}

// Event interfaces
export interface IRideEvent {
  rideId: string;
  timestamp: Date;
}

export interface IRideCreatedEvent extends IRideEvent {
  customerId: string;
  pickup: ILocation;
  dropoff: ILocation;
  estimatedFare: number;
  surgeMultiplier: number;
}

export interface IRideAssignedEvent extends IRideEvent {
  driverId: string;
  customerId: string;
  pickup: ILocation;
}

export interface IRideAcceptedEvent extends IRideEvent {
  driverId: string;
  customerId: string;
}

export interface IRideStartedEvent extends IRideEvent {
  driverId: string;
  customerId: string;
}

export interface IRideCompletedEvent extends IRideEvent {
  driverId: string;
  customerId: string;
  fare: number | null;
  distance: number | null;
  duration: number | null;
}

export interface IRideCancelledEvent extends IRideEvent {
  cancelledBy: string;
  reason?: string;
}

// AI Service interfaces
export interface IDriverCandidate {
  driverId: string;
  distance: number;
  eta: number;
  score: number;
}

export interface IMatchDriversResponse {
  drivers: IDriverCandidate[];
  bestMatch: IDriverCandidate | null;
}

export interface IRideEstimateResponse {
  distance_km: number;
  duration_seconds: number;
  estimated_fare: number;
  surge_multiplier: number;
}
