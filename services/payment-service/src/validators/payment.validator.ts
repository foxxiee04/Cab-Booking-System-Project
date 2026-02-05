import { Request, Response, NextFunction } from 'express';

export const validateCreatePaymentIntent = (req: Request, res: Response, next: NextFunction) => {
  const { rideId, amount } = req.body;

  if (!rideId) {
    return res.status(400).json({ 
      success: false, 
      error: { code: 'VALIDATION_ERROR', message: 'rideId is required' } 
    });
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ 
      success: false, 
      error: { code: 'VALIDATION_ERROR', message: 'Valid amount is required' } 
    });
  }

  next();
};

export const validateWebhook = (req: Request, res: Response, next: NextFunction) => {
  const { paymentIntentId, status } = req.body;

  if (!paymentIntentId || !status) {
    return res.status(400).json({ 
      success: false, 
      error: { code: 'VALIDATION_ERROR', message: 'paymentIntentId and status are required' } 
    });
  }

  next();
};

export const validateRefund = (req: Request, res: Response, next: NextFunction) => {
  // Refund reason is optional, just validate it's not too long if provided
  const { reason } = req.body;

  if (reason && typeof reason === 'string' && reason.length > 500) {
    return res.status(400).json({ 
      success: false, 
      error: { code: 'VALIDATION_ERROR', message: 'Refund reason too long (max 500 characters)' } 
    });
  }

  next();
};
