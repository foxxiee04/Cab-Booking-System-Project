import { momoGateway } from './momo.gateway';
import { vnpayGateway } from './vnpay.gateway';
import { logger } from '../utils/logger';
import { config } from '../config';

export enum PaymentGatewayType {
  MOMO = 'MOMO',
  VNPAY = 'VNPAY',
  MOCK = 'MOCK',
}

export interface UnifiedPaymentResult {
  success: boolean;
  paymentUrl?: string;
  intentId?: string;
  clientSecret?: string;
  orderId: string;
  provider: PaymentGatewayType;
  metadata?: Record<string, any>;
}

class PaymentGatewayManager {
  initialize() {
    momoGateway.initialize();
    logger.info('✅ Payment gateway manager initialized');
  }

  async createPayment(params: {
    provider: PaymentGatewayType;
    orderId: string;
    amount: number;
    currency: string;
    description: string;
    customerId?: string;
    returnUrl?: string;
    notifyUrl?: string;
    ipAddress?: string;
    metadata?: Record<string, any>;
  }): Promise<UnifiedPaymentResult> {
    const { provider, orderId, amount, currency, description, customerId, returnUrl, notifyUrl, ipAddress, metadata } = params;

    try {
      switch (provider) {
        case PaymentGatewayType.MOMO:
          if (!momoGateway.isEnabled()) {
            throw new Error('MoMo gateway not enabled');
          }

          const isLocalUrl = (value?: string): boolean => Boolean(value && /(localhost|127\.0\.0\.1)/i.test(value));
          const momoReturnUrl = returnUrl
            || config.momo.returnUrl
            || 'https://cab-booking.com/payment/return';
          const momoNotifyUrl = (!isLocalUrl(notifyUrl) && notifyUrl)
            || config.momo.notifyUrl
            || 'https://cab-booking.com/api/payments/webhooks/momo';

          const momoResult = await momoGateway.createPayment({
            orderId,
            amount: Math.round(amount),
            orderInfo: description,
            returnUrl: momoReturnUrl,
            notifyUrl: momoNotifyUrl,
            extraData: JSON.stringify(metadata || {}),
            requestType: typeof metadata?.momoRequestType === 'string' ? metadata.momoRequestType : undefined,
            paymentCode: typeof metadata?.momoPaymentCode === 'string' ? metadata.momoPaymentCode : undefined,
            orderGroupId: typeof metadata?.momoOrderGroupId === 'string' ? metadata.momoOrderGroupId : undefined,
            autoCapture: typeof metadata?.momoAutoCapture === 'boolean' ? metadata.momoAutoCapture : undefined,
          });

          return {
            success: true,
            paymentUrl: momoResult.payUrl,
            orderId,
            provider: PaymentGatewayType.MOMO,
            metadata: {
              requestId: momoResult.requestId,
              deeplink: momoResult.deeplink,
              qrCodeUrl: momoResult.qrCodeUrl,
            },
          };

        case PaymentGatewayType.VNPAY:
          if (!vnpayGateway.isEnabled()) {
            throw new Error('VNPay gateway not enabled');
          }

          const vnpayResult = vnpayGateway.createPaymentUrl({
            amount: Math.round(amount),
            orderId: orderId.replace(/-/g, '').slice(0, 8),
            orderInfo: description,
            ipAddress: ipAddress || '127.0.0.1',
            returnUrl: returnUrl || 'http://localhost:3000/api/payments/vnpay/return',
          });

          return {
            success: true,
            paymentUrl: vnpayResult.paymentUrl,
            orderId,
            provider: PaymentGatewayType.VNPAY,
            metadata: {
              txnRef: vnpayResult.txnRef,
            },
          };

        case PaymentGatewayType.MOCK:
        default:
          // Mock payment for testing
          return {
            success: true,
            intentId: `mock_intent_${orderId}`,
            clientSecret: `mock_secret_${orderId}`,
            orderId,
            provider: PaymentGatewayType.MOCK,
            metadata: { status: 'requires_action' },
          };
      }
    } catch (error: any) {
      logger.error(`Payment creation failed for ${provider}:`, error);
      throw error;
    }
  }

  async createRefund(params: {
    provider: PaymentGatewayType;
    paymentIntentId: string;
    amount?: number;
    reason?: string;
  }): Promise<any> {
    const { provider } = params;
    throw new Error(`Refund via manager not supported for provider: ${provider}. Use gateway-specific refund methods.`);
  }
}

export const paymentGatewayManager = new PaymentGatewayManager();
