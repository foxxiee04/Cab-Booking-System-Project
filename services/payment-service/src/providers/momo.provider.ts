import { momoGateway } from '../services/momo.gateway';

export interface CreateMoMoPaymentInput {
  orderId: string;
  amount: number;
  orderInfo: string;
  returnUrl: string;
  ipnUrl: string;
  extraData?: string;
}

export class MoMoProvider {
  async createPayment(input: CreateMoMoPaymentInput) {
    return momoGateway.createPayment({
      orderId: input.orderId,
      amount: input.amount,
      orderInfo: input.orderInfo,
      returnUrl: input.returnUrl,
      notifyUrl: input.ipnUrl,
      extraData: input.extraData,
    });
  }

  verifySignature(payload: Record<string, any>, signature: string): boolean {
    return momoGateway.verifyWebhookSignature(payload, signature);
  }
}

export const momoProvider = new MoMoProvider();
