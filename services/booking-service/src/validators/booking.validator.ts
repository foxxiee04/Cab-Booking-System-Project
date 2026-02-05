import { Request, Response, NextFunction } from 'express';

export const validateCreateBooking = (req: Request, res: Response, next: NextFunction) => {
  const { customerId, pickupLocation, dropoffLocation } = req.body;

  if (!customerId) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'customerId is required' },
    });
  }

  if (!pickupLocation || !dropoffLocation) {
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
