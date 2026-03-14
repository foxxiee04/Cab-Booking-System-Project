import { Request, Response } from 'express';

// Mock reviewService
const mockCreateReview = jest.fn();
const mockGetReviewsByReviewee = jest.fn();
const mockGetReviewsByReviewer = jest.fn();
const mockGetReviewsByRide = jest.fn();
const mockGetReviewStats = jest.fn();
const mockGetDriverStats = jest.fn();
const mockUpdateReview = jest.fn();
const mockDeleteReview = jest.fn();
const mockGetTopRatedDrivers = jest.fn();

jest.mock('../services/review.service', () => ({
  reviewService: {
    createReview: (...args: any[]) => mockCreateReview(...args),
    getReviewsByReviewee: (...args: any[]) => mockGetReviewsByReviewee(...args),
    getReviewsByReviewer: (...args: any[]) => mockGetReviewsByReviewer(...args),
    getReviewsByRide: (...args: any[]) => mockGetReviewsByRide(...args),
    getReviewStats: (...args: any[]) => mockGetReviewStats(...args),
    getDriverStats: (...args: any[]) => mockGetDriverStats(...args),
    updateReview: (...args: any[]) => mockUpdateReview(...args),
    deleteReview: (...args: any[]) => mockDeleteReview(...args),
    getTopRatedDrivers: (...args: any[]) => mockGetTopRatedDrivers(...args),
  },
}));

import { reviewController } from '../controllers/review.controller';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    body: {},
    query: {},
    params: {},
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('ReviewController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createReview', () => {
    it('should return 401 if x-user-id missing', async () => {
      const req = mockReq({ headers: {} });
      const res = mockRes();

      await reviewController.createReview(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should return 400 if required fields missing', async () => {
      const req = mockReq({
        headers: { 'x-user-id': 'user-1', 'x-user-name': 'John' },
        body: { rideId: 'ride-1' }, // missing other required fields
      });
      const res = mockRes();

      await reviewController.createReview(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing required fields' });
    });

    it('should create review and return 201', async () => {
      const review = { _id: 'review-1', rating: 5 };
      mockCreateReview.mockResolvedValue(review);

      const req = mockReq({
        headers: { 'x-user-id': 'user-1', 'x-user-name': 'John' },
        body: {
          rideId: 'ride-1',
          bookingId: 'booking-1',
          type: 'CUSTOMER_TO_DRIVER',
          revieweeId: 'driver-1',
          revieweeName: 'Jane',
          rating: 5,
          comment: 'Great!',
        },
      });
      const res = mockRes();

      await reviewController.createReview(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, review });
    });

    it('should return 409 for duplicate review', async () => {
      mockCreateReview.mockRejectedValue(new Error('You have already reviewed this ride'));

      const req = mockReq({
        headers: { 'x-user-id': 'user-1', 'x-user-name': 'John' },
        body: {
          rideId: 'ride-1',
          bookingId: 'booking-1',
          type: 'CUSTOMER_TO_DRIVER',
          revieweeId: 'driver-1',
          revieweeName: 'Jane',
          rating: 5,
        },
      });
      const res = mockRes();

      await reviewController.createReview(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('should return 500 for generic error', async () => {
      mockCreateReview.mockRejectedValue(new Error('DB error'));

      const req = mockReq({
        headers: { 'x-user-id': 'user-1', 'x-user-name': 'John' },
        body: {
          rideId: 'ride-1',
          bookingId: 'booking-1',
          type: 'CUSTOMER_TO_DRIVER',
          revieweeId: 'driver-1',
          revieweeName: 'Jane',
          rating: 5,
        },
      });
      const res = mockRes();

      await reviewController.createReview(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getReceivedReviews', () => {
    it('should return received reviews', async () => {
      const reviews = [{ _id: 'r1' }, { _id: 'r2' }];
      mockGetReviewsByReviewee.mockResolvedValue(reviews);

      const req = mockReq({
        params: { userId: 'driver-1' },
        query: { limit: '10' },
      });
      const res = mockRes();

      await reviewController.getReceivedReviews(req, res);

      expect(mockGetReviewsByReviewee).toHaveBeenCalledWith('driver-1', 10);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        reviews,
      });
    });
  });

  describe('getGivenReviews', () => {
    it('should return given reviews', async () => {
      const reviews = [{ _id: 'r1' }];
      mockGetReviewsByReviewer.mockResolvedValue(reviews);

      const req = mockReq({
        params: { userId: 'customer-1' },
        query: {},
      });
      const res = mockRes();

      await reviewController.getGivenReviews(req, res);

      expect(mockGetReviewsByReviewer).toHaveBeenCalledWith('customer-1', 50);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        reviews,
      });
    });
  });

  describe('getRideReviews', () => {
    it('should return reviews for ride', async () => {
      const reviews = [{ _id: 'r1' }];
      mockGetReviewsByRide.mockResolvedValue(reviews);

      const req = mockReq({ params: { rideId: 'ride-1' } });
      const res = mockRes();

      await reviewController.getRideReviews(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        reviews,
      });
    });
  });

  describe('getUserStats', () => {
    it('should return user review stats', async () => {
      const stats = { averageRating: 4.5, totalReviews: 10, ratingDistribution: {} };
      mockGetReviewStats.mockResolvedValue(stats);

      const req = mockReq({ params: { userId: 'user-1' } });
      const res = mockRes();

      await reviewController.getUserStats(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        userId: 'user-1',
        stats,
      });
    });
  });

  describe('getDriverStats', () => {
    it('should return driver stats', async () => {
      const stats = { averageRating: 4.8, totalReviews: 20, ratingDistribution: {} };
      mockGetDriverStats.mockResolvedValue(stats);

      const req = mockReq({ params: { driverId: 'driver-1' } });
      const res = mockRes();

      await reviewController.getDriverStats(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        driverId: 'driver-1',
        stats,
      });
    });
  });

  describe('updateReview', () => {
    it('should update and return review', async () => {
      const review = { _id: 'r1', rating: 4, comment: 'Updated' };
      mockUpdateReview.mockResolvedValue(review);

      const req = mockReq({
        params: { reviewId: 'r1' },
        body: { rating: 4, comment: 'Updated' },
      });
      const res = mockRes();

      await reviewController.updateReview(req, res);

      expect(res.json).toHaveBeenCalledWith({ success: true, review });
    });
  });

  describe('deleteReview', () => {
    it('should delete review and return success', async () => {
      mockDeleteReview.mockResolvedValue(undefined);

      const req = mockReq({ params: { reviewId: 'r1' } });
      const res = mockRes();

      await reviewController.deleteReview(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Review deleted successfully',
      });
    });
  });

  describe('getTopRatedDrivers', () => {
    it('should return top rated drivers', async () => {
      const drivers = [{ _id: 'd1', averageRating: 4.9 }];
      mockGetTopRatedDrivers.mockResolvedValue(drivers);

      const req = mockReq({ query: { limit: '5' } });
      const res = mockRes();

      await reviewController.getTopRatedDrivers(req, res);

      expect(mockGetTopRatedDrivers).toHaveBeenCalledWith(5);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        drivers,
      });
    });
  });
});
