import Joi from 'joi';

// Vehicle Info DTO
export interface VehicleDto {
  type: 'CAR' | 'MOTORCYCLE' | 'SUV';
  brand: string;
  model: string;
  plate: string;
  color: string;
  year: number;
}

const vehicleSchema = Joi.object<VehicleDto>({
  type: Joi.string().valid('CAR', 'MOTORCYCLE', 'SUV').required(),
  brand: Joi.string().min(1).max(50).required(),
  model: Joi.string().min(1).max(50).required(),
  plate: Joi.string().min(1).max(20).required(),
  color: Joi.string().min(1).max(30).required(),
  year: Joi.number().integer().min(2000).max(new Date().getFullYear() + 1).required(),
});

// License Info DTO
export interface LicenseDto {
  number: string;
  expiryDate: Date;
}

const licenseSchema = Joi.object<LicenseDto>({
  number: Joi.string().min(1).max(50).required(),
  expiryDate: Joi.date().greater('now').required().messages({
    'date.greater': 'License must not be expired',
  }),
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
