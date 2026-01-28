import { Review } from '../models/review.model';
import { RatingAggregate } from '../models/rating-aggregate.model';
import { EventPublisher } from '../events/publisher';
import { logger } from '../utils/logger';

export class ReviewService {
  private eventPublisher: EventPublisher;

  constructor(eventPublisher: EventPublisher) {
    this.eventPublisher = eventPublisher;
  }

  async createReview(data: {
    rideId: string;
    reviewerId: string;
    reviewerType: 'CUSTOMER' | 'DRIVER';
    revieweeId: string;
    revieweeType: 'CUSTOMER' | 'DRIVER';
    rating: number;
    comment?: string;
    tags?: string[];
  }) {
    // Check if review already exists for this ride+reviewer
    const existing = await Review.findOne({
      rideId: data.rideId,
      reviewerId: data.reviewerId,
    });

    if (existing) {
      throw new Error('Review already submitted for this ride');
    }

    // Validate rating
    if (data.rating < 1 || data.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Create review
    const review = new Review(data);
    await review.save();

    logger.info('Review created', {
      reviewId: review._id,
      rideId: data.rideId,
      rating: data.rating,
    });

    // Update aggregate rating
    await this.updateAggregateRating(data.revieweeId, data.revieweeType);

    // Publish event
    await this.eventPublisher.publish('review.created', {
      reviewId: review._id,
      rideId: data.rideId,
      revieweeId: data.revieweeId,
      revieweeType: data.revieweeType,
      rating: data.rating,
    }, data.rideId);

    return review;
  }

  async updateAggregateRating(userId: string, userType: 'CUSTOMER' | 'DRIVER') {
    const reviews = await Review.find({
      revieweeId: userId,
      revieweeType: userType,
    });

    const totalReviews = reviews.length;
    
    if (totalReviews === 0) {
      return;
    }

    const ratingDistribution = {
      1: reviews.filter(r => r.rating === 1).length,
      2: reviews.filter(r => r.rating === 2).length,
      3: reviews.filter(r => r.rating === 3).length,
      4: reviews.filter(r => r.rating === 4).length,
      5: reviews.filter(r => r.rating === 5).length,
    };

    const totalRatingPoints = reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = Math.round((totalRatingPoints / totalReviews) * 10) / 10;

    await RatingAggregate.findOneAndUpdate(
      { userId, userType },
      {
        userId,
        userType,
        averageRating,
        totalReviews,
        ratingDistribution,
        lastUpdated: new Date(),
      },
      { upsert: true, new: true }
    );

    logger.info('Aggregate rating updated', {
      userId,
      averageRating,
      totalReviews,
    });
  }

  async getReviewsByRide(rideId: string) {
    return Review.find({ rideId });
  }

  async getReviewsByReviewee(revieweeId: string, userType: 'CUSTOMER' | 'DRIVER') {
    return Review.find({ revieweeId, revieweeType: userType }).sort({ createdAt: -1 });
  }

  async getRatingAggregate(userId: string) {
    const aggregate = await RatingAggregate.findOne({ userId });
    
    if (!aggregate) {
      return {
        userId,
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    return aggregate;
  }

  async getTopRatedDrivers(limit: number = 10) {
    return RatingAggregate.find({ userType: 'DRIVER' })
      .sort({ averageRating: -1, totalReviews: -1 })
      .limit(limit);
  }
}
