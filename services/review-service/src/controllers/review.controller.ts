import { Request, Response } from 'express';
import { reviewService } from '../services/review.service';
import { ReviewType } from '../models/review.model';

export const reviewController = {
  // Create a review
  async createReview(req: Request, res: Response) {
    try {
      const {
        rideId,
        bookingId,
        type,
        revieweeId,
        revieweeName,
        rating,
        comment,
        tags,
      } = req.body;

      const reviewerId = req.headers['x-user-id'] as string;
      const reviewerName = req.headers['x-user-name'] as string;

      if (!reviewerId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!rideId || !bookingId || !type || !revieweeId || !revieweeName || !rating) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const review = await reviewService.createReview({
        rideId,
        bookingId,
        type: type as ReviewType,
        reviewerId,
        reviewerName,
        revieweeId,
        revieweeName,
        rating,
        comment,
        tags,
      });

      res.status(201).json({
        success: true,
        review,
      });
    } catch (error: any) {
      console.error('Error creating review:', error);
      res.status(error.message.includes('already reviewed') ? 409 : 500).json({
        error: error.message,
      });
    }
  },

  // Get reviews for a user (as reviewee - received reviews)
  async getReceivedReviews(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      const reviews = await reviewService.getReviewsByReviewee(userId, limit);

      res.json({
        success: true,
        count: reviews.length,
        reviews,
      });
    } catch (error: any) {
      console.error('Error fetching received reviews:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Get reviews by a user (as reviewer - given reviews)
  async getGivenReviews(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      const reviews = await reviewService.getReviewsByReviewer(userId, limit);

      res.json({
        success: true,
        count: reviews.length,
        reviews,
      });
    } catch (error: any) {
      console.error('Error fetching given reviews:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Get reviews for a specific ride
  async getRideReviews(req: Request, res: Response) {
    try {
      const { rideId } = req.params;

      const reviews = await reviewService.getReviewsByRide(rideId);

      res.json({
        success: true,
        count: reviews.length,
        reviews,
      });
    } catch (error: any) {
      console.error('Error fetching ride reviews:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Get user review statistics
  async getUserStats(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      const stats = await reviewService.getReviewStats(userId);

      res.json({
        success: true,
        userId,
        stats,
      });
    } catch (error: any) {
      console.error('Error fetching user stats:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Get driver statistics
  async getDriverStats(req: Request, res: Response) {
    try {
      const { driverId } = req.params;

      const stats = await reviewService.getDriverStats(driverId);

      res.json({
        success: true,
        driverId,
        stats,
      });
    } catch (error: any) {
      console.error('Error fetching driver stats:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Update a review
  async updateReview(req: Request, res: Response) {
    try {
      const { reviewId } = req.params;
      const { rating, comment, tags } = req.body;

      const review = await reviewService.updateReview(reviewId, {
        rating,
        comment,
        tags,
      });

      res.json({
        success: true,
        review,
      });
    } catch (error: any) {
      console.error('Error updating review:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Delete a review
  async deleteReview(req: Request, res: Response) {
    try {
      const { reviewId } = req.params;

      await reviewService.deleteReview(reviewId);

      res.json({
        success: true,
        message: 'Review deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting review:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Get top rated drivers
  async getTopRatedDrivers(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 10;

      const drivers = await reviewService.getTopRatedDrivers(limit);

      res.json({
        success: true,
        count: drivers.length,
        drivers,
      });
    } catch (error: any) {
      console.error('Error fetching top rated drivers:', error);
      res.status(500).json({ error: error.message });
    }
  },
};
