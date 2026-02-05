import { Router } from 'express';
import { DriverService } from '../services/driver.service';
import { DriverController } from '../controllers/driver.controller';
import {
  validateDriverRegistration,
  validateLocation,
  validateAvailableRidesQuery,
  validateNearbyQuery,
} from '../validators/driver.validator';

export const createDriverRouter = (driverService: DriverService): Router => {
  const router = Router();
  const controller = new DriverController(driverService);

  // Register as driver
  router.post('/register', validateDriverRegistration, controller.registerDriver);

  // Get current driver profile
  router.get('/me', controller.getMe);

  // Go online
  router.post('/me/online', controller.goOnline);

  // Go offline
  router.post('/me/offline', controller.goOffline);

  // Update location
  router.post('/me/location', validateLocation, controller.updateLocation);

  // Browse available rides (hybrid mode)
  router.get('/me/available-rides', validateAvailableRidesQuery, controller.getAvailableRides);

  // Driver accepts a ride (hybrid manual accept)
  router.post('/me/rides/:rideId/accept', controller.acceptRide);

  // Get driver's assigned ride
  router.get('/me/rides/assigned', controller.getAssignedRide);

  // Find nearby drivers (internal/admin)
  router.get('/nearby', validateNearbyQuery, controller.findNearbyDrivers);

  // Admin: Get all drivers
  router.get('/', controller.getAllDrivers);

  // Admin: Verify driver
  router.patch('/:driverId/verify', controller.verifyDriver);

  // Get driver profile by userId (for internal service call)
  router.get('/user/:userId', controller.getDriverByUserId);

  return router;
};
