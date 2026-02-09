import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface ZaloPayPaymentResult {
  orderUrl: string;
  zpTransToken: string;
  orderId: string;
  appTransId: string;
}

class ZaloPayGateway {
  private enabled: boolean = false;
  private appId: string = '';
  private key1: string = '';
  private key2: string = '';
  private endpoint: string = '';

  initialize() {
    if (config.zalopay.enabled && config.zalopay.appId && config.zalopay.key1) {
      this.enabled = true;
      this.appId = config.zalopay.appId;
      this.key1 = config.zalopay.key1;
      this.key2 = config.zalopay.key2;
      this.endpoint = config.zalopay.endpoint;
      logger.info('✅ ZaloPay gateway initialized');
    } else {
      logger.info('⚠️ ZaloPay gateway disabled (set ZALOPAY credentials to enable)');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private generateMac(data: string): string {
    return crypto.createHmac('sha256', this.key1).update(data).digest('hex');
  }

  private generateCallbackMac(data: string): string {
    return crypto.createHmac('sha256', this.key2).update(data).digest('hex');
  }

  async createPayment(params: {
    orderId: string;
    amount: number;
    description: string;
    bankCode?: string;
    callbackUrl: string;
    redirectUrl: string;
    embedData?: Record<string, any>;
  }): Promise<ZaloPayPaymentResult> {
    if (!this.enabled) {
      throw new Error('ZaloPay gateway not enabled');
    }

    try {
      const timestamp = Date.now();
      const appTransId = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(
        new Date().getDate()
      ).padStart(2, '0')}_${params.orderId}`;

      const embedData = JSON.stringify(params.embedData || {});
      const items = JSON.stringify([
        {
          itemid: params.orderId,
          itemname: params.description,
          itemprice: params.amount,
          itemquantity: 1,
        },
      ]);

      const macData = `${this.appId}|${appTransId}|${params.amount}|${params.description}|${timestamp}|${embedData}|${items}`;
      const mac = this.generateMac(macData);

      const requestBody = {
        app_id: this.appId,
        app_trans_id: appTransId,
        app_user: params.orderId,
        app_time: timestamp,
        amount: params.amount,
        item: items,
        embed_data: embedData,
        description: params.description,
        bank_code: params.bankCode || '',
        callback_url: params.callbackUrl,
        mac,
      };

      logger.info('Creating ZaloPay payment:', { orderId: params.orderId, amount: params.amount });

      const response = await axios.post(`${this.endpoint}/v2/create`, requestBody, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      });

      if (response.data.return_code === 1) {
        logger.info('ZaloPay payment created:', appTransId);
        return {
          orderUrl: response.data.order_url,
          zpTransToken: response.data.zp_trans_token,
          orderId: params.orderId,
          appTransId: appTransId,
        };
      } else {
        throw new Error(`ZaloPay error: ${response.data.return_message}`);
      }
    } catch (error: any) {
      logger.error('ZaloPay payment creation failed:', error);
      throw new Error(`ZaloPay error: ${error.message}`);
    }
  }

  async queryPaymentStatus(appTransId: string): Promise<any> {
    if (!this.enabled) {
      throw new Error('ZaloPay gateway not enabled');
    }

    try {
      const macData = `${this.appId}|${appTransId}|${this.key1}`;
      const mac = this.generateMac(macData);

      const requestBody = {
        app_id: this.appId,
        app_trans_id: appTransId,
        mac,
      };

      const response = await axios.post(`${this.endpoint}/v2/query`, requestBody, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      });

      return response.data;
    } catch (error: any) {
      logger.error('ZaloPay query failed:', error);
      throw new Error(`ZaloPay error: ${error.message}`);
    }
  }

  verifyCallbackMac(data: string, receivedMac: string): boolean {
    const calculatedMac = this.generateCallbackMac(data);
    return calculatedMac === receivedMac;
  }

  async createRefund(params: {
    zpTransId: string;
    amount: number;
    description: string;
    refundId: string;
  }): Promise<any> {
    if (!this.enabled) {
      throw new Error('ZaloPay gateway not enabled');
    }

    try {
      const timestamp = Date.now();
      const mRefundId = `${timestamp}_${params.refundId}`;

      const macData = `${this.appId}|${params.zpTransId}|${params.amount}|${params.description}|${timestamp}`;
      const mac = this.generateMac(macData);

      const requestBody = {
        app_id: this.appId,
        zp_trans_id: params.zpTransId,
        amount: params.amount,
        description: params.description,
        timestamp,
        m_refund_id: mRefundId,
        mac,
      };

      const response = await axios.post(`${this.endpoint}/v2/refund`, requestBody, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      });

      logger.info('ZaloPay refund created:', response.data);
      return response.data;
    } catch (error: any) {
      logger.error('ZaloPay refund failed:', error);
      throw new Error(`ZaloPay error: ${error.message}`);
    }
  }
}

export const zaloPayGateway = new ZaloPayGateway();
