import mongoose, { Schema, Document } from 'mongoose';

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum VehicleType {
  ECONOMY = 'ECONOMY',
  COMFORT = 'COMFORT',
  PREMIUM = 'PREMIUM',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  WALLET = 'WALLET',
}

export interface IBooking extends Document {
  customerId: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  vehicleType: VehicleType;
  paymentMethod: PaymentMethod;
  estimatedFare?: number;
  estimatedDistance?: number;
  estimatedDuration?: number;
  surgeMultiplier: number;
  status: BookingStatus;
  notes?: string;
  customerPhone?: string;
  confirmedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>(
  {
    customerId: { type: String, required: true, index: true },
    pickupAddress: { type: String, required: true },
    pickupLat: { type: Number, required: true },
    pickupLng: { type: Number, required: true },
    dropoffAddress: { type: String, required: true },
    dropoffLat: { type: Number, required: true },
    dropoffLng: { type: Number, required: true },
    vehicleType: {
      type: String,
      enum: Object.values(VehicleType),
      default: VehicleType.ECONOMY,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
      default: PaymentMethod.CASH,
      required: true,
    },
    estimatedFare: { type: Number },
    estimatedDistance: { type: Number },
    estimatedDuration: { type: Number },
    surgeMultiplier: { type: Number, default: 1.0 },
    status: {
      type: String,
      enum: Object.values(BookingStatus),
      default: BookingStatus.PENDING,
      required: true,
      index: true,
    },
    notes: { type: String },
    customerPhone: { type: String },
    confirmedAt: { type: Date },
    cancelledAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Add indexes
BookingSchema.index({ createdAt: -1 });
BookingSchema.index({ customerId: 1, status: 1 });

export const Booking = mongoose.model<IBooking>('Booking', BookingSchema);
