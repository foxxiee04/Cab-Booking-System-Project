import mongoose, { Schema, Document } from 'mongoose';

export interface IReview extends Document {
  rideId: string;
  reviewerId: string;
  reviewerType: 'CUSTOMER' | 'DRIVER';
  revieweeId: string;
  revieweeType: 'CUSTOMER' | 'DRIVER';
  rating: number; // 1-5
  comment?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    rideId: { type: String, required: true, index: true },
    reviewerId: { type: String, required: true, index: true },
    reviewerType: { type: String, enum: ['CUSTOMER', 'DRIVER'], required: true },
    revieweeId: { type: String, required: true, index: true },
    revieweeType: { type: String, enum: ['CUSTOMER', 'DRIVER'], required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, maxlength: 500 },
    tags: [{ type: String }],
  },
  {
    timestamps: true,
  }
);

// Compound indexes
reviewSchema.index({ rideId: 1, reviewerId: 1 }, { unique: true });
reviewSchema.index({ revieweeId: 1, revieweeType: 1 });
reviewSchema.index({ rating: 1 });

export const Review = mongoose.model<IReview>('Review', reviewSchema);
