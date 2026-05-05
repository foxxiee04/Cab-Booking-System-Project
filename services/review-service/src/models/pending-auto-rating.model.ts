import mongoose, { Schema, Document } from 'mongoose';

export interface IPendingAutoRating extends Document {
  rideId: string;
  bookingId: string;
  customerId: string;
  driverId: string;
  scheduledAt: Date;
  processed: boolean;
  createdAt: Date;
}

const PendingAutoRatingSchema = new Schema<IPendingAutoRating>(
  {
    rideId:      { type: String, required: true, unique: true },
    bookingId:   { type: String, required: true },
    customerId:  { type: String, required: true },
    driverId:    { type: String, required: true },
    scheduledAt: { type: Date, required: true },
    processed:   { type: Boolean, default: false },
  },
  { timestamps: true }
);

PendingAutoRatingSchema.index({ scheduledAt: 1, processed: 1 });

export const PendingAutoRatingModel = mongoose.model<IPendingAutoRating>(
  'PendingAutoRating',
  PendingAutoRatingSchema
);
