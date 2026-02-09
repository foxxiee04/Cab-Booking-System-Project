import mongoose, { Schema, Document } from 'mongoose';

export enum ReviewType {
  CUSTOMER_TO_DRIVER = 'CUSTOMER_TO_DRIVER',
  DRIVER_TO_CUSTOMER = 'DRIVER_TO_CUSTOMER',
}

export interface IReview extends Document {
  rideId: string;
  bookingId: string;
  type: ReviewType;
  reviewerId: string; // Customer ID or Driver ID
  reviewerName: string;
  revieweeId: string; // Driver ID or Customer ID
  revieweeName: string;
  rating: number; // 1-5
  comment?: string;
  tags?: string[]; // ['professional', 'friendly', 'clean_car', 'safe_driving', etc.]
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    rideId: {
      type: String,
      required: true,
      index: true,
    },
    bookingId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(ReviewType),
      required: true,
    },
    reviewerId: {
      type: String,
      required: true,
      index: true,
    },
    reviewerName: {
      type: String,
      required: true,
    },
    revieweeId: {
      type: String,
      required: true,
      index: true,
    },
    revieweeName: {
      type: String,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: String,
    tags: [String],
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
ReviewSchema.index({ revieweeId: 1, createdAt: -1 });
ReviewSchema.index({ reviewerId: 1, createdAt: -1 });
ReviewSchema.index({ rating: -1 });

// Compound index for unique review per ride per user
ReviewSchema.index({ rideId: 1, reviewerId: 1 }, { unique: true });

export const ReviewModel = mongoose.model<IReview>('Review', ReviewSchema);
