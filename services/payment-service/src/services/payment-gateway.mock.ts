import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

/**
 * Mock Payment Gateway for MoMo and Visa
 * Simulates real payment gateway behavior without actual integration
 */

export interface PaymentGatewayResult {
  success: boolean;
  transactionId: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  message: string;
  providerResponse?: any;
}

export enum PaymentGatewayType {
  MOMO = 'MOMO',
  VISA = 'VISA',
}

/**
 * Base Mock Payment Gateway
 */
abstract class MockPaymentGateway {
  protected gatewayName: string;

  constructor(gatewayName: string) {
    this.gatewayName = gatewayName;
  }

  /**
   * Process payment with simulated delay and random outcomes
   */
  async processPayment(
    amount: number,
    currency: string,
    orderId: string,
    customerInfo?: any
  ): Promise<PaymentGatewayResult> {
    logger.info(`[${this.gatewayName}] Processing payment for order ${orderId}: ${amount} ${currency}`);

    // Simulate network delay (1-3 seconds)
    const delayMs = 1000 + Math.random() * 2000;
    await this.simulateDelay(delayMs);

    // Simulate success/failure (90% success rate)
    const random = Math.random();
    
    if (random < 0.90) {
      // Success
      const transactionId = this.generateTransactionId();
      logger.info(`[${this.gatewayName}] Payment SUCCESS - Transaction ID: ${transactionId}`);
      
      return {
        success: true,
        transactionId,
        status: 'SUCCESS',
        message: `Payment processed successfully via ${this.gatewayName}`,
        providerResponse: this.generateSuccessResponse(transactionId, amount, currency, orderId),
      };
    } else {
      // Failure
      const failureReason = this.getRandomFailureReason();
      logger.warn(`[${this.gatewayName}] Payment FAILED - Reason: ${failureReason}`);
      
      return {
        success: false,
        transactionId: `FAIL_${uuidv4().slice(0, 8)}`,
        status: 'FAILED',
        message: failureReason,
        providerResponse: this.generateFailureResponse(failureReason, orderId),
      };
    }
  }

  /**
   * Verify payment status (for async processing)
   */
  async verifyPayment(transactionId: string): Promise<PaymentGatewayResult> {
    logger.info(`[${this.gatewayName}] Verifying transaction ${transactionId}`);
    
    await this.simulateDelay(500);

    // Mock verification always returns success if transaction ID is valid
    if (transactionId.startsWith('FAIL_')) {
      return {
        success: false,
        transactionId,
        status: 'FAILED',
        message: 'Transaction verification failed',
      };
    }

    return {
      success: true,
      transactionId,
      status: 'SUCCESS',
      message: 'Transaction verified successfully',
    };
  }

  protected abstract generateTransactionId(): string;
  protected abstract generateSuccessResponse(transactionId: string, amount: number, currency: string, orderId: string): any;
  protected abstract generateFailureResponse(reason: string, orderId: string): any;
  protected abstract getRandomFailureReason(): string;

  protected async simulateDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * MoMo Payment Gateway Mock
 */
export class MoMoGatewayMock extends MockPaymentGateway {
  constructor() {
    super('MoMo');
  }

  protected generateTransactionId(): string {
    return `MOMO_${Date.now()}_${uuidv4().slice(0, 8).toUpperCase()}`;
  }

  protected generateSuccessResponse(transactionId: string, amount: number, currency: string, orderId: string) {
    return {
      partnerCode: 'MOCK_PARTNER',
      requestId: orderId,
      orderId,
      transId: transactionId,
      amount,
      resultCode: 0,
      message: 'Giao dịch thành công',
      responseTime: Date.now(),
      payType: 'qr',
      signature: `MOCK_SIGNATURE_${uuidv4()}`,
    };
  }

  protected generateFailureResponse(reason: string, orderId: string) {
    const errorCodes: Record<string, number> = {
      'Insufficient balance': 1001,
      'Transaction timeout': 1004,
      'User cancelled transaction': 1005,
      'Invalid OTP': 2001,
      'Account locked': 3001,
    };

    return {
      partnerCode: 'MOCK_PARTNER',
      requestId: orderId,
      orderId,
      resultCode: errorCodes[reason] || 9999,
      message: reason,
      responseTime: Date.now(),
    };
  }

  protected getRandomFailureReason(): string {
    const reasons = [
      'Insufficient balance',
      'Transaction timeout',
      'User cancelled transaction',
      'Invalid OTP',
      'Account locked',
    ];
    return reasons[Math.floor(Math.random() * reasons.length)];
  }
}

/**
 * Visa Payment Gateway Mock
 */
export class VisaGatewayMock extends MockPaymentGateway {
  constructor() {
    super('Visa');
  }

  protected generateTransactionId(): string {
    return `VISA_${Date.now()}_${uuidv4().slice(0, 12).toUpperCase()}`;
  }

  protected generateSuccessResponse(transactionId: string, amount: number, currency: string, orderId: string) {
    return {
      id: transactionId,
      object: 'payment_intent',
      amount: amount * 100, // Visa uses smallest currency unit (cents/dong)
      currency: currency.toLowerCase(),
      status: 'succeeded',
      captured: true,
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      metadata: {
        orderId,
      },
      charges: {
        data: [
          {
            id: `ch_${uuidv4()}`,
            amount: amount * 100,
            currency: currency.toLowerCase(),
            status: 'succeeded',
            paid: true,
            payment_method_details: {
              card: {
                brand: 'visa',
                last4: '4242',
                exp_month: 12,
                exp_year: 2028,
              },
              type: 'card',
            },
          },
        ],
      },
    };
  }

  protected generateFailureResponse(reason: string, orderId: string) {
    const errorCodes: Record<string, string> = {
      'Card declined': 'card_declined',
      'Insufficient funds': 'insufficient_funds',
      'Expired card': 'expired_card',
      'Invalid CVV': 'incorrect_cvc',
      'Processing error': 'processing_error',
    };

    return {
      error: {
        type: 'card_error',
        code: errorCodes[reason] || 'processing_error',
        message: reason,
        decline_code: errorCodes[reason],
      },
      metadata: {
        orderId,
      },
    };
  }

  protected getRandomFailureReason(): string {
    const reasons = [
      'Card declined',
      'Insufficient funds',
      'Expired card',
      'Invalid CVV',
      'Processing error',
    ];
    return reasons[Math.floor(Math.random() * reasons.length)];
  }
}

/**
 * Factory to get appropriate gateway based on payment method
 */
export class PaymentGatewayFactory {
  private static momoGateway: MoMoGatewayMock;
  private static visaGateway: VisaGatewayMock;

  static getGateway(type: PaymentGatewayType): MockPaymentGateway {
    switch (type) {
      case PaymentGatewayType.MOMO:
        if (!this.momoGateway) {
          this.momoGateway = new MoMoGatewayMock();
        }
        return this.momoGateway;
      
      case PaymentGatewayType.VISA:
        if (!this.visaGateway) {
          this.visaGateway = new VisaGatewayMock();
        }
        return this.visaGateway;
      
      default:
        throw new Error(`Unsupported payment gateway: ${type}`);
    }
  }
}
