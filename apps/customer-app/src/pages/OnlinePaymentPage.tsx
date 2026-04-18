import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';
import { paymentApi } from '../api/payment.api';
import { rideApi } from '../api/ride.api';
import voucherApi, { ApplyVoucherResult } from '../api/voucher.api';
import { QRCodePayment } from '../components/payment/QRCodePayment';

export type PaymentMethod = 'CASH' | 'MOMO' | 'VNPAY';

const OnlinePaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const { rideId } = useParams<{ rideId: string }>();
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const providerParam = (searchParams.get('provider') || '').toUpperCase();
  const initialMethod: PaymentMethod = providerParam === 'VNPAY' ? 'VNPAY' : 'MOMO';
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(initialMethod);
  const [amount, setAmount] = useState<number>(0);
  const [voucherPreview, setVoucherPreview] = useState<ApplyVoucherResult | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string>('');
  const [deeplink, setDeeplink] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [processing, setProcessing] = useState(false);

  const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        window.setTimeout(() => reject(new Error('Gateway request timeout')), ms)
      ),
    ]);
  };

  const applySandboxFallback = (method: 'MOMO' | 'VNPAY') => {
    const mockParams = new URLSearchParams({
      provider: method,
      rideId: rideId || '',
      amount: String(amount),
    });
    const mockUrl = `${window.location.origin}/payment/sandbox-gateway?${mockParams.toString()}`;
    setPaymentUrl(mockUrl);
    setDeeplink(mockUrl);
    setQrCodeUrl('');
  };

  const buildReturnUrl = (provider: 'MOMO' | 'VNPAY') => {
    if (provider === 'VNPAY') {
      // VNPay signature is sensitive to returnUrl query separators.
      return `${window.location.origin}/payment/callback`;
    }

    const callbackParams = new URLSearchParams({
      provider,
      rideId: rideId || '',
    });
    return `${window.location.origin}/payment/callback?${callbackParams.toString()}`;
  };

  // Resolve amount from query first; fallback to ride/payment data for retry/resume flows.
  useEffect(() => {
    let cancelled = false;

    const resolveAmount = async () => {
      if (!rideId) {
        setLoading(false);
        return;
      }

      const amountParam = Number(searchParams.get('amount') || 0);
      const voucherCodeParam = (searchParams.get('voucherCode') || '').trim().toUpperCase();
      const originalAmountParam = Number(searchParams.get('originalAmount') || 0);
      const discountAmountParam = Number(searchParams.get('discountAmount') || 0);

      if (Number.isFinite(amountParam) && amountParam > 0) {
        if (!cancelled) {
          setAmount(Math.round(amountParam));
          if (voucherCodeParam && Number.isFinite(originalAmountParam) && originalAmountParam > 0 && Number.isFinite(discountAmountParam) && discountAmountParam > 0) {
            setVoucherPreview({
              voucherId: '',
              code: voucherCodeParam,
              originalAmount: Math.round(originalAmountParam),
              discountAmount: Math.round(discountAmountParam),
              finalAmount: Math.round(amountParam),
            });
          } else {
            setVoucherPreview(null);
          }
          setLoading(false);
        }
        return;
      }

      try {
        const [rideResult, paymentResult] = await Promise.allSettled([
          rideApi.getRide(rideId),
          paymentApi.getPaymentByRide(rideId),
        ]);

        if (cancelled) {
          return;
        }

        const rideData = rideResult.status === 'fulfilled' ? (rideResult.value?.data?.ride || {}) as Record<string, any> : {};
        const paymentData = paymentResult.status === 'fulfilled' ? (paymentResult.value?.data?.payment || {}) as Record<string, any> : {};

        const rideFare = Number(
          rideData.fare
          || rideData.estimatedFare
          || rideData.totalFare
          || rideData.finalFare
          || 0
        );
        const paymentAmount = Number(paymentData.amount || paymentData.totalAmount || 0);
        const paymentFinalAmount = Number(paymentData.finalAmount || 0);
        const paymentDiscountAmount = Number(paymentData.discountAmount || 0);
        const resolvedVoucherCode = (voucherCodeParam || paymentData.voucherCode || rideData.voucherCode || '').trim().toUpperCase();

        if (paymentFinalAmount > 0) {
          setAmount(Math.round(paymentFinalAmount));
          setVoucherPreview(
            resolvedVoucherCode && paymentDiscountAmount > 0
              ? {
                  voucherId: '',
                  code: resolvedVoucherCode,
                  originalAmount: Math.round(Number(paymentData.amount || rideFare || paymentFinalAmount)),
                  discountAmount: Math.round(paymentDiscountAmount),
                  finalAmount: Math.round(paymentFinalAmount),
                }
              : null,
          );
          return;
        }

        if (resolvedVoucherCode && rideFare > 0) {
          try {
            const voucherResponse = await voucherApi.applyVoucher(resolvedVoucherCode, rideFare);
            if (cancelled) {
              return;
            }

            setVoucherPreview(voucherResponse.data.data);
            setAmount(Math.round(voucherResponse.data.data.finalAmount));
            return;
          } catch {
            // Fall back to payment / ride amount below when voucher is no longer applicable.
          }
        }

        const resolvedAmount = paymentAmount > 0 ? paymentAmount : rideFare;

        if (resolvedAmount > 0) {
          setAmount(Math.round(resolvedAmount));
          setVoucherPreview(null);
        } else {
          setError('Không thể xác định số tiền thanh toán cho chuyến đi này.');
        }
      } catch {
        if (!cancelled) {
          setError('Không thể tải thông tin thanh toán. Vui lòng thử lại.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void resolveAmount();

    return () => {
      cancelled = true;
    };
  }, [rideId, searchParams]);

  // Create payment intent when method changes
  useEffect(() => {
    if (!rideId || !amount) return;
    
    const createPayment = async () => {
      try {
        setProcessing(true);
        setError('');

        if (selectedMethod === 'MOMO') {
          const response = await withTimeout(
            paymentApi.createMomoPayment({
              rideId,
              amount,
              returnUrl: buildReturnUrl('MOMO'),
            }),
            12000,
          );

          const directUrl = response.data.payUrl || response.data.paymentUrl || '';
          const qrUrl = response.data.qrCodeUrl || '';
          const appDeeplink = response.data.deeplink || directUrl;

          if (response.success && directUrl) {
            setPaymentUrl(directUrl);
            setDeeplink(appDeeplink);
            setQrCodeUrl(qrUrl);
          } else if (response.success && response.data.status === 'COMPLETED') {
            setPaymentUrl('');
            setDeeplink('');
            setQrCodeUrl('');
            setError('Giao dịch này đã được thanh toán trước đó. Vui lòng kiểm tra trạng thái chuyến đi.');
          } else {
            applySandboxFallback('MOMO');
            setError('Không lấy được liên kết MoMo sandbox trực tiếp. Hệ thống chuyển sang cổng sandbox nội bộ.');
          }
        } else if (selectedMethod === 'VNPAY') {
          const response = await withTimeout(
            paymentApi.createVnpayPayment({
              rideId,
              amount,
              returnUrl: buildReturnUrl('VNPAY'),
            }),
            12000,
          );

          const directUrl = response.data.paymentUrl || response.data.payUrl || '';
          const qrUrl = response.data.qrCodeUrl || '';
          const appDeeplink = response.data.deeplink || directUrl;

          if (response.success && directUrl) {
            setPaymentUrl(directUrl);
            setDeeplink(appDeeplink);
            setQrCodeUrl(qrUrl);
          } else if (response.success && response.data.status === 'COMPLETED') {
            setPaymentUrl('');
            setDeeplink('');
            setQrCodeUrl('');
            setError('Giao dịch này đã được thanh toán trước đó. Vui lòng kiểm tra trạng thái chuyến đi.');
          } else {
            applySandboxFallback('VNPAY');
            setError('Không lấy được liên kết VNPay sandbox trực tiếp. Hệ thống chuyển sang cổng sandbox nội bộ.');
          }
        }
      } catch (err: any) {
        applySandboxFallback(selectedMethod as 'MOMO' | 'VNPAY');
        setError('Không thể khởi tạo thanh toán trực tiếp từ sandbox. Hệ thống chuyển sang cổng sandbox nội bộ.');
        console.error('Payment creation error:', err);
      } finally {
        setProcessing(false);
      }
    };

    createPayment();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMethod, rideId, amount]);

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Box display="flex" justifyContent="center">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!rideId || !amount || amount <= 0) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Alert severity="error">
          Thiếu thông tin chuyến đi hoặc số tiền thanh toán
        </Alert>
        <Button onClick={() => (rideId ? navigate(`/ride/${rideId}`) : navigate('/home'))} sx={{ mt: 2 }}>
          Quay lại
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box display="flex" alignItems="center" gap={1}>
          <Button
            variant="text"
            startIcon={<BackIcon />}
            onClick={() => navigate(-1)}
          >
            Quay lại
          </Button>
          <Typography variant="h6" fontWeight={800}>
            Thanh toán trực tuyến
          </Typography>
        </Box>

        {/* Method Selection */}
        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Chọn phương thức thanh toán
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button
                fullWidth
                variant={selectedMethod === 'MOMO' ? 'contained' : 'outlined'}
                onClick={() => setSelectedMethod('MOMO')}
                disabled={processing}
              >
                💰 MoMo
              </Button>
              <Button
                fullWidth
                variant={selectedMethod === 'VNPAY' ? 'contained' : 'outlined'}
                onClick={() => setSelectedMethod('VNPAY')}
                disabled={processing}
              >
                🏧 VNPay
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {/* Amount Display */}
        <Card sx={{ borderRadius: 3, bgcolor: 'success.light' }}>
          <CardContent sx={{ textAlign: 'center' }}>
            {voucherPreview ? (
              <Stack spacing={1.25}>
                <Typography variant="body2" color="text.secondary">
                  Số tiền cần thanh toán sau ưu đãi
                </Typography>
                <Typography variant="h4" fontWeight={800} color="success.dark">
                  {amount.toLocaleString('vi-VN')} ₫
                </Typography>
                <Divider />
                <Stack direction="row" justifyContent="space-between" spacing={2}>
                  <Typography variant="body2" color="text.secondary">Cước gốc</Typography>
                  <Typography variant="body2" fontWeight={700}>{voucherPreview.originalAmount.toLocaleString('vi-VN')} ₫</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" spacing={2}>
                  <Typography variant="body2" color="success.dark">Ưu đãi {voucherPreview.code}</Typography>
                  <Typography variant="body2" fontWeight={700} color="success.dark">-{voucherPreview.discountAmount.toLocaleString('vi-VN')} ₫</Typography>
                </Stack>
              </Stack>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Số tiền cần thanh toán
                </Typography>
                <Typography variant="h4" fontWeight={800} color="success.dark">
                  {amount.toLocaleString('vi-VN')} ₫
                </Typography>
              </>
            )}
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Payment Processing */}
        {processing && (
          <Box display="flex" justifyContent="center" py={4}>
            <Stack alignItems="center" spacing={2}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">
                Đang tạo liên kết thanh toán...
              </Typography>
            </Stack>
          </Box>
        )}

        {/* QR Code Payment Component */}
        {!processing && paymentUrl && (
          <QRCodePayment
            paymentUrl={paymentUrl}
            paymentMethod={selectedMethod as 'MOMO' | 'VNPAY'}
            amount={amount}
            orderId={rideId}
            rideId={rideId}
            deeplink={deeplink}
            qrCodeUrl={qrCodeUrl}
            onCancel={() => navigate(-1)}
            onContinue={() => {
              window.location.href = paymentUrl;
            }}
          />
        )}

        {/* Info Cards */}
        <Card variant="outlined" sx={{ bgcolor: 'rgba(25, 118, 210, 0.05)' }}>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Thông tin giao dịch
            </Typography>
            <Stack spacing={1} sx={{ mt: 2, fontSize: '0.875rem' }}>
              <Box>
                <Typography variant="caption" display="block" color="text.secondary">
                  Chuyến đi ID:
                </Typography>
                <Typography variant="body2" fontFamily="monospace">
                  {rideId}
                </Typography>
              </Box>
              <Divider />
              <Box>
                <Typography variant="caption" display="block" color="text.secondary">
                  Phương thức:
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {selectedMethod === 'MOMO' ? 'Ví MoMo' : 'VNPay QR/Ngân hàng'}
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
};

export default OnlinePaymentPage;
