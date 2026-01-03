import Joi from 'joi';

// Payment Status
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'CASH' | 'CARD' | 'WALLET';

// Create Payment DTO (internal use)
export interface CreatePaymentDto {
  rideId: string;
  customerId: string;
  driverId: string;
  amount: number;
  method: PaymentMethod;
  breakdown: {
    baseFare: number;
    distanceFare: number;
    timeFare: number;
    surgeAmount: number;
    discount: number;
    tax: number;
  };
}

// Process Payment DTO
export interface ProcessPaymentDto {
  paymentId: string;
  cardToken?: string;
}

export const processPaymentSchema = Joi.object<ProcessPaymentDto>({
  paymentId: Joi.string().uuid().required(),
  cardToken: Joi.string().optional(),
});

// Refund DTO
export interface RefundPaymentDto {
  reason: string;
  amount?: number; // partial refund
}

export const refundPaymentSchema = Joi.object<RefundPaymentDto>({
  reason: Joi.string().min(1).max(500).required(),
  amount: Joi.number().positive().optional(),
});

// Payment Response DTO
export interface PaymentResponseDto {
  id: string;
  rideId: string;
  customerId: string;
  driverId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  breakdown: {
    baseFare: number;
    distanceFare: number;
    timeFare: number;
    surgeAmount: number;
    discount: number;
    tax: number;
  };
  transactionId?: string;
  refundReason?: string;
  createdAt: Date;
  completedAt?: Date;
}

// Earnings Summary DTO
export interface EarningsSummaryDto {
  totalEarnings: number;
  totalRides: number;
  averagePerRide: number;
  period: {
    start: Date;
    end: Date;
  };
  breakdown: {
    cash: number;
    card: number;
    wallet: number;
  };
}

// Pagination DTO
export interface PaginationDto {
  page: number;
  limit: number;
}

export const paginationSchema = Joi.object<PaginationDto>({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
});

// Fare Calculation DTO
export interface FareCalculationDto {
  distance: number; // km
  duration: number; // seconds
  surgeMultiplier: number;
  vehicleType?: string;
}

export interface FareBreakdownDto {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  surgeAmount: number;
  subtotal: number;
  tax: number;
  total: number;
}
