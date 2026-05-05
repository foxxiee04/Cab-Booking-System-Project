import { Router, Request, Response } from 'express';
import { reviewController } from '../controllers/review.controller';
import { reviewService } from '../services/review.service';
import { config } from '../config';

const router = Router();

// Internal: schedule auto-rating 24h after ride.completed
router.post('/internal/schedule-auto-rating', (req: Request, res: Response) => {
  if (req.headers['x-internal-token'] !== config.internalServiceToken) {
    res.status(403).json({ success: false, message: 'Forbidden' });
    return;
  }
  const { rideId, bookingId, customerId, driverId } = req.body ?? {};
  if (!rideId || !customerId || !driverId) {
    res.status(400).json({ success: false, message: 'rideId, customerId and driverId are required' });
    return;
  }
  reviewService.scheduleAutoRating({ rideId, bookingId: bookingId || rideId, customerId, driverId })
    .then(() => res.json({ success: true }))
    .catch((err: any) => res.status(500).json({ success: false, message: err.message }));
});

// Create review
router.post('/reviews', reviewController.createReview);

// Get received reviews (reviews about a user)
router.get('/reviews/received/:userId', reviewController.getReceivedReviews);

// Get given reviews (reviews by a user)
router.get('/reviews/given/:userId', reviewController.getGivenReviews);

// Get reviews for a ride
router.get('/reviews/ride/:rideId', reviewController.getRideReviews);

// Get user stats
router.get('/reviews/stats/:userId', reviewController.getUserStats);

// Get driver stats (alias for user stats)
router.get('/reviews/driver/:driverId/stats', reviewController.getDriverStats);

// Update review
router.put('/reviews/:reviewId', reviewController.updateReview);

// Delete review
router.delete('/reviews/:reviewId', reviewController.deleteReview);

// Get top rated drivers
router.get('/reviews/top-drivers', reviewController.getTopRatedDrivers);

export default router;
