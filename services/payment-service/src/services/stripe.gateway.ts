import Stripe from 'stripe';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface PaymentIntentResult {
  intentId: string;
  clientSecret: string;
  status: string;
}

export interface PaymentWebhookEvent {
  type: string;
  data: any;
}

class StripeGateway {
  private stripe: Stripe | null = null;
  private enabled: boolean = false;

  initialize() {
    if (config.stripe.enabled && config.stripe.secretKey) {
      this.stripe = new Stripe(config.stripe.secretKey, {
        apiVersion: '2024-12-18.acacia',
      });
      this.enabled = true;
      logger.info('✅ Stripe gateway initialized');
    } else {
      logger.info('⚠️ Stripe gateway disabled (set STRIPE_SECRET_KEY to enable)');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async createPaymentIntent(params: {
    amount: number; // in cents
    currency: string;
    customerId?: string;
    metadata?: Record<string, string>;
  }): Promise<PaymentIntentResult> {
    if (!this.stripe) {
      throw new Error('Stripe not initialized');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(params.amount),
        currency: params.currency.toLowerCase(),
        customer: params.customerId,
        metadata: params.metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      logger.info('Stripe payment intent created:', paymentIntent.id);

      return {
        intentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret || '',
        status: paymentIntent.status,
      };
    } catch (error: any) {
      logger.error('Stripe payment intent creation failed:', error);
      throw new Error(`Stripe error: ${error.message}`);
    }
  }

  async confirmPaymentIntent(intentId: string, paymentMethodId?: string): Promise<any> {
    if (!this.stripe) {
      throw new Error('Stripe not initialized');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(intentId, {
        payment_method: paymentMethodId,
      });

      logger.info('Stripe payment intent confirmed:', paymentIntent.id);
      return paymentIntent;
    } catch (error: any) {
      logger.error('Stripe payment confirmation failed:', error);
      throw new Error(`Stripe error: ${error.message}`);
    }
  }

  async retrievePaymentIntent(intentId: string): Promise<any> {
    if (!this.stripe) {
      throw new Error('Stripe not initialized');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(intentId);
      return paymentIntent;
    } catch (error: any) {
      logger.error('Stripe payment retrieval failed:', error);
      throw new Error(`Stripe error: ${error.message}`);
    }
  }

  async createRefund(params: {
    paymentIntentId: string;
    amount?: number;
    reason?: string;
  }): Promise<any> {
    if (!this.stripe) {
      throw new Error('Stripe not initialized');
    }

    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: params.paymentIntentId,
        amount: params.amount,
        reason: params.reason as any,
      });

      logger.info('Stripe refund created:', refund.id);
      return refund;
    } catch (error: any) {
      logger.error('Stripe refund failed:', error);
      throw new Error(`Stripe error: ${error.message}`);
    }
  }

  constructWebhookEvent(payload: string | Buffer, signature: string): PaymentWebhookEvent {
    if (!this.stripe) {
      throw new Error('Stripe not initialized');
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        config.stripe.webhookSecret || ''
      );

      return {
        type: event.type,
        data: event.data.object,
      };
    } catch (error: any) {
      logger.error('Stripe webhook verification failed:', error);
      throw new Error(`Webhook verification failed: ${error.message}`);
    }
  }
}

export const stripeGateway = new StripeGateway();
