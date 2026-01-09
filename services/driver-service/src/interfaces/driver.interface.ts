// Driver entity interface
export interface IDriver {
  _id: string;
  userId: string;
  status: DriverStatus; // lifecycle status
  availabilityStatus: AvailabilityStatus; // online/offline/busy
  vehicle: IVehicle;
  license: ILicense;
  rating: {
    average: number;
    count: number;
  };
  currentRideId?: string;
  lastLocation?: IDriverLocation;
  createdAt: Date;
  updatedAt: Date;
}

export interface IVehicle {
  type: VehicleType;
  brand: string;
  model: string;
  plate: string;
  color: string;
  year: number;
}

export interface ILicense {
  number: string;
  expiryDate: Date;
  verified: boolean;
}

export interface IDriverLocation {
  lat: number;
  lng: number;
  updatedAt: Date;
}

export type DriverStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type AvailabilityStatus = 'OFFLINE' | 'ONLINE' | 'BUSY';
export type VehicleType = 'CAR' | 'MOTORCYCLE' | 'SUV';

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
