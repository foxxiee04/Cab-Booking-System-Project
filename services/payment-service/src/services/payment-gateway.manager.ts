import { stripeGateway } from './stripe.gateway';
import { momoGateway } from './momo.gateway';
import { zaloPayGateway } from './zalopay.gateway';
import { logger } from '../utils/logger';

export enum PaymentGatewayType {
  STRIPE = 'STRIPE',
  MOMO = 'MOMO',
  ZALOPAY = 'ZALOPAY',
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
    stripeGateway.initialize();
    momoGateway.initialize();
    zaloPayGateway.initialize();
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
    metadata?: Record<string, any>;
  }): Promise<UnifiedPaymentResult> {
    const { provider, orderId, amount, currency, description, customerId, returnUrl, notifyUrl, metadata } = params;

    try {
      switch (provider) {
        case PaymentGatewayType.STRIPE:
          if (!stripeGateway.isEnabled()) {
            throw new Error('Stripe gateway not enabled');
          }

          const stripeResult = await stripeGateway.createPaymentIntent({
            amount: Math.round(amount * 100), // Convert to cents
            currency,
            customerId,
            metadata: { orderId, ...metadata },
          });

          return {
            success: true,
            intentId: stripeResult.intentId,
            clientSecret: stripeResult.clientSecret,
            orderId,
            provider: PaymentGatewayType.STRIPE,
            metadata: { status: stripeResult.status },
          };

        case PaymentGatewayType.MOMO:
          if (!momoGateway.isEnabled()) {
            throw new Error('MoMo gateway not enabled');
          }

          const momoResult = await momoGateway.createPayment({
            orderId,
            amount: Math.round(amount),
            orderInfo: description,
            returnUrl: returnUrl || 'https://cab-booking.com/payment/return',
            notifyUrl: notifyUrl || 'https://cab-booking.com/api/payments/webhooks/momo',
            extraData: JSON.stringify(metadata || {}),
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

        case PaymentGatewayType.ZALOPAY:
          if (!zaloPayGateway.isEnabled()) {
            throw new Error('ZaloPay gateway not enabled');
          }

          const zaloPayResult = await zaloPayGateway.createPayment({
            orderId,
            amount: Math.round(amount),
            description,
            callbackUrl: notifyUrl || 'https://cab-booking.com/api/payments/webhooks/zalopay',
            redirectUrl: returnUrl || 'https://cab-booking.com/payment/return',
            embedData: metadata || {},
          });

          return {
            success: true,
            paymentUrl: zaloPayResult.orderUrl,
            orderId,
            provider: PaymentGatewayType.ZALOPAY,
            metadata: {
              appTransId: zaloPayResult.appTransId,
              zpTransToken: zaloPayResult.zpTransToken,
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
    const { provider, paymentIntentId, amount, reason } = params;

    try {
      switch (provider) {
        case PaymentGatewayType.STRIPE:
          return await stripeGateway.createRefund({
            paymentIntentId,
            amount: amount ? Math.round(amount * 100) : undefined,
            reason,
          });

        case PaymentGatewayType.MOMO:
          // MoMo refund requires additional parameters (transId, orderId)
          throw new Error('MoMo refund requires additional parameters');

        case PaymentGatewayType.ZALOPAY:
          // ZaloPay refund requires additional parameters (zpTransId, refundId)
          throw new Error('ZaloPay refund requires additional parameters');

        default:
          throw new Error(`Refund not supported for provider: ${provider}`);
      }
    } catch (error: any) {
      logger.error(`Refund failed for ${provider}:`, error);
      throw error;
    }
  }
}

export const paymentGatewayManager = new PaymentGatewayManager();
