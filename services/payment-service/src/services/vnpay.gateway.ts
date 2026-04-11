/**
 * VNPay Payment Gateway
 *
 * VNPay is Vietnam's leading payment gateway (similar to Stripe for VN).
 * Uses HMAC-SHA512 signature for request authentication.
 *
 * Flow:
 *  1. POST /payments/vnpay/create → build VNPay redirect URL
 *  2. User redirected to VNPay payment page
 *  3. VNPay redirects back to GET /payments/vnpay/return with result params
 *  4. Verify secure hash → update payment status
 *
 * Docs: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html
 */
import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface VNPayCreateParams {
  amount: number;       // VND, must be integer
  orderId: string;      // unique order ID (≤ 8 chars for sandbox)
  orderInfo: string;    // order description
  returnUrl?: string;
  ipAddress: string;
  locale?: 'vn' | 'en';
  bankCode?: string;    // specific bank or empty for all banks
}

export interface VNPayReturnParams {
  vnp_TmnCode: string;
  vnp_Amount: string;
  vnp_BankCode: string;
  vnp_BankTranNo?: string;
  vnp_CardType?: string;
  vnp_PayDate?: string;
  vnp_OrderInfo: string;
  vnp_TransactionNo: string;
  vnp_ResponseCode: string;
  vnp_TransactionStatus: string;
  vnp_TxnRef: string;
  vnp_SecureHashType?: string;
  vnp_SecureHash: string;
}

export interface VNPayCreateResult {
  paymentUrl: string;
  txnRef: string;
}

export class VNPayGateway {
  isEnabled(): boolean {
    return Boolean(config.vnpay.enabled && config.vnpay.tmnCode && config.vnpay.hashSecret);
  }

  /**
   * Build a VNPay redirect URL with secure hash.
   * The client should redirect the user to this URL.
   */
  createPaymentUrl(params: VNPayCreateParams): VNPayCreateResult {
    if (!config.vnpay.tmnCode || !config.vnpay.hashSecret) {
      throw new Error('VNPay is not configured. Set VNPAY_TMN_CODE and VNPAY_HASH_SECRET.');
    }

    // Keep txnRef length <= 8 chars for sandbox but avoid collisions on retries.
    const nowMs = Date.now();
    const orderPrefix = params.orderId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase().padEnd(4, 'X');
    const txnRef = `${orderPrefix}${String(nowMs).slice(-4)}`;

    const formatVNPayDate = (d: Date): string => {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).formatToParts(d);

      const pick = (type: string) => parts.find((p) => p.type === type)?.value || '';
      return `${pick('year')}${pick('month')}${pick('day')}${pick('hour')}${pick('minute')}${pick('second')}`;
    };

    const now = new Date(nowMs);
    const expire = new Date(nowMs + 15 * 60 * 1000);
    const createDate = formatVNPayDate(now);
    const expireDate = formatVNPayDate(expire);

    // VNPay requires amount in VND * 100 (integer, no decimals)
    const vnpAmount = Math.round(params.amount * 100);

    const returnUrl = params.returnUrl || config.vnpay.returnUrl;

    // Build sorted params object (VNPay requires lexicographic sort)
    const safeIpAddress = (params.ipAddress || '127.0.0.1').includes(':') ? '127.0.0.1' : (params.ipAddress || '127.0.0.1');

