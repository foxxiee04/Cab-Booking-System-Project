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
  Stack,
  Typography,
} from '@mui/material';
import {
  ArrowBackRounded as BackIcon,
  CheckCircleRounded,
  LocalOfferRounded,
  PaymentRounded,
} from '@mui/icons-material';
import { paymentApi } from '../api/payment.api';
import { rideApi } from '../api/ride.api';
import voucherApi, { ApplyVoucherResult } from '../api/voucher.api';
import { QRCodePayment } from '../components/payment/QRCodePayment';
import { allowPaymentInternalFallback } from '../config/payment-flags';

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
          } else if (allowPaymentInternalFallback) {
            applySandboxFallback('MOMO');
            setError('sandbox: Đang dùng cổng thử nghiệm MoMo nội bộ.');
          } else {
            setPaymentUrl('');
            setDeeplink('');
            setQrCodeUrl('');
            setError(
              'Không nhận được link thanh toán MoMo từ server. Bật MOMO_ENABLED và cấu hình khóa sandbox trong payment-service, hoặc bật lại REACT_APP_PAYMENT_INTERNAL_FALLBACK.',
            );
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
          } else if (allowPaymentInternalFallback) {
            applySandboxFallback('VNPAY');
            setError('sandbox: Đang dùng cổng thử nghiệm VNPay nội bộ.');
          } else {
            setPaymentUrl('');
            setDeeplink('');
            setQrCodeUrl('');
            setError(
              'Không nhận được link thanh toán VNPay từ server. Bật VNPAY_ENABLED và cấu hình TMN/hash sandbox trong payment-service, hoặc bật lại REACT_APP_PAYMENT_INTERNAL_FALLBACK.',
            );
          }
        }
      } catch (err: any) {
        if (allowPaymentInternalFallback) {
          applySandboxFallback(selectedMethod as 'MOMO' | 'VNPAY');
          setError('sandbox: Đang dùng cổng thử nghiệm nội bộ.');
        } else {
          setPaymentUrl('');
          setDeeplink('');
          setQrCodeUrl('');
          setError(
            `Lỗi kết nối cổng ${selectedMethod === 'MOMO' ? 'MoMo' : 'VNPay'}: ${err?.message || 'Không xác định'}. Kiểm tra payment-service và mạng.`,
          );
        }
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

  const methodMeta = {
    MOMO:  { label: 'Ví MoMo',         color: '#ae2070', bg: '#fdf0f5', selectedBg: '#fce7f3' },
    VNPAY: { label: 'VNPay QR/Ngân hàng', color: '#0066cc', bg: '#f0f5ff', selectedBg: '#dbeafe' },
  } as const;

  return (
    <Box sx={{ minHeight: '100dvh', background: 'linear-gradient(160deg, #0f172a 0%, #1e3a5f 100%)', pb: 4 }}>

      {/* Header */}
      <Box sx={{ px: 2, pt: 2, pb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate(-1)}
          sx={{ color: '#93c5fd', fontWeight: 700, borderRadius: 3 }}
        >
          Quay lại
        </Button>
        <Box flex={1} />
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <PaymentRounded sx={{ color: '#93c5fd', fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#fff' }}>
            Thanh toán trực tuyến
          </Typography>
        </Stack>
        <Box flex={1} />
      </Box>

      <Container maxWidth="sm" sx={{ pt: 1 }}>
        <Stack spacing={2.5}>

          {/* Amount card */}
          <Card elevation={0} sx={{ borderRadius: 4, overflow: 'hidden' }}>
            <Box sx={{
              background: voucherPreview
                ? 'linear-gradient(135deg, #065f46 0%, #059669 100%)'
                : 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
              px: 3, py: 2.5, color: '#fff',
            }}>
              {voucherPreview ? (
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <LocalOfferRounded sx={{ fontSize: 18, color: '#a7f3d0' }} />
                    <Typography variant="caption" sx={{ color: '#a7f3d0', fontWeight: 700 }}>
                      Đã áp dụng voucher {voucherPreview.code}
                    </Typography>
                  </Stack>
                  <Typography variant="h3" fontWeight={900} lineHeight={1}>
                    {amount.toLocaleString('vi-VN')}₫
                  </Typography>
                  <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.75 }}>Cước gốc</Typography>
                      <Typography variant="body2" fontWeight={700} sx={{ textDecoration: 'line-through', opacity: 0.8 }}>
                        {voucherPreview.originalAmount.toLocaleString('vi-VN')}₫
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: '#a7f3d0' }}>Tiết kiệm</Typography>
                      <Typography variant="body2" fontWeight={800} sx={{ color: '#a7f3d0' }}>
                        -{voucherPreview.discountAmount.toLocaleString('vi-VN')}₫
                      </Typography>
                    </Box>
                  </Stack>
                </Stack>
              ) : (
                <Stack spacing={0.5}>
                  <Typography variant="caption" sx={{ opacity: 0.75 }}>Số tiền thanh toán</Typography>
                  <Typography variant="h3" fontWeight={900} lineHeight={1}>
                    {amount.toLocaleString('vi-VN')}₫
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.6 }}>
                    Mã chuyến: {rideId?.slice(0, 8).toUpperCase()}
                  </Typography>
                </Stack>
              )}
            </Box>
          </Card>

          {/* Payment method selection */}
          <Card elevation={0} sx={{ borderRadius: 4, p: 2.5 }}>
            <Typography variant="subtitle2" fontWeight={800} gutterBottom sx={{ mb: 2 }}>
              Chọn phương thức thanh toán
            </Typography>
            <Stack direction="row" spacing={1.5}>
              {(['MOMO', 'VNPAY'] as const).map((method) => {
                const meta = methodMeta[method];
                const selected = selectedMethod === method;
                return (
                  <Box
                    key={method}
                    onClick={() => !processing && setSelectedMethod(method)}
                    sx={{
                      flex: 1,
                      border: '2px solid',
                      borderColor: selected ? meta.color : '#e2e8f0',
                      borderRadius: 3,
                      p: 2,
                      textAlign: 'center',
                      cursor: processing ? 'default' : 'pointer',
                      bgcolor: selected ? meta.selectedBg : meta.bg,
                      transition: 'all 0.15s',
                      opacity: processing ? 0.7 : 1,
                    }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
                      {selected && <CheckCircleRounded sx={{ fontSize: 16, color: meta.color }} />}
                      <Typography variant="subtitle2" fontWeight={800} sx={{ color: meta.color }}>
                        {meta.label}
                      </Typography>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          </Card>

          {/* Error Alert */}
          {error && (
            <Alert severity={error.includes('sandbox') ? 'info' : 'error'} onClose={() => setError('')} sx={{ borderRadius: 3 }}>
              {error}
            </Alert>
          )}

          {/* Payment Processing */}
          {processing && (
            <Card elevation={0} sx={{ borderRadius: 4, p: 3 }}>
              <Stack alignItems="center" spacing={2}>
                <CircularProgress size={36} />
                <Typography variant="body2" color="text.secondary" fontWeight={600}>
                  Đang kết nối cổng thanh toán {selectedMethod === 'MOMO' ? 'MoMo' : 'VNPay'}...
                </Typography>
              </Stack>
            </Card>
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
              onContinue={() => { window.location.href = paymentUrl; }}
            />
          )}

          {/* Transaction info */}
          <Card elevation={0} sx={{ borderRadius: 4 }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1.5 }}>
                Thông tin giao dịch
              </Typography>
              <Stack spacing={1}>
                {[
                  ['Mã chuyến', rideId || '—'],
                  ['Phương thức', selectedMethod === 'MOMO' ? 'Ví điện tử MoMo' : 'VNPay QR / Ngân hàng'],
                  ['Trạng thái', processing ? 'Đang xử lý...' : paymentUrl ? 'Sẵn sàng thanh toán' : 'Đang tải...'],
                ].map(([label, value]) => (
                  <Stack key={label} direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                    <Typography variant="caption" fontWeight={700}
                      sx={{ maxWidth: '60%', textAlign: 'right', fontFamily: label === 'Mã chuyến' ? 'monospace' : undefined }}>
                      {value}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>

        </Stack>
      </Container>
    </Box>
  );
};

export default OnlinePaymentPage;
