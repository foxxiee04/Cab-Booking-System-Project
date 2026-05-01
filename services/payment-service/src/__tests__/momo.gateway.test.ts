import axios from 'axios';
import { config } from '../config';
import { momoGateway } from '../services/momo.gateway';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MoMo gateway createPayment', () => {
  const originalMomoConfig = { ...config.momo };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(config.momo, {
      ...originalMomoConfig,
      enabled: true,
      partnerCode: 'MOMO',
      accessKey: 'F8BBA842ECF85',
      secretKey: 'K951B6PE1waDMi640xX08PD3vg6EkVlz',
      endpoint: 'https://test-payment.momo.vn',
      requestType: 'payWithMethod',
      autoCapture: true,
      paymentCode: '',
    });
    momoGateway.initialize();
  });

  afterAll(() => {
    Object.assign(config.momo, originalMomoConfig);
  });

  it('uses payWithMethod flow and does not inject paymentCode from config', async () => {
    Object.assign(config.momo, {
      requestType: 'payWithMethod',
      paymentCode: 'FORCE_QR_CODE',
    });
    momoGateway.initialize();

    mockedAxios.post.mockResolvedValue({
      data: {
        resultCode: 0,
        payUrl: 'https://test-payment.momo.vn/pay',
        deeplink: 'momo://payment',
        qrCodeUrl: 'https://momo.vn/qr',
        orderId: 'ride-001',
        requestId: 'req-001',
      },
    } as any);

    const result = await momoGateway.createPayment({
      orderId: 'ride-001',
      amount: 50000,
      orderInfo: 'Payment for ride',
      returnUrl: 'https://app.local/payment/callback',
      notifyUrl: 'https://api.local/payments/ipn/momo',
    });

    expect(result.payUrl).toBe('https://test-payment.momo.vn/pay');
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    const [, requestBody] = mockedAxios.post.mock.calls[0] as [string, Record<string, any>];
    expect(requestBody.requestType).toBe('payWithMethod');
    expect(requestBody).not.toHaveProperty('paymentCode');
  });

  it('keeps paymentCode for non-payWithMethod requests', async () => {
    Object.assign(config.momo, {
      requestType: 'captureWallet',
      paymentCode: 'FORCE_QR_CODE',
    });
    momoGateway.initialize();

    mockedAxios.post.mockResolvedValue({
      data: {
        resultCode: 0,
        payUrl: 'https://test-payment.momo.vn/pay',
        deeplink: 'momo://payment',
        qrCodeUrl: 'https://momo.vn/qr',
        orderId: 'ride-002',
        requestId: 'req-002',
      },
    } as any);

    await momoGateway.createPayment({
      orderId: 'ride-002',
      amount: 75000,
      orderInfo: 'Payment for ride',
      returnUrl: 'https://app.local/payment/callback',
      notifyUrl: 'https://api.local/payments/ipn/momo',
    });

    const [, requestBody] = mockedAxios.post.mock.calls[0] as [string, Record<string, any>];
    expect(requestBody.requestType).toBe('captureWallet');
    expect(requestBody.paymentCode).toBe('FORCE_QR_CODE');
  });
});
