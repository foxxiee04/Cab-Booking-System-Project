import mongoose, { Schema, Document } from 'mongoose';

export enum DriverStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
}

export enum AvailabilityStatus {
  OFFLINE = 'OFFLINE',
  ONLINE = 'ONLINE',
  BUSY = 'BUSY',
}

export interface IVehicle {
  type: 'CAR' | 'MOTORCYCLE' | 'SUV';
  brand: string;
  model: string;
  plate: string;
  color: string;
  year: number;
}

export interface IDriver extends Document {
  userId: string;
  status: DriverStatus; // lifecycle status (approval)
  availabilityStatus: AvailabilityStatus; // real-time availability
  vehicle: IVehicle;
  license: {
    number: string;
    expiryDate: Date;
    verified: boolean;
  };
  rating: {
    average: number;
    count: number;
  };
  currentRideId?: string;
  lastLocation?: {
    lat: number;
    lng: number;
    updatedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const DriverSchema = new Schema<IDriver>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: Object.values(DriverStatus),
      default: DriverStatus.PENDING,
    },
    availabilityStatus: {
      type: String,
      enum: Object.values(AvailabilityStatus),
      default: AvailabilityStatus.OFFLINE,
    },
    vehicle: {
      type: {
        type: String,
        enum: ['CAR', 'MOTORCYCLE', 'SUV'],
        required: true,
      },
      brand: { type: String, required: true },
      model: { type: String, required: true },
      plate: { type: String, required: true },
      color: { type: String, required: true },
      year: { type: Number, required: true },
    },
    license: {
      number: { type: String, required: true },
      expiryDate: { type: Date, required: true },
      verified: { type: Boolean, default: false },
    },
    rating: {
      average: { type: Number, default: 5.0 },
      count: { type: Number, default: 0 },
    },
    currentRideId: String,
    lastLocation: {
      lat: Number,
      lng: Number,
      updatedAt: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
DriverSchema.index({ userId: 1 });
DriverSchema.index({ status: 1 });
DriverSchema.index({ availabilityStatus: 1 });
DriverSchema.index({ 'vehicle.plate': 1 });

export const Driver = mongoose.model<IDriver>('Driver', DriverSchema);
