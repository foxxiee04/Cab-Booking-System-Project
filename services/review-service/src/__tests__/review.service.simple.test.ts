// Mock Mongoose models
const mockReview = {
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  prototype: {
    save: jest.fn(),
  },
};

const mockRatingAggregate = {
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  find: jest.fn(),
};

jest.mock('../models/review.model', () => ({
  Review: function(data: any) {
    return {
      ...data,
      _id: 'review-123',
      save: jest.fn().mockResolvedValue({ ...data, _id: 'review-123' }),
    };
  },
}));

jest.mock('../events/publisher');

import { ReviewService } from '../services/review.service';
import { Review } from '../models/review.model';
import { RatingAggregate } from '../models/rating-aggregate.model';
import { EventPublisher } from '../events/publisher';

// Apply mocks after imports
(Review.findOne as any) = mockReview.findOne;
(Review.find as any) = mockReview.find;
(RatingAggregate.findOne as any) = mockRatingAggregate.findOne;
(RatingAggregate.findOneAndUpdate as any) = mockRatingAggregate.findOneAndUpdate;
(RatingAggregate.find as any) = mockRatingAggregate.find;

describe('ReviewService - Simple Test Suite', () => {
  let reviewService: ReviewService;
  let mockEventPublisher: jest.Mocked<EventPublisher>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReview.findOne.mockReset();
    mockReview.find.mockReset();
    mockRatingAggregate.findOne.mockReset();
    mockRatingAggregate.findOneAndUpdate.mockReset();
    mockRatingAggregate.find.mockReset();

    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
      connect: jest.fn(),
      close: jest.fn(),
    } as any;

    reviewService = new ReviewService(mockEventPublisher);
  });

  describe('CREATE REVIEW', () => {
    it('should create review successfully', async () => {
      mockReview.findOne.mockResolvedValue(null);
      mockReview.find.mockResolvedValue([
        { rating: 5 },
        { rating: 4 },
      ]);
      mockRatingAggregate.findOneAndUpdate.mockResolvedValue({});

      const result = await reviewService.createReview({
        rideId: 'ride-123',
        reviewerId: 'customer-123',
        reviewerType: 'CUSTOMER',
        revieweeId: 'driver-456',
        revieweeType: 'DRIVER',
        rating: 5,
        comment: 'Great driver!',
        tags: ['polite', 'safe'],
      });

      expect(result._id).toBe('review-123');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'review.created',
        expect.objectContaining({
          reviewId: 'review-123',
          rating: 5,
        }),
        'ride-123'
      );
    });

    it('should throw error if review already exists', async () => {
      mockReview.findOne.mockResolvedValue({
        _id: 'existing-review',
        rideId: 'ride-123',
      });

      await expect(
        reviewService.createReview({
          rideId: 'ride-123',
          reviewerId: 'customer-123',
          reviewerType: 'CUSTOMER',
          revieweeId: 'driver-456',
          revieweeType: 'DRIVER',
          rating: 5,
        })
      ).rejects.toThrow('Review already submitted for this ride');
    });

    it('should reject rating below 1', async () => {
      mockReview.findOne.mockResolvedValue(null);

      await expect(
        reviewService.createReview({
          rideId: 'ride-123',
          reviewerId: 'customer-123',
          reviewerType: 'CUSTOMER',
          revieweeId: 'driver-456',
          revieweeType: 'DRIVER',
          rating: 0,
        })
      ).rejects.toThrow('Rating must be between 1 and 5');
    });

    it('should reject rating above 5', async () => {
      mockReview.findOne.mockResolvedValue(null);

      await expect(
        reviewService.createReview({
          rideId: 'ride-123',
          reviewerId: 'customer-123',
          reviewerType: 'CUSTOMER',
          revieweeId: 'driver-456',
          revieweeType: 'DRIVER',
          rating: 6,
        })
      ).rejects.toThrow('Rating must be between 1 and 5');
    });
  });

  describe('UPDATE AGGREGATE RATING', () => {
    it('should update aggregate rating', async () => {
      mockReview.find.mockResolvedValue([
        { rating: 5 },
        { rating: 4 },
        { rating: 5 },
      ]);
      mockRatingAggregate.findOneAndUpdate.mockResolvedValue({
        averageRating: 4.7,
        totalReviews: 3,
      });

      await reviewService.updateAggregateRating('driver-456', 'DRIVER');

      expect(mockRatingAggregate.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'driver-456', userType: 'DRIVER' },
        expect.objectContaining({
          totalReviews: 3,
          ratingDistribution: expect.any(Object),
        }),
        { upsert: true, new: true }
      );
    });

    it('should skip if no reviews exist', async () => {
      mockReview.find.mockResolvedValue([]);

      await reviewService.updateAggregateRating('driver-456', 'DRIVER');

      expect(mockRatingAggregate.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('GET REVIEWS', () => {
    it('should get reviews by ride', async () => {
      mockReview.find.mockResolvedValue([
        { _id: 'review-1', rideId: 'ride-123', rating: 5 },
        { _id: 'review-2', rideId: 'ride-123', rating: 4 },
      ]);

      const result = await reviewService.getReviewsByRide('ride-123');

      expect(result).toHaveLength(2);
    });

    it('should get reviews by reviewee', async () => {
      const mockFind = {
        sort: jest.fn().mockResolvedValue([
          { _id: 'review-1', revieweeId: 'driver-456', rating: 5 },
        ]),
      };
      mockReview.find.mockReturnValue(mockFind);

      const result = await reviewService.getReviewsByReviewee('driver-456', 'DRIVER');

      expect(result).toHaveLength(1);
    });
  });

  describe('GET RATING AGGREGATE', () => {
    it('should get existing aggregate', async () => {
      mockRatingAggregate.findOne.mockResolvedValue({
        userId: 'driver-456',
        averageRating: 4.7,
        totalReviews: 10,
        ratingDistribution: { 1: 0, 2: 0, 3: 1, 4: 3, 5: 6 },
      });

      const result = await reviewService.getRatingAggregate('driver-456');

      expect(result.averageRating).toBe(4.7);
      expect(result.totalReviews).toBe(10);
    });

    it('should return default if no aggregate exists', async () => {
      mockRatingAggregate.findOne.mockResolvedValue(null);

      const result = await reviewService.getRatingAggregate('driver-456');

      expect(result.averageRating).toBe(0);
      expect(result.totalReviews).toBe(0);
      expect(result.ratingDistribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    });
  });

  describe('GET TOP RATED DRIVERS', () => {
    it('should get top rated drivers', async () => {
      const mockSort = {
        limit: jest.fn().mockResolvedValue([
          { userId: 'driver-1', averageRating: 4.9, totalReviews: 100 },
          { userId: 'driver-2', averageRating: 4.8, totalReviews: 80 },
        ]),
      };
      const mockFind = {
        sort: jest.fn().mockReturnValue(mockSort),
      };
      mockRatingAggregate.find.mockReturnValue(mockFind);

      const result = await reviewService.getTopRatedDrivers(10);

      expect(result).toHaveLength(2);
      expect(mockFind.sort).toHaveBeenCalledWith({ averageRating: -1, totalReviews: -1 });
      expect(mockSort.limit).toHaveBeenCalledWith(10);
    });
  });
});
