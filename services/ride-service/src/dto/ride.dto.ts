import Joi from 'joi';

// Location schema
const locationSchema = Joi.object({
  address: Joi.string().optional().default(''),
  lat: Joi.number().min(-90).max(90).required().messages({
    'number.min': 'Latitude must be between -90 and 90',
    'number.max': 'Latitude must be between -90 and 90',
    'any.required': 'Latitude is required',
  }),
  lng: Joi.number().min(-180).max(180).required().messages({
    'number.min': 'Longitude must be between -180 and 180',
    'number.max': 'Longitude must be between -180 and 180',
    'any.required': 'Longitude is required',
  }),
});

// Create Ride DTO
export interface CreateRideDto {
  pickup: {
    address?: string;
    lat: number;
    lng: number;
  };
  dropoff: {
    address?: string;
    lat: number;
    lng: number;
  };
  vehicleType?: string;
  paymentMethod?: string;
}

export const createRideSchema = Joi.object<CreateRideDto>({
  pickup: locationSchema.required().messages({
    'any.required': 'Pickup location is required',
  }),
  dropoff: locationSchema.required().messages({
    'any.required': 'Dropoff location is required',
  }),
  vehicleType: Joi.string().valid('STANDARD', 'PREMIUM', 'XL').optional().default('STANDARD'),
  paymentMethod: Joi.string().valid('CASH', 'CARD', 'WALLET').optional().default('CASH'),
});

// Update Ride Status DTO
export interface UpdateRideStatusDto {
  rideId: string;
  driverId?: string;
  reason?: string;
}

export const rideIdParamSchema = Joi.object({
  rideId: Joi.string().uuid().required().messages({
    'string.uuid': 'Invalid ride ID format',
    'any.required': 'Ride ID is required',
  }),
});

// Cancel Ride DTO
export interface CancelRideDto {
  reason?: string;
}

export const cancelRideSchema = Joi.object<CancelRideDto>({
  reason: Joi.string().max(500).optional(),
});

// Ride Response DTO
export interface RideResponseDto {
  id: string;
  customerId: string;
  driverId: string | null;
  status: string;
  pickup: {
    address: string;
    lat: number;
    lng: number;
  };
  dropoff: {
    address: string;
    lat: number;
    lng: number;
  };
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
}

// Pagination DTO
export interface PaginationDto {
  page: number;
  limit: number;
}

export const paginationSchema = Joi.object<PaginationDto>({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
});
