// Payment entity interface
export interface IPayment {
  id: string;
  rideId: string;
  customerId: string;
  driverId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  breakdown: IFareBreakdown;
  transactionId?: string;
  refundReason?: string;
  createdAt: Date;
  completedAt?: Date;
  updatedAt: Date;
}

export interface IFareBreakdown {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  surgeAmount: number;
  discount: number;
  tax: number;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'WALLET';
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

// Payment service interfaces
export interface IPaymentService {
  createPayment(input: ICreatePaymentInput): Promise<IPayment>;
  processPayment(paymentId: string, cardToken?: string): Promise<IPayment>;
  getPaymentByRideId(rideId: string): Promise<IPayment | null>;
  getCustomerPayments(customerId: string, page: number, limit: number): Promise<{ payments: IPayment[]; total: number }>;
  getDriverEarnings(driverId: string, page: number, limit: number): Promise<IEarningsSummary>;
  refundPayment(rideId: string, reason: string): Promise<IPayment>;
  calculateFare(input: IFareCalculationInput): IFareBreakdown;
}

export interface ICreatePaymentInput {
  rideId: string;
  customerId: string;
  driverId: string;
  distance: number;
  duration: number;
  surgeMultiplier: number;
  method: PaymentMethod;
}

export interface IFareCalculationInput {
  distance: number; // km
  duration: number; // seconds
  surgeMultiplier: number;
  vehicleType?: string;
}

export interface IEarningsSummary {
  payments: IPayment[];
  total: number;
  totalEarnings: number;
  totalRides: number;
  averagePerRide: number;
  breakdown: {
    cash: number;
    card: number;
    wallet: number;
  };
}

// Repository interface
export interface IPaymentRepository {
  findById(id: string): Promise<IPayment | null>;
  findByRideId(rideId: string): Promise<IPayment | null>;
  findByCustomerId(customerId: string, page: number, limit: number): Promise<{ payments: IPayment[]; total: number }>;
  findByDriverId(driverId: string, page: number, limit: number): Promise<{ payments: IPayment[]; total: number }>;
  create(payment: Omit<IPayment, 'id' | 'createdAt' | 'updatedAt'>): Promise<IPayment>;
  update(id: string, data: Partial<IPayment>): Promise<IPayment | null>;
  sumByDriverId(driverId: string, startDate: Date, endDate: Date): Promise<number>;
}

// Events
export interface IPaymentCompletedEvent {
  paymentId: string;
  rideId: string;
  customerId: string;
  driverId: string;
  amount: number;
  method: PaymentMethod;
  timestamp: Date;
}

export interface IPaymentFailedEvent {
  paymentId: string;
  rideId: string;
  customerId: string;
  reason: string;
  timestamp: Date;
}
