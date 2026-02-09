import mongoose, { Schema, Document } from 'mongoose';

export enum NotificationType {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  IN_APP = 'IN_APP',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  QUEUED = 'QUEUED',
}

export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export interface INotification extends Document {
  userId: string;
  type: NotificationType;
  status: NotificationStatus;
  priority: NotificationPriority;
  subject?: string;
  message: string;
  recipient: string; // email or phone number
  metadata?: Record<string, any>;
  sentAt?: Date;
  failureReason?: string;
  retryCount: number;
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
    status: {
      type: String,
      enum: Object.values(NotificationStatus),
      default: NotificationStatus.PENDING,
      index: true,
    },
    priority: {
      type: String,
      enum: Object.values(NotificationPriority),
      default: NotificationPriority.MEDIUM,
    },
    subject: String,
    message: {
      type: String,
      required: true,
    },
    recipient: {
      type: String,
      required: true,
    },
    metadata: Schema.Types.Mixed,
    sentAt: Date,
    failureReason: String,
    retryCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ status: 1, priority: -1 });

export const NotificationModel = mongoose.model<INotification>('Notification', NotificationSchema);
