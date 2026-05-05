import axios from 'axios';
import { ReviewModel, IReview, ReviewType } from '../models/review.model';
import { PendingAutoRatingModel } from '../models/pending-auto-rating.model';
import { config } from '../config';

const AUTO_RATING_DELAY_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CreateReviewDto {
  rideId: string;
  bookingId: string;
  type: ReviewType;
  reviewerId: string;
  reviewerName: string;
  revieweeId: string;
  revieweeName: string;
  rating: number;
  comment?: string;
  tags?: string[];
}

export interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    [key: number]: number;
  };
}

class ReviewService {
  private async syncDriverRating(driverId: string, rating: number): Promise<void> {
    await axios.post(
      `${config.driverServiceUrl}/internal/drivers/${driverId}/rating`,
      { rating },
      {
        headers: {
          'x-internal-token': config.internalServiceToken,
        },
        timeout: 5000,
      }
    );
  }

  async createReview(dto: CreateReviewDto): Promise<IReview> {
    // Validate rating
    if (dto.rating < 1 || dto.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Check if review already exists
    const existing = await ReviewModel.findOne({
      rideId: dto.rideId,
      reviewerId: dto.reviewerId,
    });

    if (existing) {
      throw new Error('You have already reviewed this ride');
    }

    const review = await ReviewModel.create(dto);

    try {
      if (dto.type === ReviewType.CUSTOMER_TO_DRIVER) {
        await this.syncDriverRating(dto.revieweeId, dto.rating);
      }
    } catch (error) {
      await ReviewModel.findByIdAndDelete(review._id);
      throw error;
    }

    return review;
  }

  async getReviewsByReviewee(revieweeId: string, limit = 50): Promise<IReview[]> {
    return ReviewModel.find({ revieweeId })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  async getReviewsByReviewer(reviewerId: string, limit = 50): Promise<IReview[]> {
    return ReviewModel.find({ reviewerId })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  async getReviewsByRide(rideId: string): Promise<IReview[]> {
    return ReviewModel.find({ rideId }).sort({ createdAt: -1 });
  }

  async getReviewStats(revieweeId: string): Promise<ReviewStats> {
    const reviews = await ReviewModel.find({ revieweeId });

    if (reviews.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;

    const ratingDistribution: { [key: number]: number } = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    reviews.forEach((review) => {
      ratingDistribution[review.rating]++;
    });

    return {
      averageRating: parseFloat(averageRating.toFixed(2)),
      totalReviews: reviews.length,
      ratingDistribution,
    };
  }

  async getDriverStats(driverId: string): Promise<ReviewStats> {
    return this.getReviewStats(driverId);
  }

  async getCustomerStats(customerId: string): Promise<ReviewStats> {
    return this.getReviewStats(customerId);
  }

  async updateReview(
    reviewId: string,
    updates: { rating?: number; comment?: string; tags?: string[] }
  ): Promise<IReview | null> {
    if (updates.rating && (updates.rating < 1 || updates.rating > 5)) {
      throw new Error('Rating must be between 1 and 5');
    }

    const review = await ReviewModel.findByIdAndUpdate(reviewId, updates, { new: true });

    if (!review) {
      throw new Error('Review not found');
    }

    return review;
  }

  async deleteReview(reviewId: string): Promise<void> {
    await ReviewModel.findByIdAndDelete(reviewId);
  }

  async scheduleAutoRating(dto: {
    rideId: string;
    bookingId: string;
    customerId: string;
    driverId: string;
  }): Promise<void> {
    const scheduledAt = new Date(Date.now() + AUTO_RATING_DELAY_MS);
    await PendingAutoRatingModel.updateOne(
      { rideId: dto.rideId },
      { $setOnInsert: { ...dto, scheduledAt, processed: false } },
      { upsert: true }
    );
  }

  async processAutoRatings(): Promise<void> {
    const now = new Date();
    const pending = await PendingAutoRatingModel.find({
      scheduledAt: { $lte: now },
      processed: false,
    }).limit(50);

    for (const item of pending) {
      try {
        const existing = await ReviewModel.findOne({
          rideId: item.rideId,
          reviewerId: item.customerId,
          type: ReviewType.CUSTOMER_TO_DRIVER,
        });

        if (!existing) {
          await this.createReview({
            rideId: item.rideId,
            bookingId: item.bookingId,
            type: ReviewType.CUSTOMER_TO_DRIVER,
            reviewerId: item.customerId,
            reviewerName: 'Khách hàng',
            revieweeId: item.driverId,
            revieweeName: 'Tài xế',
            rating: 5,
            tags: ['auto_rated'],
          });
        }

        await PendingAutoRatingModel.updateOne({ _id: item._id }, { processed: true });
      } catch (err) {
        console.error(`Auto-rate failed for ride ${item.rideId}:`, err);
      }
    }
  }

  async getTopRatedDrivers(limit = 10): Promise<any[]> {
    const result = await ReviewModel.aggregate([
      {
        $match: {
          type: ReviewType.CUSTOMER_TO_DRIVER,
        },
      },
      {
        $group: {
          _id: '$revieweeId',
          revieweeName: { $first: '$revieweeName' },
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
        },
      },
      {
        $match: {
          totalReviews: { $gte: 5 }, // At least 5 reviews
        },
      },
      {
        $sort: {
          averageRating: -1,
          totalReviews: -1,
        },
      },
      {
        $limit: limit,
      },
    ]);

    return result;
  }
}

export const reviewService = new ReviewService();