    const vnpParams: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: config.vnpay.tmnCode,
      vnp_Locale: params.locale || 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: params.orderInfo,
      vnp_OrderType: 'other',
      vnp_Amount: vnpAmount.toString(),
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: safeIpAddress,
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expireDate,
    };

    if (params.bankCode) {
      vnpParams.vnp_BankCode = params.bankCode;
    }

    // VNPay checksum for this merchant requires signing URL-encoded sorted params.
    const encodedParams = this.sortAndEncodeParams(vnpParams);
    const signData = this.buildSignData(encodedParams);
    const secureHash = this.hmacSha512(config.vnpay.hashSecret, signData);

    const queryString = `${this.buildSignData(encodedParams)}&vnp_SecureHash=${secureHash}`;
    const paymentUrl = `${config.vnpay.url}?${queryString}`;

    logger.info('VNPay payment URL created', { txnRef, amount: params.amount });

    return { paymentUrl, txnRef };
  }

  /**
   * Verify the return/callback from VNPay.
   * Returns { valid, success, responseCode, transactionId, txnRef, amount }
   */
  verifyReturn(query: Record<string, string>): {
    valid: boolean;
    success: boolean;
    responseCode: string;
    transactionId: string;
    txnRef: string;
    amount: number; // VND
  } {
    const normalized = Object.entries(query).reduce<Record<string, string>>((acc, [key, value]) => {
      if (key.startsWith('vnp_')) {
        acc[key] = value;
      }
      return acc;
    }, {});

    const { vnp_SecureHash, vnp_SecureHashType, ...rest } = normalized;

    // Rebuild sign data from all params except secure hash fields
    const paramsCopy = { ...rest };
    delete paramsCopy.vnp_SecureHash;
    delete paramsCopy.vnp_SecureHashType;

    // Re-encode sorted params to reconstruct VNPay's signed payload.
    const encodedParamsCopy = this.sortAndEncodeParams(paramsCopy);
    const signData = this.buildSignData(encodedParamsCopy);
    const expectedHash = this.hmacSha512(config.vnpay.hashSecret, signData);

    // Timing-safe comparison to prevent timing attacks
    const valid = this.safeEqual(expectedHash, vnp_SecureHash || '');

    if (!valid) {
      logger.warn('VNPay return signature invalid', { txnRef: rest.vnp_TxnRef });
    }

    // responseCode '00' means success
    const success = valid && rest.vnp_ResponseCode === '00';

    return {
      valid,
      success,
      responseCode: rest.vnp_ResponseCode || '',
      transactionId: rest.vnp_TransactionNo || '',
      txnRef: rest.vnp_TxnRef || '',
      // VNPay amount is amount * 100
      amount: parseInt(rest.vnp_Amount || '0', 10) / 100,
    };
  }

  /** Build the alphabetically sorted query string for signing (URL-encoded values for build) */
  private buildSignData(params: Record<string, string>): string {
    return Object.keys(params)
      .filter((k) => params[k])
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');
  }

  /** Build alphabetically sorted sign string using raw (non-encoded) values — per VNPay spec */
  private buildRawSignData(params: Record<string, string>): string {
    return Object.keys(params)
      .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');
  }

  /** VNPay requires sorted params and value encoding (space as '+') before signing */
  private sortAndEncodeParams(params: Record<string, string>): Record<string, string> {
    const sortedKeys = Object.keys(params)
      .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
      .sort();

    const encoded: Record<string, string> = {};
    for (const key of sortedKeys) {
      encoded[key] = encodeURIComponent(params[key]).replace(/%20/g, '+');
    }

    return encoded;
  }

  /** HMAC-SHA512 hash */
  private hmacSha512(secret: string, data: string): string {
    return crypto.createHmac('sha512', secret).update(data, 'utf-8').digest('hex');
  }

  /**
   * Create a refund for a completed VNPay transaction.
   *
   * API: POST https://sandbox.vnpayment.vn/merchant_webapi/api/transaction
   * Signature: pipe-separated raw string (NOT URL-encoded) of these fields in order:
   *   vnp_RequestId|vnp_Version|vnp_Command|vnp_TmnCode|vnp_TransactionType|
   *   vnp_TxnRef|vnp_Amount|vnp_TransactionNo|vnp_TransactionDate|
   *   vnp_CreateBy|vnp_CreateDate|vnp_IpAddr|vnp_OrderInfo
   *
   * @param params.txnRef         Original vnp_TxnRef from completed payment
   * @param params.transactionNo  Original vnp_TransactionNo (use "0" if unknown)
   * @param params.transactionDate Original vnp_PayDate (yyyyMMddHHmmss, VN timezone)
   * @param params.amount         Refund amount in VND (integer)
   * @param params.reason         Human-readable refund reason
   * @param params.createBy       Operator identifier (defaults to "admin")
   */
  async createRefund(params: {
    txnRef: string;
    transactionNo: string;
    transactionDate: string;
    amount: number;
    reason: string;
    createBy?: string;
  }): Promise<{ responseCode: string; message: string; transactionNo?: string }> {
    if (!config.vnpay.tmnCode || !config.vnpay.hashSecret) {
      throw new Error('VNPay is not configured. Set VNPAY_TMN_CODE and VNPAY_HASH_SECRET.');
    }

    const requestId = `${Date.now()}`;
    const createBy = params.createBy || 'admin';
    const createDate = this.formatVNPayDate(new Date());
    const vnpAmount = Math.round(params.amount * 100);

    const rawSignData = [
      requestId,
      '2.1.0',
      'refund',
      config.vnpay.tmnCode,
      '02', // full refund type
      params.txnRef,
      String(vnpAmount),
      params.transactionNo,
      params.transactionDate,
      createBy,
      createDate,
      '127.0.0.1',
      params.reason,
    ].join('|');

    const secureHash = this.hmacSha512(config.vnpay.hashSecret, rawSignData);

    const requestBody = {
      vnp_RequestId: requestId,
      vnp_Version: '2.1.0',
      vnp_Command: 'refund',
      vnp_TmnCode: config.vnpay.tmnCode,
      vnp_TransactionType: '02',
      vnp_TxnRef: params.txnRef,
      vnp_Amount: vnpAmount,
      vnp_TransactionNo: params.transactionNo,
      vnp_TransactionDate: params.transactionDate,
      vnp_CreateBy: createBy,
      vnp_CreateDate: createDate,
      vnp_IpAddr: '127.0.0.1',
      vnp_OrderInfo: params.reason,
      vnp_SecureHash: secureHash,
    };

    const axios = await import('axios');
    const response = await axios.default.post(
      config.vnpay.apiUrl,
      requestBody,
      { headers: { 'Content-Type': 'application/json' } },
    );

    const data = response.data as Record<string, any>;
    logger.info('VNPay refund API response', {
      txnRef: params.txnRef,
      responseCode: data.vnp_ResponseCode,
      message: data.vnp_Message,
    });

    return {
      responseCode: String(data.vnp_ResponseCode || '99'),
      message: String(data.vnp_Message || 'Unknown'),
      transactionNo: data.vnp_TransactionNo ? String(data.vnp_TransactionNo) : undefined,
    };
  }

  /** Format a Date to yyyyMMddHHmmss in Asia/Ho_Chi_Minh timezone */
  private formatVNPayDate(d: Date): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const pick = (type: string) => parts.find((p) => p.type === type)?.value || '';
    return `${pick('year')}${pick('month')}${pick('day')}${pick('hour')}${pick('minute')}${pick('second')}`;
  }

  /** Timing-safe string comparison */
  private safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
      return false;
    }
  }
}

export const vnpayGateway = new VNPayGateway();
