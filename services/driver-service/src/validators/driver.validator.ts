import { Request, Response, NextFunction } from 'express';

export const validateDriverRegistration = (req: Request, res: Response, next: NextFunction) => {
  const { vehicle, license } = req.body;

  if (!vehicle || !license) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Vehicle and license info required' },
    });
  }

  if (!vehicle.type || !vehicle.plate) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Vehicle type and plate required' },
    });
  }

  if (!license.number || !license.expiryDate) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'License number and expiry date required' },
    });
  }

  next();
};

export const validateLocation = (req: Request, res: Response, next: NextFunction) => {
  const { lat, lng } = req.body;

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Valid lat and lng required' },
    });
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid coordinates' },
    });
  }

  next();
};

export const validateAvailableRidesQuery = (req: Request, res: Response, next: NextFunction) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'lat and lng are required' },
    });
  }

  const latitude = parseFloat(lat as string);
  const longitude = parseFloat(lng as string);

  if (isNaN(latitude) || isNaN(longitude)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid coordinates' },
    });
  }

  next();
};

export const validateNearbyQuery = (req: Request, res: Response, next: NextFunction) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Valid lat and lng required' },
    });
  }

  next();
};

export const validateDriverProfileUpdate = (req: Request, res: Response, next: NextFunction) => {
  const {
    vehicleType,
    vehicleMake,
    vehicleModel,
    vehicleColor,
    vehicleYear,
    licensePlate,
    licenseNumber,
    licenseExpiryDate,
  } = req.body;

  const hasUpdatableField = [
    vehicleType,
    vehicleMake,
    vehicleModel,
    vehicleColor,
    vehicleYear,
    licensePlate,
    licenseNumber,
    licenseExpiryDate,
  ].some((value) => value !== undefined);

  if (!hasUpdatableField) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'At least one profile field must be provided' },
    });
  }

  if (vehicleYear !== undefined && (!Number.isInteger(vehicleYear) || vehicleYear < 1980 || vehicleYear > 2100)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Vehicle year must be a valid integer' },
    });
  }

  if (licenseExpiryDate !== undefined && Number.isNaN(Date.parse(licenseExpiryDate))) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'License expiry date is invalid' },
    });
  }

  next();
};
