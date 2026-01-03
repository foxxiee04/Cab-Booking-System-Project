// Driver entity interface
export interface IDriver {
  _id: string;
  userId: string;
  status: DriverStatus;
  availabilityStatus: AvailabilityStatus;
  vehicle: IVehicle;
  license: ILicense;
  rating: number;
  totalRides: number;
  totalEarnings: number;
  location?: IDriverLocation;
  createdAt: Date;
  updatedAt: Date;
}

export interface IVehicle {
  make: string;
  model: string;
  year: number;
  color: string;
  plateNumber: string;
  type: VehicleType;
}

export interface ILicense {
  number: string;
  expiryDate: Date;
  issuedAt: string;
  verified: boolean;
}

export interface IDriverLocation {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  updatedAt: Date;
}

export type DriverStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type AvailabilityStatus = 'OFFLINE' | 'ONLINE' | 'BUSY';
export type VehicleType = 'STANDARD' | 'PREMIUM' | 'XL';

// Driver service interfaces
export interface IDriverService {
  registerDriver(input: IRegisterDriverInput): Promise<IDriver>;
  getDriverByUserId(userId: string): Promise<IDriver | null>;
  getDriverById(driverId: string): Promise<IDriver | null>;
  goOnline(userId: string): Promise<IDriver>;
  goOffline(userId: string): Promise<IDriver>;
  updateLocation(userId: string, location: { lat: number; lng: number }): Promise<void>;
  findNearbyDrivers(location: { lat: number; lng: number }, radiusKm: number): Promise<INearbyDriver[]>;
  updateRating(driverId: string, newRating: number): Promise<IDriver>;
}

export interface IRegisterDriverInput {
  userId: string;
  vehicle: IVehicle;
  license: Omit<ILicense, 'verified'>;
}

export interface INearbyDriver {
  driverId: string;
  userId: string;
  distance: number;
  location: { lat: number; lng: number };
  vehicle: IVehicle;
  rating: number;
}

// Repository interface
export interface IDriverRepository {
  findById(id: string): Promise<IDriver | null>;
  findByUserId(userId: string): Promise<IDriver | null>;
  create(driver: Omit<IDriver, '_id' | 'createdAt' | 'updatedAt'>): Promise<IDriver>;
  update(id: string, data: Partial<IDriver>): Promise<IDriver | null>;
  updateAvailability(id: string, status: AvailabilityStatus): Promise<IDriver | null>;
  findOnlineDrivers(): Promise<IDriver[]>;
  findByStatus(status: DriverStatus, page: number, limit: number): Promise<{ drivers: IDriver[]; total: number }>;
}

// Events
export interface IDriverLocationUpdatedEvent {
  driverId: string;
  userId: string;
  location: { lat: number; lng: number };
  timestamp: Date;
}

export interface IDriverStatusChangedEvent {
  driverId: string;
  userId: string;
  oldStatus: AvailabilityStatus;
  newStatus: AvailabilityStatus;
  timestamp: Date;
}
