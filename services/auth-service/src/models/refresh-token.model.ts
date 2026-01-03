import mongoose, { Schema, Document } from 'mongoose';

export interface IRefreshToken extends Document {
  tokenId: string;
  userId: mongoose.Types.ObjectId;
  expiresAt: Date;
  revokedAt?: Date;
  deviceInfo?: string;
  ipAddress?: string;
  createdAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    tokenId: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
    },
    deviceInfo: String,
    ipAddress: String,
  },
  {
    timestamps: true,
  }
);

// Indexes
RefreshTokenSchema.index({ tokenId: 1 });
RefreshTokenSchema.index({ userId: 1 });
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema);
