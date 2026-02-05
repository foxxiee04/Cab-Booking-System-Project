import { Request, Response, NextFunction } from 'express';

export interface LocationInput {
  address: string;
  lat: number;
  lng: number;
}

export interface CreateRideBody {
  pickup: LocationInput;
  dropoff: LocationInput;
  vehicleType?: 'ECONOMY' | 'COMFORT' | 'PREMIUM';
  paymentMethod?: 'CASH' | 'CARD' | 'WALLET';
}

export interface CancelRideBody {
  reason?: string;
}

export interface AssignDriverBody {
  driverId: string;
}

export interface AvailableRidesQuery {
  lat: string;
  lng: string;
  radius?: string;
  vehicleType?: string;
}

export const validateCreateRide = (req: Request, res: Response, next: NextFunction) => {
  const { pickup, dropoff } = req.body as CreateRideBody;

  if (!pickup || !dropoff) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Pickup and dropoff locations required' },
    });
  }

  if (!pickup.lat || !pickup.lng || !dropoff.lat || !dropoff.lng) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid location coordinates' },
    });
  }

  if (typeof pickup.lat !== 'number' || typeof pickup.lng !== 'number' ||
      typeof dropoff.lat !== 'number' || typeof dropoff.lng !== 'number') {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Coordinates must be numbers' },
    });
  }

  // Validate latitude bounds (-90 to 90)
  if (pickup.lat < -90 || pickup.lat > 90 || dropoff.lat < -90 || dropoff.lat > 90) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Latitude must be between -90 and 90' },
    });
  }

  // Validate longitude bounds (-180 to 180)
  if (pickup.lng < -180 || pickup.lng > 180 || dropoff.lng < -180 || dropoff.lng > 180) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Longitude must be between -180 and 180' },
    });
  }

  next();
};

export const validateAvailableRides = (req: Request, res: Response, next: NextFunction) => {
  const { lat, lng } = req.query as unknown as AvailableRidesQuery;

  if (!lat || !lng) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'lat and lng query parameters required' },
    });
  }

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  if (isNaN(latitude) || isNaN(longitude)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid coordinates' },
    });
  }

  next();
};

export const validateAssignDriver = (req: Request, res: Response, next: NextFunction) => {
  const { driverId } = req.body as AssignDriverBody;

  if (!driverId) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'driverId required' },
    });
  }

  next();
};
