import { ReviewType } from '../models/review.model';

jest.mock('axios', () => ({
  get: jest.fn().mockResolvedValue({ data: {} }),
  post: jest.fn().mockResolvedValue({ data: {} }),
}));

// Mock ReviewModel
const mockCreate = jest.fn();
const mockFindOne = jest.fn();
const mockFind = jest.fn();
const mockFindByIdAndUpdate = jest.fn();
const mockFindByIdAndDelete = jest.fn();
const mockAggregate = jest.fn();

jest.mock('../models/review.model', () => {
  const actual = jest.requireActual('../models/review.model');
  return {
    ...actual,
    ReviewModel: {
      create: (...args: any[]) => mockCreate(...args),
      findOne: (...args: any[]) => mockFindOne(...args),
      find: (...args: any[]) => mockFind(...args),
      findByIdAndUpdate: (...args: any[]) => mockFindByIdAndUpdate(...args),
      findByIdAndDelete: (...args: any[]) => mockFindByIdAndDelete(...args),
      aggregate: (...args: any[]) => mockAggregate(...args),
    },
  };
});

import { reviewService } from '../services/review.service';

describe('ReviewService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createReview', () => {
    const validDto = {
      rideId: 'ride-1',
      bookingId: 'booking-1',
      type: ReviewType.CUSTOMER_TO_DRIVER,
      reviewerId: 'customer-1',
      reviewerName: 'John Doe',
      revieweeId: 'driver-1',
      revieweeName: 'Jane Smith',
      rating: 5,
      comment: 'Great driver!',
      tags: ['professional', 'clean_car'],
    };

    it('should create a review successfully', async () => {
      mockFindOne.mockResolvedValue(null);
      mockCreate.mockResolvedValue({ _id: 'review-1', ...validDto });

      const result = await reviewService.createReview(validDto);

      expect(mockFindOne).toHaveBeenCalledWith({
        rideId: 'ride-1',
        reviewerId: 'customer-1',
      });
      expect(mockCreate).toHaveBeenCalledWith(validDto);
      expect(result._id).toBe('review-1');
    });

    it('should throw if rating < 1', async () => {
      await expect(
        reviewService.createReview({ ...validDto, rating: 0 })
      ).rejects.toThrow('Rating must be between 1 and 5');
    });

    it('should throw if rating > 5', async () => {
      await expect(
        reviewService.createReview({ ...validDto, rating: 6 })
      ).rejects.toThrow('Rating must be between 1 and 5');
    });

    it('should throw if user already reviewed this ride', async () => {
      mockFindOne.mockResolvedValue({ _id: 'existing-review' });

      await expect(
        reviewService.createReview(validDto)
      ).rejects.toThrow('You have already reviewed this ride');
    });
  });

  describe('getReviewsByReviewee', () => {
    it('should return reviews sorted by createdAt desc', async () => {
      const reviews = [{ _id: 'r1' }, { _id: 'r2' }];
      mockFind.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(reviews),
        }),
      });

      const result = await reviewService.getReviewsByReviewee('driver-1');

      expect(mockFind).toHaveBeenCalledWith({ revieweeId: 'driver-1' });
      expect(result).toEqual(reviews);
    });

    it('should respect custom limit', async () => {
      const limitMock = jest.fn().mockResolvedValue([]);
      mockFind.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: limitMock,
        }),
      });

      await reviewService.getReviewsByReviewee('driver-1', 10);
      expect(limitMock).toHaveBeenCalledWith(10);
    });
  });

  describe('getReviewsByReviewer', () => {
    it('should return reviews by reviewer', async () => {
      const reviews = [{ _id: 'r1' }];
      mockFind.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(reviews),
        }),
      });

      const result = await reviewService.getReviewsByReviewer('customer-1');

      expect(mockFind).toHaveBeenCalledWith({ reviewerId: 'customer-1' });
      expect(result).toEqual(reviews);
    });
  });

  describe('getReviewsByRide', () => {
    it('should return reviews for a ride', async () => {
      const reviews = [{ _id: 'r1' }, { _id: 'r2' }];
      mockFind.mockReturnValue({
        sort: jest.fn().mockResolvedValue(reviews),
      });

      const result = await reviewService.getReviewsByRide('ride-1');

      expect(mockFind).toHaveBeenCalledWith({ rideId: 'ride-1' });
      expect(result).toEqual(reviews);
    });
  });

  describe('getReviewStats', () => {
    it('should return stats with rating distribution', async () => {
      const reviews = [
        { rating: 5 },
        { rating: 5 },
        { rating: 4 },
        { rating: 3 },
      ];
      mockFind.mockResolvedValue(reviews);

      const stats = await reviewService.getReviewStats('driver-1');

      expect(stats.averageRating).toBe(4.25);
      expect(stats.totalReviews).toBe(4);
      expect(stats.ratingDistribution).toEqual({
        1: 0,
        2: 0,
        3: 1,
        4: 1,
        5: 2,
      });
    });

    it('should return zero stats when no reviews', async () => {
      mockFind.mockResolvedValue([]);

      const stats = await reviewService.getReviewStats('driver-1');

      expect(stats.averageRating).toBe(0);
      expect(stats.totalReviews).toBe(0);
      expect(stats.ratingDistribution).toEqual({
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      });
    });
  });

  describe('getDriverStats', () => {
    it('should delegate to getReviewStats', async () => {
      mockFind.mockResolvedValue([]);

      const stats = await reviewService.getDriverStats('driver-1');

      expect(mockFind).toHaveBeenCalledWith({ revieweeId: 'driver-1' });
      expect(stats.totalReviews).toBe(0);
    });
  });

  describe('updateReview', () => {
    it('should update review successfully', async () => {
      const updated = { _id: 'r1', rating: 4, comment: 'Updated' };
      mockFindByIdAndUpdate.mockResolvedValue(updated);

      const result = await reviewService.updateReview('r1', {
        rating: 4,
        comment: 'Updated',
      });

      expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
        'r1',
        { rating: 4, comment: 'Updated' },
        { new: true }
      );
      expect(result).toEqual(updated);
    });

    it('should throw if rating out of range', async () => {
      await expect(
        reviewService.updateReview('r1', { rating: 6 })
      ).rejects.toThrow('Rating must be between 1 and 5');
    });

    it('should throw if review not found', async () => {
      mockFindByIdAndUpdate.mockResolvedValue(null);

      await expect(
        reviewService.updateReview('non-existent', { comment: 'test' })
      ).rejects.toThrow('Review not found');
    });
  });

  describe('deleteReview', () => {
    it('should delete review by id', async () => {
      mockFindByIdAndDelete.mockResolvedValue(null);

      await reviewService.deleteReview('r1');

      expect(mockFindByIdAndDelete).toHaveBeenCalledWith('r1');
    });
  });

  describe('getTopRatedDrivers', () => {
    it('should return aggregated top drivers', async () => {
      const topDrivers = [
        { _id: 'd1', revieweeName: 'Driver 1', averageRating: 4.9, totalReviews: 50 },
        { _id: 'd2', revieweeName: 'Driver 2', averageRating: 4.8, totalReviews: 30 },
      ];
      mockAggregate.mockResolvedValue(topDrivers);

      const result = await reviewService.getTopRatedDrivers(10);

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toEqual(topDrivers);
    });
  });
});
