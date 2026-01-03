import Joi from 'joi';

// Vehicle Info DTO
export interface VehicleDto {
  make: string;
  model: string;
  year: number;
  color: string;
  plateNumber: string;
  type: 'STANDARD' | 'PREMIUM' | 'XL';
}

const vehicleSchema = Joi.object<VehicleDto>({
  make: Joi.string().min(1).max(50).required(),
  model: Joi.string().min(1).max(50).required(),
  year: Joi.number().integer().min(2000).max(new Date().getFullYear() + 1).required(),
  color: Joi.string().min(1).max(30).required(),
  plateNumber: Joi.string().min(1).max(20).required(),
  type: Joi.string().valid('STANDARD', 'PREMIUM', 'XL').required(),
});

// License Info DTO
export interface LicenseDto {
  number: string;
  expiryDate: Date;
  issuedAt: string;
}

const licenseSchema = Joi.object<LicenseDto>({
  number: Joi.string().min(1).max(50).required(),
  expiryDate: Joi.date().greater('now').required().messages({
    'date.greater': 'License must not be expired',
  }),
  issuedAt: Joi.string().min(1).max(100).required(),
});

// Register Driver DTO
export interface RegisterDriverDto {
  vehicle: VehicleDto;
  license: LicenseDto;
}

export const registerDriverSchema = Joi.object<RegisterDriverDto>({
  vehicle: vehicleSchema.required(),
  license: licenseSchema.required(),
});

// Update Location DTO
export interface UpdateLocationDto {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
}

export const updateLocationSchema = Joi.object<UpdateLocationDto>({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  heading: Joi.number().min(0).max(360).optional(),
  speed: Joi.number().min(0).optional(),
});

// Find Nearby Drivers DTO
export interface FindNearbyDto {
  lat: number;
  lng: number;
  radius?: number;
  vehicleType?: string;
}

export const findNearbySchema = Joi.object<FindNearbyDto>({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  radius: Joi.number().min(0.1).max(50).optional().default(5),
  vehicleType: Joi.string().valid('STANDARD', 'PREMIUM', 'XL').optional(),
});

// Driver Status DTO
export type DriverStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type AvailabilityStatus = 'OFFLINE' | 'ONLINE' | 'BUSY';

// Driver Response DTO
export interface DriverResponseDto {
  id: string;
  userId: string;
  status: DriverStatus;
  availabilityStatus: AvailabilityStatus;
  vehicle: VehicleDto;
  license: {
    number: string;
    expiryDate: Date;
    issuedAt: string;
  };
  rating: number;
  totalRides: number;
  location?: {
    lat: number;
    lng: number;
    updatedAt: Date;
  };
  createdAt: Date;
}

// Nearby Driver Response DTO
export interface NearbyDriverDto {
  driverId: string;
  userId: string;
  distance: number;
  location: {
    lat: number;
    lng: number;
  };
  vehicle: {
    type: string;
    make: string;
    model: string;
    color: string;
    plateNumber: string;
  };
  rating: number;
}
