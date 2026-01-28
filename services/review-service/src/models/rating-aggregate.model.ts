import mongoose, { Schema, Document } from 'mongoose';

export interface IRatingAggregate extends Document {
  userId: string;
  userType: 'CUSTOMER' | 'DRIVER';
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  lastUpdated: Date;
}

const ratingAggregateSchema = new Schema<IRatingAggregate>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    userType: { type: String, enum: ['CUSTOMER', 'DRIVER'], required: true },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    ratingDistribution: {
      1: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      5: { type: Number, default: 0 },
    },
    lastUpdated: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

export const RatingAggregate = mongoose.model<IRatingAggregate>('RatingAggregate', ratingAggregateSchema);
