import mongoose, { Schema, Document } from 'mongoose';

export enum NotificationType {
  RIDE_REQUEST = 'RIDE_REQUEST',
  RIDE_ACCEPTED = 'RIDE_ACCEPTED',
  RIDE_STARTED = 'RIDE_STARTED',
  RIDE_COMPLETED = 'RIDE_COMPLETED',
  RIDE_CANCELLED = 'RIDE_CANCELLED',
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  DRIVER_APPROVED = 'DRIVER_APPROVED',
  DRIVER_REJECTED = 'DRIVER_REJECTED',
  SYSTEM_MESSAGE = 'SYSTEM_MESSAGE',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

export interface INotification extends Document {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  status: NotificationStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: Object.values(NotificationStatus),
      default: NotificationStatus.PENDING,
    },
    sentAt: Date,
    deliveredAt: Date,
    readAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ status: 1 });
NotificationSchema.index({ type: 1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
