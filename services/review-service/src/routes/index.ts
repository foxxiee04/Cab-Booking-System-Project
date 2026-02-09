import { Router } from 'express';
import { reviewController } from '../controllers/review.controller';

const router = Router();

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
