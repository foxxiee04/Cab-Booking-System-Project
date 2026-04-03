export type ExternalPaymentMethod = 'MOMO' | 'VNPAY';
export type ExternalPaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface PaymentEntity {
  id: string;
  order_id: string;
  service_name: 'BOOKING';
  method: ExternalPaymentMethod;
  amount: number;
  status: ExternalPaymentStatus;
  transaction_id: string | null;
  raw_response: unknown;
  created_at: Date;
  updated_at: Date;
}
