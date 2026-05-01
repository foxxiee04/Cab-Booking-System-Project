import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface MoMoPaymentResult {
  payUrl: string;
  deeplink: string;
  qrCodeUrl: string;
  orderId: string;
  requestId: string;
}

class MoMoGateway {
  private enabled: boolean = false;
  private partnerCode: string = '';
  private accessKey: string = '';
  private secretKey: string = '';
  private endpoint: string = '';

  initialize() {
    if (config.momo.enabled && config.momo.partnerCode && config.momo.secretKey) {
      this.enabled = true;
      this.partnerCode = config.momo.partnerCode;
      this.accessKey = config.momo.accessKey;
      this.secretKey = config.momo.secretKey;
      this.endpoint = config.momo.endpoint;
      logger.info('✅ MoMo gateway initialized');
    } else {
      logger.info('⚠️ MoMo gateway disabled (set MOMO credentials to enable)');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private generateSignature(data: Record<string, any>): string {
    const rawSignature = Object.keys(data)
      .sort()
      .map((key) => `${key}=${data[key]}`)
      .join('&');

    return crypto
      .createHmac('sha256', this.secretKey)
      .update(rawSignature)
      .digest('hex');
  }

  private signRaw(rawSignature: string): string {
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(rawSignature)
      .digest('hex');
  }

  async createPayment(params: {
    orderId: string;
    amount: number;
    orderInfo: string;
    returnUrl: string;
    notifyUrl: string;
    extraData?: string;
    requestType?: string;
    paymentCode?: string;
    orderGroupId?: string;
    autoCapture?: boolean;
  }): Promise<MoMoPaymentResult> {
    if (!this.enabled) {
      throw new Error('MoMo gateway not enabled');
    }

    try {
      const requestId = `${Date.now()}-${params.orderId}`;
      const requestType = params.requestType || config.momo.requestType || 'payWithMethod';
      const autoCapture = typeof params.autoCapture === 'boolean' ? params.autoCapture : config.momo.autoCapture;
      const paymentCode = params.paymentCode
        || (requestType === 'payWithMethod' ? '' : (config.momo.paymentCode || ''));

      const rawData = {
        accessKey: this.accessKey,
        amount: params.amount.toString(),
        extraData: params.extraData || '',
        ipnUrl: params.notifyUrl,
        orderId: params.orderId,
        orderInfo: params.orderInfo,
        partnerCode: this.partnerCode,
        redirectUrl: params.returnUrl,
        requestId,
        requestType,
      };

      // MoMo create API expects fixed-order signing (AIO v2 contract).
      const rawSignature =
        `accessKey=${rawData.accessKey}` +
        `&amount=${rawData.amount}` +
        `&extraData=${rawData.extraData}` +
        `&ipnUrl=${rawData.ipnUrl}` +
        `&orderId=${rawData.orderId}` +
        `&orderInfo=${rawData.orderInfo}` +
        `&partnerCode=${rawData.partnerCode}` +
        `&redirectUrl=${rawData.redirectUrl}` +
        `&requestId=${rawData.requestId}` +
        `&requestType=${rawData.requestType}`;
      const signature = this.signRaw(rawSignature);

      const requestBody = {
        ...rawData,
        partnerName: config.momo.partnerName,
        storeId: config.momo.storeId,
        signature,
        lang: 'vi',
        autoCapture,
        orderGroupId: params.orderGroupId || '',
        ...(paymentCode ? { paymentCode } : {}),
      };

      logger.info('Creating MoMo payment:', { orderId: params.orderId, amount: params.amount });

      const response = await axios.post(`${this.endpoint}/v2/gateway/api/create`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      if (response.data.resultCode === 0) {
        logger.info('MoMo payment created:', response.data.orderId);
        return {
          payUrl: response.data.payUrl,
          deeplink: response.data.deeplink,
          qrCodeUrl: response.data.qrCodeUrl,
          orderId: response.data.orderId,
          requestId: response.data.requestId,
        };
      } else {
        throw new Error(`MoMo error: ${response.data.message}`);
      }
    } catch (error: any) {
      logger.error('MoMo payment creation failed:', error);
      throw new Error(`MoMo error: ${error.message}`);
    }
  }

  async queryPaymentStatus(params: { orderId: string; requestId: string }): Promise<any> {
    if (!this.enabled) {
      throw new Error('MoMo gateway not enabled');
    }

    try {
      const rawData = {
        accessKey: this.accessKey,
        orderId: params.orderId,
        partnerCode: this.partnerCode,
        requestId: params.requestId,
      };

      const signature = this.generateSignature(rawData);

      const requestBody = {
        ...rawData,
        signature,
        lang: 'vi',
      };

      const response = await axios.post(`${this.endpoint}/v2/gateway/api/query`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      return response.data;
    } catch (error: any) {
      logger.error('MoMo query failed:', error);
      throw new Error(`MoMo error: ${error.message}`);
    }
  }

  verifyWebhookSignature(data: Record<string, any>, signature: string): boolean {
    const calculatedSignature = this.generateSignature(data);
    return calculatedSignature === signature;
  }

  async createRefund(params: {
    orderId: string;
    requestId: string;
    amount: number;
    transId: string;
    description: string;
  }): Promise<any> {
    if (!this.enabled) {
      throw new Error('MoMo gateway not enabled');
    }

    try {
      const rawData = {
        accessKey: this.accessKey,
        amount: params.amount.toString(),
        description: params.description,
        orderId: params.orderId,
        partnerCode: this.partnerCode,
        requestId: params.requestId,
        transId: params.transId,
      };

      const signature = this.generateSignature(rawData);

      const requestBody = {
        ...rawData,
        signature,
        lang: 'vi',
      };

      const response = await axios.post(`${this.endpoint}/v2/gateway/api/refund`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      logger.info('MoMo refund created:', response.data);
      return response.data;
    } catch (error: any) {
      logger.error('MoMo refund failed:', error);
      throw new Error(`MoMo error: ${error.message}`);
    }
  }
}

export const momoGateway = new MoMoGateway();
