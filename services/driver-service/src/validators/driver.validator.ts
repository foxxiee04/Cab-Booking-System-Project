import { Request, Response, NextFunction } from 'express';

const VEHICLE_YEAR_MIN = 1990;

const isBlank = (value: unknown) => typeof value !== 'string' || value.trim().length === 0;

const isFutureDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  return parsed > today;
};

const isValidVehiclePlate = (value: string) => /^\d{2}[A-Z]{1,2}-?\d{4,5}$/i.test(value.trim());
const isValidLicenseNumber = (value: string) => /^[A-Z0-9]{8,16}$/i.test(value.trim());

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

  if (isBlank(vehicle.brand) || String(vehicle.brand).trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Vehicle brand must contain at least 2 characters' },
    });
  }

  if (isBlank(vehicle.model) || String(vehicle.model).trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Vehicle model must contain at least 2 characters' },
    });
  }

  if (isBlank(vehicle.color) || String(vehicle.color).trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Vehicle color must contain at least 2 characters' },
    });
  }

  const currentYear = new Date().getFullYear();
  if (!Number.isInteger(vehicle.year) || vehicle.year < VEHICLE_YEAR_MIN || vehicle.year > currentYear + 1) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Vehicle year is invalid' },
    });
  }

  if (!isValidVehiclePlate(String(vehicle.plate))) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Vehicle plate format is invalid' },
    });
  }

  if (!isValidLicenseNumber(String(license.number))) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'License number format is invalid' },
    });
  }

  if (!isFutureDate(String(license.expiryDate))) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'License expiry date must be in the future' },
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

  if (vehicleYear !== undefined && (!Number.isInteger(vehicleYear) || vehicleYear < VEHICLE_YEAR_MIN || vehicleYear > new Date().getFullYear() + 1)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Vehicle year is invalid' },
    });
  }

  if (vehicleMake !== undefined && (isBlank(vehicleMake) || vehicleMake.trim().length < 2)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Vehicle make must contain at least 2 characters' },
    });
  }

  if (vehicleModel !== undefined && (isBlank(vehicleModel) || vehicleModel.trim().length < 2)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Vehicle model must contain at least 2 characters' },
    });
  }

  if (vehicleColor !== undefined && (isBlank(vehicleColor) || vehicleColor.trim().length < 2)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Vehicle color must contain at least 2 characters' },
    });
  }

  if (licensePlate !== undefined && !isValidVehiclePlate(String(licensePlate))) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Vehicle plate format is invalid' },
    });
  }

  if (licenseNumber !== undefined && !isValidLicenseNumber(String(licenseNumber))) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'License number format is invalid' },
    });
  }

  if (licenseExpiryDate !== undefined && !isFutureDate(String(licenseExpiryDate))) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'License expiry date must be in the future' },
    });
  }

  next();
};
