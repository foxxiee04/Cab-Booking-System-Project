import { vnpayGateway } from '../services/vnpay.gateway';

export interface CreateVNPayPaymentInput {
  orderId: string;
  amount: number;
  orderInfo: string;
  ipAddress: string;
  returnUrl?: string;
  bankCode?: string;
}

export class VNPayProvider {
  createPaymentUrl(input: CreateVNPayPaymentInput) {
    return vnpayGateway.createPaymentUrl({
      amount: input.amount,
      orderId: input.orderId,
      orderInfo: input.orderInfo,
      ipAddress: input.ipAddress,
      returnUrl: input.returnUrl,
      bankCode: input.bankCode,
    });
  }

  verifyReturn(payload: Record<string, string>) {
    return vnpayGateway.verifyReturn(payload);
  }
}

export const vnpayProvider = new VNPayProvider();
