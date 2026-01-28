import { Router } from 'express';
import { ReviewService } from '../services/review.service';
import { logger } from '../utils/logger';

export function createReviewRouter(reviewService: ReviewService): Router {
  const router = Router();

  // Create review
  router.post('/', async (req, res) => {
    try {
      const review = await reviewService.createReview(req.body);
      res.status(201).json({ success: true, data: { review } });
    } catch (error: any) {
      logger.error('Create review error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'REVIEW_FAILED', message: error.message },
      });
    }
  });

  // Get reviews for a ride
  router.get('/ride/:rideId', async (req, res) => {
    try {
      const reviews = await reviewService.getReviewsByRide(req.params.rideId);
      res.json({ success: true, data: { reviews } });
    } catch (error: any) {
      logger.error('Get ride reviews error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: error.message },
      });
    }
  });

  // Get reviews for a user (driver or customer)
  router.get('/user/:userId', async (req, res) => {
    try {
      const { userType } = req.query;
      const reviews = await reviewService.getReviewsByReviewee(
        req.params.userId,
        (userType as 'CUSTOMER' | 'DRIVER') || 'DRIVER'
      );
      res.json({ success: true, data: { reviews } });
    } catch (error: any) {
      logger.error('Get user reviews error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: error.message },
      });
    }
  });

  // Get rating aggregate for a user
  router.get('/rating/:userId', async (req, res) => {
    try {
      const aggregate = await reviewService.getRatingAggregate(req.params.userId);
      res.json({ success: true, data: aggregate });
    } catch (error: any) {
      logger.error('Get rating aggregate error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: error.message },
      });
    }
  });

  // Get top rated drivers
  router.get('/top-drivers', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const topDrivers = await reviewService.getTopRatedDrivers(limit);
      res.json({ success: true, data: { drivers: topDrivers } });
    } catch (error: any) {
      logger.error('Get top drivers error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: error.message },
      });
    }
  });

  return router;
}
