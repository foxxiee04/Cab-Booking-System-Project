import { Request, Response, NextFunction } from 'express';

export const validateCreateBooking = (req: Request, res: Response, next: NextFunction) => {
  const { pickupLocation, dropoffLocation, pickupAddress, dropoffAddress, pickupLat, pickupLng, dropoffLat, dropoffLng } = req.body;

  // Accept either location objects or individual lat/lng/address fields
  const hasPickup = pickupLocation || (pickupAddress && pickupLat != null && pickupLng != null);
  const hasDropoff = dropoffLocation || (dropoffAddress && dropoffLat != null && dropoffLng != null);

  if (!hasPickup || !hasDropoff) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Pickup and dropoff locations are required' },
    });
  }

  next();
};

export const validateCancelBooking = (req: Request, res: Response, next: NextFunction) => {
  const { reason } = req.body;

  if (reason && typeof reason === 'string' && reason.length > 500) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Cancellation reason too long (max 500 characters)' },
    });
  }

  next();
};
