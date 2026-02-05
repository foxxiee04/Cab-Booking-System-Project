import { Router } from 'express';
import { RideService } from '../services/ride.service';
import { RideController } from '../controllers/ride.controller';
import { 
  validateCreateRide, 
  validateAvailableRides, 
  validateAssignDriver 
} from '../validators/ride.validator';

export const createRideRouter = (rideService: RideService): Router => {
  const router = Router();
  const controller = new RideController(rideService);

  // Get available rides for driver (browse mode)
  router.get('/available', validateAvailableRides, controller.getAvailableRides);

  // Create ride (Customer)
  router.post('/', validateCreateRide, controller.createRide);

  // Get ride by ID
  router.get('/:rideId', controller.getRideById);

  // Get customer's rides
  router.get('/customer/history', controller.getCustomerRides);

  // Get customer's active ride
  router.get('/customer/active', controller.getCustomerActiveRide);

  // Get driver's active ride
  router.get('/driver/active', controller.getDriverActiveRide);

  // Get driver's rides
  router.get('/driver/history', controller.getDriverRides);

  // Accept ride (Driver)
  router.post('/:rideId/accept', controller.acceptRide);

  // Reject ride (Driver)
  router.post('/:rideId/reject', controller.rejectRide);

  // Start ride (Driver)
  router.post('/:rideId/start', controller.startRide);

  // Driver accept ride from available rides list
  router.post('/:rideId/driver-accept', controller.driverAcceptRide);

  // Mark passenger picked up
  router.post('/:rideId/pickup', controller.markPickedUp);

  // Complete ride (Driver)
  router.post('/:rideId/complete', controller.completeRide);

  // Cancel ride
  router.post('/:rideId/cancel', controller.cancelRide);

  // Internal: Assign driver (called by matching service/worker)
  router.post('/:rideId/assign', validateAssignDriver, controller.assignDriver);

  // Driver offer acceptance/rejection (Task 2.1 & 2.2)
  router.post('/:rideId/accept-offer', controller.acceptOffer);
  router.post('/:rideId/reject-offer', controller.rejectOffer);

  return router;
};
