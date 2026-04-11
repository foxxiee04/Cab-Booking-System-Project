import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  CircularProgress,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  LinearProgress,
  Rating,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ArrowBack, AutorenewRounded, Cancel, Chat, CheckCircleRounded, HourglassTopRounded, PaymentRounded, Phone, StarRate } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { BookingMap, useSocket } from '../features/booking';
import { paymentApi } from '../api/payment.api';
import { reviewApi, RideReview } from '../api/review.api';
import { rideApi } from '../api/ride.api';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { clearRide, setCurrentRide, setDriver, updateRideStatus } from '../store/ride.slice';
import { Payment } from '../types';
import { formatCurrency, formatDate, getPaymentMethodLabel, getVehicleTypeLabel } from '../utils/format.utils';
import { calculateDistance } from '../utils/map.utils';

const STATUS_META: Record<string, { label: string; description: string; color: string; allowCancel: boolean }> = {
  CREATED: {
    label: 'Chờ thanh toán',
    description: 'Vui lòng hoàn tất thanh toán để hệ thống bắt đầu tìm tài xế.',
    color: '#7c3aed',
    allowCancel: true,
  },
  PENDING: {
    label: 'Đang tìm tài xế phù hợp',
    description: 'Hệ thống đang ghép tài xế gần nhất cho chuyến đi của bạn.',
    color: '#f59e0b',
    allowCancel: true,
  },
  ASSIGNED: {
    label: 'Đã có tài xế nhận chuyến',
    description: 'Tài xế đã được gán và đang chuẩn bị di chuyển tới bạn.',
    color: '#2563eb',
    allowCancel: true,
  },
  ACCEPTED: {
    label: 'Tài xế đang tới đón',
    description: 'Theo dõi vị trí tài xế theo thời gian thực trên bản đồ.',
    color: '#2563eb',
    allowCancel: true,
  },
  PICKING_UP: {
    label: 'Tài xế đã tới điểm đón',
    description: 'Tài xế đã đến nơi. Chuyến đi sẽ bắt đầu ngay khi bạn lên xe.',
    color: '#0f766e',
    allowCancel: false,
  },
  IN_PROGRESS: {
    label: 'Đang trong chuyến đi',
    description: 'Chuyến đi đang diễn ra. Hãy kiểm tra lộ trình và cước phí.',
    color: '#16a34a',
    allowCancel: false,
  },
  COMPLETED: {
    label: 'Chuyến đi đã hoàn thành',
    description: 'Xem hóa đơn và để lại đánh giá cho tài xế.',
    color: '#16a34a',
    allowCancel: false,
  },
  CANCELLED: {
    label: 'Chuyến đi đã hủy',
    description: 'Bạn có thể quay về trang chủ để đặt chuyến khác.',
    color: '#dc2626',
    allowCancel: false,
  },
  FINDING_DRIVER: {
    label: 'Đang tìm tài xế phù hợp',
    description: 'Hệ thống đang ghép tài xế gần nhất cho chuyến đi của bạn.',
    color: '#f59e0b',
    allowCancel: true,
  },
  NO_DRIVER_AVAILABLE: {
    label: 'Không có tài xế phù hợp',
    description: 'Hãy thử lại sau ít phút hoặc đổi điểm đón.',
    color: '#dc2626',
    allowCancel: false,
  },
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Đang chờ',
  PROCESSING: 'Đang xử lý',
  REQUIRES_ACTION: 'Chờ thanh toán',
  COMPLETED: 'Đã thanh toán',
  FAILED: 'Thất bại',
  REFUNDED: 'Đã hoàn tiền',
};

const AWAITING_PAYMENT_STATUSES = new Set(['CREATED']);
const SEARCHING_DRIVER_STATUSES = new Set(['PENDING', 'FINDING_DRIVER']);
const RECEIPT_READY_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'NO_DRIVER_AVAILABLE']);
const MATCHING_MAX_WAIT_MINUTES = 3;

const formatDistanceKm = (distance: number | null | undefined) => {
  if (!distance || Number.isNaN(distance)) {
    return 'Đang cập nhật';
  }

  return distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${distance.toFixed(1)} km`;
};

const formatDuration = (duration: number | null | undefined) => {
  if (!duration || Number.isNaN(duration)) {
    return 'Đang cập nhật';
  }

  const minutes = duration > 180 ? Math.round(duration / 60) : Math.round(duration);
  return `${minutes} phút`;
};

const getRefundProviderLabel = (payment: Payment | null, paymentMethod?: string | null) => {
  if (payment?.provider === 'MOMO' || payment?.method === 'MOMO' || paymentMethod === 'MOMO') {
    return 'MoMo';
  }

  if (payment?.provider === 'VNPAY' || payment?.method === 'VNPAY' || paymentMethod === 'VNPAY') {
    return 'VNPay';
  }

  return 'cổng thanh toán';
};

const getRefundDestinationLabel = (payment: Payment | null, paymentMethod?: string | null) => {
  if (payment?.provider === 'MOMO' || payment?.method === 'MOMO' || paymentMethod === 'MOMO') {
    return 'ví MoMo';
  }

  if (payment?.provider === 'VNPAY' || payment?.method === 'VNPAY' || paymentMethod === 'VNPAY') {
    return 'tài khoản ngân hàng';
  }

  return 'ví thanh toán';
};

const getRefundTimeEstimate = (payment: Payment | null, paymentMethod?: string | null) => {
  if (payment?.provider === 'MOMO' || payment?.method === 'MOMO' || paymentMethod === 'MOMO') {
    return 'vài phút đến 1 giờ';
  }

  if (payment?.provider === 'VNPAY' || payment?.method === 'VNPAY' || paymentMethod === 'VNPAY') {
    return '3–5 ngày làm việc (qua ngân hàng)';
  }

  return '1–3 ngày';
};

const RideTracking: React.FC = () => {
  const { rideId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const { currentRide, driver } = useAppSelector((state) => state.ride);
  const { accessToken } = useAppSelector((state) => state.auth);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [existingReview, setExistingReview] = useState<RideReview | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [rating, setRating] = useState<number | null>(5);
  const [comment, setComment] = useState('');
  const [retryMethod, setRetryMethod] = useState<'CASH' | 'MOMO' | 'VNPAY'>('CASH');
  const [retryingPayment, setRetryingPayment] = useState(false);
  const [refundPollTimedOut, setRefundPollTimedOut] = useState(false);
  const refundPollRef = useRef<number | null>(null);

  const retryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const retryPaymentRequired = retryParams.get('retryPayment') === '1';
  const failedProvider = (retryParams.get('failedProvider') || '').toUpperCase();

  const hydrateRide = useCallback(async () => {
    if (!rideId) {
      return;
    }

    const response = await rideApi.getRide(rideId);
    const ride = response.data.ride;
    dispatch(setCurrentRide(ride));
    if ((ride as any).driver) {
      dispatch(setDriver((ride as any).driver));
    }
  }, [dispatch, rideId]);

  const hydrateReceipt = useCallback(async () => {
    if (!rideId) {
      return;
    }

    setPaymentLoading(true);
    setReviewLoading(true);

    try {
      const [paymentResult, reviewResult] = await Promise.allSettled([
        paymentApi.getPaymentByRide(rideId),
        reviewApi.getRideReviews(rideId),
      ]);

      if (paymentResult.status === 'fulfilled') {
        setPayment(paymentResult.value.data.payment || null);
      }

      if (reviewResult.status === 'fulfilled') {
        const review = reviewResult.value.reviews?.[0] || null;
        setExistingReview(review);
        if (review) {
          setRating(review.rating);
          setComment(review.comment || '');
        }
      }
    } finally {
      setPaymentLoading(false);
      setReviewLoading(false);
    }
  }, [rideId]);

  const { driverLocation, lastRideStatus } = useSocket({
    token: accessToken,
    rideId,
    driverId: currentRide?.driverId || undefined,
    enabled: Boolean(accessToken && rideId),
  });

  useEffect(() => {
    if (!rideId) {
      return;
    }

    const fetchRide = async () => {
      try {
        await hydrateRide();
      } catch (err: any) {
        if (!currentRide) {
          setError(err.response?.data?.error?.message || t('errors.loadRide'));
        }
      }
    };

    if (!currentRide || currentRide.id !== rideId) {
      setLoading(true);
      fetchRide().finally(() => setLoading(false));
    }

    const interval = window.setInterval(() => {
      if (currentRide?.status !== 'COMPLETED' && currentRide?.status !== 'CANCELLED') {
        fetchRide();
      }
    }, 12000);

    return () => window.clearInterval(interval);
  }, [currentRide, hydrateRide, rideId, t]);

  useEffect(() => {
    if (!lastRideStatus || !rideId) {
      return;
    }

    dispatch(updateRideStatus({ rideId: lastRideStatus.rideId, status: lastRideStatus.status }));
    hydrateRide().catch(() => undefined);
  }, [dispatch, hydrateRide, lastRideStatus, rideId]);

  useEffect(() => {
    if (RECEIPT_READY_STATUSES.has(currentRide?.status || '')) {
      hydrateReceipt().catch((err) => {
        console.error(err);
        setError('Không thể tải hóa đơn chuyến đi.');
      });
    }
  }, [currentRide?.status, hydrateReceipt]);

  const isOnlinePayment =
    payment?.method === 'MOMO' ||
    payment?.method === 'VNPAY' ||
    currentRide?.paymentMethod === 'MOMO' ||
    currentRide?.paymentMethod === 'VNPAY';

  useEffect(() => {
    if (!RECEIPT_READY_STATUSES.has(currentRide?.status || '')) {
      return;
    }

    if (payment?.status === 'FAILED' || payment?.status === 'REFUNDED') {
      return;
    }

    if (currentRide?.status === 'COMPLETED' && payment?.status === 'COMPLETED') {
      return;
    }

    if (!isOnlinePayment && currentRide?.status !== 'COMPLETED') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      hydrateReceipt().catch((err) => {
        console.error(err);
      });
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [currentRide?.status, hydrateReceipt, isOnlinePayment, payment?.status]);

  const handleCancel = useCallback(async () => {
    if (!currentRide) {
      return;
    }

    setCancelling(true);
    try {
      await rideApi.cancelRide(currentRide.id, 'Khách hàng hủy chuyến');
      await Promise.allSettled([
        hydrateRide(),
        hydrateReceipt(),
      ]);

      // Poll payment status every 5s (up to 5 attempts) for online payments
      // Backend triggers refund via ride.cancelled event asynchronously
      if (currentRide.paymentMethod === 'MOMO' || currentRide.paymentMethod === 'VNPAY') {
        setRefundPollTimedOut(false);
        let attempts = 0;
        const maxAttempts = 36; // ~3 minutes
        refundPollRef.current = window.setInterval(async () => {
          attempts += 1;
          try {
            await hydrateReceipt();
          } catch {
            // non-fatal
          }
          if (attempts >= maxAttempts) {
            if (refundPollRef.current) window.clearInterval(refundPollRef.current);
            refundPollRef.current = null;
            setRefundPollTimedOut(true);
          }
        }, 5000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('errors.cancelRide'));
    } finally {
      setCancelling(false);
    }
  }, [currentRide, hydrateReceipt, hydrateRide, t]);

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (refundPollRef.current) window.clearInterval(refundPollRef.current);
    };
  }, []);

  // Stop polling once refund is confirmed
  useEffect(() => {
    if (payment?.status === 'REFUNDED' && refundPollRef.current) {
      window.clearInterval(refundPollRef.current);
      refundPollRef.current = null;
    }
    if (payment?.status === 'REFUNDED') {
      setRefundPollTimedOut(false);
    }
  }, [payment?.status]);

  const handleSubmitReview = useCallback(async () => {
    if (!currentRide?.id || !currentRide.driverId || !rating) {
      return;
    }

    setSubmittingReview(true);
    try {
      const revieweeName = `${driver?.firstName || ''} ${driver?.lastName || ''}`.trim() || 'Tài xế';

      const response = await reviewApi.createRideReview({
        rideId: currentRide.id,
        revieweeId: currentRide.driverId,
        revieweeName,
        rating,
        comment: comment.trim() || undefined,
      });
      setExistingReview(response.review);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Không thể gửi đánh giá lúc này.');
    } finally {
      setSubmittingReview(false);
    }
  }, [comment, currentRide, driver, rating]);

  const handleRetryPayment = useCallback(async () => {
    if (!rideId) {
      return;
    }

    if (retryMethod === 'CASH') {
      navigate(`/ride/${rideId}`, { replace: true });
      return;
    }

    const amount = Math.round(payment?.amount || currentRide?.fare || 0);
    const returnUrl = retryMethod === 'VNPAY'
      ? `${window.location.origin}/payment/callback`
      : `${window.location.origin}/payment/callback?provider=${retryMethod}&rideId=${rideId}`;

    setRetryingPayment(true);
    setError('');
    try {
      const paymentResponse = retryMethod === 'MOMO'
        ? await paymentApi.createMomoPayment({ rideId, amount, returnUrl })
        : await paymentApi.createVnpayPayment({ rideId, amount, returnUrl });

      const gatewayUrl = paymentResponse.data?.payUrl || paymentResponse.data?.paymentUrl;
      if (!gatewayUrl) {
        throw new Error('Không tạo được link thanh toán mới');
      }

      window.location.assign(gatewayUrl);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Không thể tạo lại giao dịch thanh toán.');
    } finally {
      setRetryingPayment(false);
    }
  }, [currentRide?.fare, navigate, payment?.amount, retryMethod, rideId]);

  const status = currentRide?.status || 'PENDING';
  const statusMeta = STATUS_META[status] || STATUS_META.PENDING;
  const isSearchingDriver = SEARCHING_DRIVER_STATUSES.has(status);
  const isAwaitingPayment = AWAITING_PAYMENT_STATUSES.has(status) &&
    (currentRide?.paymentMethod === 'MOMO' || currentRide?.paymentMethod === 'VNPAY');
  const showPaymentSummary = RECEIPT_READY_STATUSES.has(status) && Boolean(currentRide);
  const refundProviderLabel = getRefundProviderLabel(payment, currentRide?.paymentMethod);
  const refundDestinationLabel = getRefundDestinationLabel(payment, currentRide?.paymentMethod);
  const refundTimeEstimate = getRefundTimeEstimate(payment, currentRide?.paymentMethod);
  const refundInfo = payment?.refund || null;
  const refundQueryData = (refundInfo?.queryData || null) as Record<string, any> | null;
  const refundProviderResponse = (refundInfo?.providerResponse || null) as Record<string, any> | null;
  const isVnpayRefund = refundProviderLabel === 'VNPay';
  const isMomoRefund = refundProviderLabel === 'MoMo';
  const vnpayBankNameMap: Record<string, string> = {
    NCB: 'NCB',
    VNPAYQR: 'VNPAY QR',
    VNBANK: 'Ngân hàng nội địa',
    INTCARD: 'Thẻ quốc tế',
    BIDV: 'BIDV',
    AGRIBANK: 'Agribank',
    SCB: 'SCB',
    SACOMBANK: 'Sacombank',
    EXIMBANK: 'Eximbank',
    MSBANK: 'MSB',
    NAMABANK: 'Nam A Bank',
    VNMART: 'VnMart',
    VIETINBANK: 'VietinBank',
    VIETCOMBANK: 'Vietcombank',
    HDBANK: 'HDBank',
    DONGABANK: 'DongA Bank',
    TPBANK: 'TPBank',
    OJB: 'OceanBank',
    NAVIBANK: 'NaviBank',
    BABANK: 'Bac A Bank',
    GPBANK: 'GPBank',
    OCB: 'OCB',
    SHB: 'SHB',
    IVB: 'IVB',
  };
  const refundBankCode =
    refundQueryData?.vnp_BankCode ||
    refundProviderResponse?.vnp_BankCode ||
    refundProviderResponse?.bankCode ||
    null;
  const refundBankName = refundBankCode ? (vnpayBankNameMap[String(refundBankCode)] || String(refundBankCode)) : null;
  const refundVnpayAccount =
    refundQueryData?.vnp_CardNo ||
    refundProviderResponse?.vnp_CardNo ||
    refundProviderResponse?.bankAccount ||
    refundProviderResponse?.accountNumber ||
    refundProviderResponse?.bankAccountNo ||
    null;
  const refundVnpayCardType =
    refundQueryData?.vnp_CardType ||
    refundProviderResponse?.vnp_CardType ||
    refundProviderResponse?.cardType ||
    null;
  const refundMomoWallet =
    refundProviderResponse?.walletId ||
    refundProviderResponse?.partnerClientId ||
    refundProviderResponse?.phoneNumber ||
    refundQueryData?.walletId ||
    null;
  const refundBankTransactionNo =
    refundQueryData?.vnp_BankTranNo ||
    refundProviderResponse?.vnp_BankTranNo ||
    refundProviderResponse?.bankTransactionNo ||
    null;
  const hasVnpayDestinationDetails = Boolean(
    refundVnpayAccount || refundVnpayCardType || refundBankName || refundBankCode || refundBankTransactionNo
  );
  const isRefundPending =
    status === 'CANCELLED' &&
    isOnlinePayment &&
    (payment?.status === 'COMPLETED' || payment?.status === 'PROCESSING');

  const effectiveDriverLocation = useMemo(() => {
    if (driverLocation) {
      return driverLocation;
    }

    if (driver?.currentLocation) {
      return {
        driverId: driver.id,
        lat: driver.currentLocation.lat,
        lng: driver.currentLocation.lng,
      };
    }

    return null;
  }, [driver, driverLocation]);

  const pickupDistanceKmToDriver = useMemo(() => {
    if (!effectiveDriverLocation || !currentRide?.pickup) {
      return null;
    }

    return calculateDistance(
      { lat: effectiveDriverLocation.lat, lng: effectiveDriverLocation.lng },
      { lat: currentRide.pickup.lat, lng: currentRide.pickup.lng },
    );
  }, [currentRide?.pickup, effectiveDriverLocation]);

  const driverSpeedKph = useMemo(() => {
    const speed = driverLocation?.speedKph;
    if (!speed || Number.isNaN(speed) || speed <= 0) {
      return null;
    }

    return speed;
  }, [driverLocation?.speedKph]);

  const estimatedPickupEtaMinutes = useMemo(() => {
    if (status === 'PICKING_UP') {
      return 0;
    }

    if (!pickupDistanceKmToDriver || !['ASSIGNED', 'ACCEPTED'].includes(status)) {
      return null;
    }

    const speed = driverSpeedKph && driverSpeedKph >= 5 ? driverSpeedKph : 28;
    return Math.max(1, Math.round((pickupDistanceKmToDriver / speed) * 60));
  }, [driverSpeedKph, pickupDistanceKmToDriver, status]);

  const trackingEtaText = useMemo(() => {
    if (isSearchingDriver) {
      const requestedAt = currentRide?.requestedAt ? new Date(currentRide.requestedAt).getTime() : Date.now();
      const elapsedMinutes = Math.max(0, Math.floor((Date.now() - requestedAt) / 60000));
      const remaining = Math.max(1, MATCHING_MAX_WAIT_MINUTES - elapsedMinutes);
      return `ETA ghép tài xế: khoảng ${remaining}-${Math.max(remaining + 1, 2)} phút`;
    }

    if (status === 'PICKING_UP') {
      return 'ETA đón: Tài xế đã tới điểm đón';
    }

    if (estimatedPickupEtaMinutes == null) {
      return 'ETA đón: Tài xế đang di chuyển tới bạn';
    }

    return `ETA đón: khoảng ${estimatedPickupEtaMinutes} phút`;
  }, [currentRide?.requestedAt, estimatedPickupEtaMinutes, isSearchingDriver, status]);

  const trackingDistanceText = useMemo(() => {
    if (isSearchingDriver) {
      return 'Bán kính tìm tài xế: trong 3 km quanh điểm đón';
    }

    if (!pickupDistanceKmToDriver || !['ASSIGNED', 'ACCEPTED', 'PICKING_UP'].includes(status)) {
      return 'Khoảng cách tới bạn: tài xế đang được định vị';
    }

    return `Khoảng cách tới bạn: ${pickupDistanceKmToDriver.toFixed(1)} km`;
  }, [isSearchingDriver, pickupDistanceKmToDriver, status]);

  const trackingSpeedText = useMemo(() => {
    if (!driverSpeedKph) {
      return '';
    }

    return `Tốc độ hiện tại: ${Math.round(driverSpeedKph)} km/h`;
  }, [driverSpeedKph]);

  if (loading && !currentRide) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', p: 2 }}>
        <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 4 }} />
        <Skeleton variant="text" sx={{ mt: 2, fontSize: 32 }} />
        <Skeleton variant="text" sx={{ fontSize: 18 }} />
        <Skeleton variant="rectangular" height={240} sx={{ mt: 2, borderRadius: 4 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#e5eefb' }}>
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          background: 'transparent',
          p: 1,
          pt: 2,
          pointerEvents: 'none',
        }}
      >
        <IconButton
          onClick={() => {
            if (status === 'COMPLETED' || status === 'CANCELLED' || status === 'NO_DRIVER_AVAILABLE') {
              dispatch(clearRide());
              navigate('/home');
            }
          }}
          sx={{ bgcolor: 'white', boxShadow: 2, '&:hover': { bgcolor: 'grey.100' }, pointerEvents: 'auto' }}
        >
          <ArrowBack />
        </IconButton>
      </Box>

      <Box sx={{ flex: currentRide?.status === 'COMPLETED' ? '0 0 44vh' : 1, position: 'relative' }}>
        <BookingMap
          pickup={currentRide?.pickup || null}
          dropoff={currentRide?.dropoff || null}
          driverLocation={effectiveDriverLocation}
          mode="tracking"
          trackingEtaText={trackingEtaText}
          trackingDistanceText={trackingDistanceText}
          trackingSpeedText={trackingSpeedText}
          onError={setError}
          height="100%"
        />

        {error && (
          <Alert severity="error" onClose={() => setError('')} sx={{ position: 'absolute', top: 72, left: 16, right: 16, zIndex: 1200, borderRadius: 3 }}>
            {error}
          </Alert>
        )}
      </Box>

      <Card sx={{ borderRadius: '24px 24px 0 0', boxShadow: '0 -20px 45px rgba(15,23,42,0.14)', overflow: 'auto', minHeight: currentRide?.status === 'COMPLETED' ? '56vh' : '34vh' }}>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
            {isSearchingDriver ? (
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: 'rgba(245, 158, 11, 0.14)',
                }}
              >
                <AutorenewRounded
                  sx={{
                    color: '#d97706',
                    animation: 'driver-search-spin 1.1s linear infinite',
                    '@keyframes driver-search-spin': {
                      '0%': { transform: 'rotate(0deg)' },
                      '100%': { transform: 'rotate(360deg)' },
                    },
                  }}
                />
              </Box>
            ) : (
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: statusMeta.color }} />
            )}
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" fontWeight={800}>{statusMeta.label}</Typography>
              <Typography variant="body2" color="text.secondary">{statusMeta.description}</Typography>
            </Box>
            {isSearchingDriver ? (
              <CircularProgress size={24} thickness={5} sx={{ color: '#d97706' }} />
            ) : (
              <Chip label={statusMeta.label} size="small" sx={{ bgcolor: `${statusMeta.color}18`, color: statusMeta.color, fontWeight: 700 }} />
            )}
          </Stack>

          {/* Awaiting online payment banner */}
          {isAwaitingPayment && currentRide && (
            <Card sx={{ borderRadius: 4, mb: 2.5, bgcolor: '#f5f3ff', border: '1.5px solid #c4b5fd' }}>
              <CardContent>
                <Stack spacing={1.5}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box sx={{ fontSize: 28 }}>💳</Box>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={800} color="#6d28d9">
                        Chờ thanh toán để bắt đầu tìm tài xế
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Hệ thống sẽ tự động tìm tài xế sau khi thanh toán thành công.
                      </Typography>
                    </Box>
                  </Stack>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => {
                      const method = currentRide.paymentMethod as 'MOMO' | 'VNPAY';
                      const params = new URLSearchParams({ provider: method });
                      const amountCandidate = Number(
                        currentRide.fare
                        || payment?.amount
                        || (currentRide as any).estimatedFare
                        || (currentRide as any).totalFare
                        || 0
                      );
                      if (Number.isFinite(amountCandidate) && amountCandidate > 0) {
                        params.set('amount', String(Math.round(amountCandidate)));
                      }
                      navigate(`/payment/online/${currentRide.id}?${params.toString()}`);
                    }}
                    sx={{
                      borderRadius: 3,
                      fontWeight: 700,
                      py: 1.2,
                      background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
                      '&:hover': { background: 'linear-gradient(90deg, #6d28d9, #9333ea)' },
                    }}
                  >
                    Tiếp tục thanh toán {currentRide.paymentMethod}
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    color="error"
                    size="small"
                    onClick={handleCancel}
                    disabled={cancelling}
                    sx={{ borderRadius: 3 }}
                  >
                    Hủy chuyến
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          )}

          {driver && status !== 'CANCELLED' && status !== 'NO_DRIVER_AVAILABLE' && (
            <Card sx={{ borderRadius: 4, mb: 2.5, bgcolor: '#f8fafc' }}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar sx={{ width: 56, height: 56, bgcolor: '#1d4ed8' }} src={driver.avatar}>
                    {driver.firstName?.[0] || 'D'}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight={800}>{`${driver.firstName || ''} ${driver.lastName || ''}`.trim() || 'Tài xế'}</Typography>
                    <Typography variant="body2" color="text.secondary">{[driver.vehicleColor, driver.vehicleMake, driver.vehicleModel].filter(Boolean).join(' ')}</Typography>
                    <Typography variant="body2" fontWeight={700}>{driver.licensePlate}</Typography>
                  </Box>
                  <Chip icon={<StarRate sx={{ color: '#f59e0b !important' }} />} label={(driver.rating || 5).toFixed(1)} variant="outlined" />
                </Stack>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
                  <Chip size="small" color="primary" label={trackingEtaText.replace('ETA đón: ', '')} />
                  <Chip size="small" variant="outlined" label={trackingDistanceText.replace('Khoảng cách tới bạn: ', '')} />
                  {effectiveDriverLocation ? <Chip size="small" color="success" label="Vị trí tài xế đang cập nhật realtime" /> : null}
                </Stack>
                <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
                  <Button variant="outlined" fullWidth startIcon={<Phone />} sx={{ borderRadius: 3, py: 1.2 }}>Gọi</Button>
                  <Button variant="outlined" fullWidth startIcon={<Chat />} sx={{ borderRadius: 3, py: 1.2 }}>Nhắn tin</Button>
                </Stack>
              </CardContent>
            </Card>
          )}

          {currentRide && (
            <Card sx={{ borderRadius: 4, mb: 2.5 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1.5 }}>Chi tiết chuyến đi</Typography>
                <Stack spacing={1.2}>
                  <Stack direction="row" justifyContent="space-between" spacing={2}><Typography variant="body2" color="text.secondary">Điểm đón</Typography><Typography variant="body2" fontWeight={600} textAlign="right">{currentRide.pickup?.address || '-'}</Typography></Stack>
                  <Stack direction="row" justifyContent="space-between" spacing={2}><Typography variant="body2" color="text.secondary">Điểm đến</Typography><Typography variant="body2" fontWeight={600} textAlign="right">{currentRide.dropoff?.address || '-'}</Typography></Stack>
                  <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Loại xe</Typography><Typography variant="body2" fontWeight={600}>{getVehicleTypeLabel(currentRide.vehicleType || 'CAR_4')}</Typography></Stack>
                  <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Thanh toán</Typography><Typography variant="body2" fontWeight={600}>{getPaymentMethodLabel(currentRide.paymentMethod || 'CASH')}</Typography></Stack>
                  <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Quãng đường</Typography><Typography variant="body2" fontWeight={600}>{formatDistanceKm(currentRide.distance)}</Typography></Stack>
                  <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Thời lượng</Typography><Typography variant="body2" fontWeight={600}>{formatDuration(currentRide.duration)}</Typography></Stack>
                  <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Cước phí</Typography><Typography variant="body2" fontWeight={800}>{formatCurrency(currentRide.fare || 0)}</Typography></Stack>
                </Stack>

                {statusMeta.allowCancel && !isAwaitingPayment && (
                  <Button color="error" variant="outlined" startIcon={cancelling ? <CircularProgress size={16} /> : <Cancel />} fullWidth onClick={handleCancel} disabled={cancelling} sx={{ borderRadius: 3, py: 1.2, mt: 2.5 }}>
                    Hủy chuyến
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {showPaymentSummary && currentRide && (
            <>
              {retryPaymentRequired && (
                <Card sx={{ borderRadius: 4, mb: 2.5, bgcolor: '#fff7ed', border: '1px solid rgba(245,158,11,0.24)' }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
                      Thanh toán online thất bại. Vui lòng chọn phương thức khác.
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Cổng thất bại: {failedProvider || 'Không xác định'}
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mb: 2 }}>
                      {(['CASH', 'MOMO', 'VNPAY'] as const).map((method) => (
                        <Button
                          key={method}
                          variant={retryMethod === method ? 'contained' : 'outlined'}
                          onClick={() => setRetryMethod(method)}
                          disabled={method === failedProvider}
                          sx={{ borderRadius: 3 }}
                        >
                          {method === 'CASH' ? 'Tiền mặt' : method}
                        </Button>
                      ))}
                    </Stack>
                    <Button
                      variant="contained"
                      color="warning"
                      onClick={handleRetryPayment}
                      disabled={retryingPayment || retryMethod === failedProvider}
                      sx={{ borderRadius: 3, fontWeight: 700 }}
                    >
                      {retryingPayment ? 'Đang xử lý...' : retryMethod === 'CASH' ? 'Xác nhận đổi sang tiền mặt' : 'Thanh toán lại'}
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card sx={{ borderRadius: 4, mb: 2.5, bgcolor: '#eff6ff' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                    <Typography variant="subtitle1" fontWeight={800}>{status === 'COMPLETED' ? 'Hóa đơn chuyến đi' : 'Thông tin thanh toán và hoàn tiền'}</Typography>
                    {(paymentLoading || reviewLoading) && <CircularProgress size={18} />}
                  </Stack>
                  <Stack spacing={1.25}>
                    <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Mã chuyến</Typography><Typography variant="body2" fontWeight={600}>{currentRide.id.slice(0, 8).toUpperCase()}</Typography></Stack>
                    <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Thời gian đặt</Typography><Typography variant="body2" fontWeight={600}>{formatDate(currentRide.requestedAt)}</Typography></Stack>
                    {currentRide.completedAt && <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Hoàn thành lúc</Typography><Typography variant="body2" fontWeight={600}>{formatDate(currentRide.completedAt)}</Typography></Stack>}
                    {status === 'CANCELLED' && currentRide.updatedAt && <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Hủy lúc</Typography><Typography variant="body2" fontWeight={600}>{formatDate(currentRide.updatedAt)}</Typography></Stack>}
                    <Divider sx={{ my: 0.5 }} />
                    <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Số tiền</Typography><Typography variant="h6" fontWeight={900}>{formatCurrency(payment?.amount || currentRide.fare || 0)}</Typography></Stack>
                    <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Phương thức</Typography><Typography variant="body2" fontWeight={600}>{getPaymentMethodLabel(payment?.method || currentRide.paymentMethod || 'CASH')}</Typography></Stack>
                    <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Trạng thái thanh toán</Typography><Chip size="small" icon={<PaymentRounded />} label={PAYMENT_STATUS_LABELS[payment?.status || 'PENDING'] || 'Đang chờ'} data-testid="payment-status-chip" color={payment?.status === 'COMPLETED' || payment?.status === 'REFUNDED' ? 'success' : payment?.status === 'FAILED' ? 'error' : 'warning'} /></Stack>
                  </Stack>

                  {isRefundPending && (
                    <Box
                      data-testid="refund-pending-alert"
                      sx={{
                        mt: 1.5,
                        borderRadius: 3,
                        bgcolor: '#fffbeb',
                        border: '1.5px solid #fcd34d',
                        overflow: 'hidden',
                      }}
                    >
                      <LinearProgress
                        sx={{
                          height: 3,
                          '& .MuiLinearProgress-bar': { bgcolor: '#f59e0b' },
                          bgcolor: '#fef3c7',
                        }}
                      />
                      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ p: 1.75 }}>
                        <HourglassTopRounded sx={{ color: '#d97706', mt: 0.25, fontSize: 20, flexShrink: 0 }} />
                        <Box>
                          <Typography variant="body2" fontWeight={800} color="#92400e" sx={{ mb: 0.5 }}>
                            {refundPollTimedOut
                              ? `Yêu cầu hoàn tiền đã gửi tới ${refundProviderLabel}, đang chờ đối soát.`
                              : `Đang hoàn tiền về ${refundDestinationLabel} của bạn.`}
                          </Typography>
                          <Typography variant="caption" display="block" color="#78350f">
                            {refundPollTimedOut
                              ? (refundProviderLabel === 'MoMo'
                                ? 'MoMo đã nhận yêu cầu hoàn. Thường tiền về ví trong vài phút đến 1 giờ, đôi khi có thể lâu hơn tùy đối soát.'
                                : 'VNPay đã nhận yêu cầu hoàn. Tiền thường về tài khoản trong 3–5 ngày làm việc tùy ngân hàng.')
                              : (refundProviderLabel === 'MoMo'
                                ? 'Tiền sẽ về ví MoMo trong vài phút đến 1 giờ. Bạn có thể dùng mã giao dịch gốc để đối chiếu nếu cần.'
                                : 'Tiền sẽ về tài khoản ngân hàng trong 3–5 ngày làm việc. VNPay xử lý qua ngân hàng liên kết.')}
                          </Typography>
                          {payment?.transactionId && (
                            <Typography
                              variant="caption"
                              display="block"
                              sx={{ mt: 0.75, fontFamily: 'monospace', bgcolor: '#fef3c7', px: 1, py: 0.5, borderRadius: 1, fontSize: '0.72rem' }}
                            >
                              Giao dịch gốc: {payment.transactionId}
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </Box>
                  )}

                  {payment?.status === 'REFUNDED' && (
                    <Box
                      data-testid="refund-success-alert"
                      sx={{
                        mt: 1.5,
                        borderRadius: 3,
                        bgcolor: '#f0fdfa',
                        border: '1.5px solid #5eead4',
                        overflow: 'hidden',
                      }}
                    >
                      <Box sx={{ height: 4, background: 'linear-gradient(90deg, #0d9488, #14b8a6)' }} />
                      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ p: 1.75 }}>
                        <CheckCircleRounded sx={{ color: '#0d9488', mt: 0.25, fontSize: 20, flexShrink: 0 }} />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" fontWeight={800} color="#134e4a" sx={{ mb: 0.5 }}>
                            {isMomoRefund
                              ? 'MoMo đã xác nhận hoàn tiền về ví của bạn.'
                              : 'VNPay đã ghi nhận hoàn tiền về tài khoản ngân hàng.'}
                          </Typography>
                          <Typography variant="caption" display="block" color="#0f766e" sx={{ mb: 1.25 }}>
                            {isMomoRefund
                              ? 'Số tiền sẽ về ví MoMo trong vài phút đến 1 giờ.'
                              : 'Số tiền sẽ về tài khoản ngân hàng trong 3–5 ngày làm việc qua ngân hàng liên kết.'}
                          </Typography>
                          <Box
                            sx={{
                              bgcolor: '#ccfbf1',
                              borderRadius: 2,
                              p: 1.25,
                              '& .refund-label': { color: '#0f766e', fontSize: '0.82rem', lineHeight: 1.4 },
                              '& .refund-value': { color: '#134e4a', fontSize: '0.82rem', lineHeight: 1.4, fontWeight: 700 },
                            }}
                          >
                            <Stack spacing={0.8}>
                              <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="flex-start">
                                <Typography className="refund-label">Số tiền hoàn</Typography>
                                <Typography className="refund-value" sx={{ fontWeight: 800 }} textAlign="right">{formatCurrency(refundInfo?.amount || payment?.amount || currentRide.fare || 0)}</Typography>
                              </Stack>
                              <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="flex-start">
                                <Typography className="refund-label">Hoàn về</Typography>
                                <Typography className="refund-value" textAlign="right">{isMomoRefund ? 'Ví MoMo' : 'Tài khoản ngân hàng'}</Typography>
                              </Stack>
                              {isVnpayRefund && refundVnpayAccount && (
                                <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="flex-start">
                                  <Typography className="refund-label">STK nhận hoàn</Typography>
                                  <Typography className="refund-value" textAlign="right" sx={{ maxWidth: '62%', wordBreak: 'break-word' }}>
                                    {String(refundVnpayAccount)}
                                  </Typography>
                                </Stack>
                              )}
                              {isVnpayRefund && refundVnpayCardType && (
                                <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="flex-start">
                                  <Typography className="refund-label">Nguồn tiền thanh toán</Typography>
                                  <Typography className="refund-value" textAlign="right" sx={{ maxWidth: '62%', wordBreak: 'break-word' }}>
                                    {String(refundVnpayCardType)}
                                  </Typography>
                                </Stack>
                              )}
                              {isVnpayRefund && refundBankName && (
                                <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="flex-start">
                                  <Typography className="refund-label">Ngân hàng nhận hoàn</Typography>
                                  <Typography className="refund-value" textAlign="right" sx={{ maxWidth: '62%', wordBreak: 'break-word' }}>
                                    {refundBankName}
                                  </Typography>
                                </Stack>
                              )}
                              {isMomoRefund && refundMomoWallet && (
                                <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="flex-start">
                                  <Typography className="refund-label">Ví MoMo nhận hoàn</Typography>
                                  <Typography className="refund-value" textAlign="right" sx={{ maxWidth: '62%', wordBreak: 'break-word' }}>
                                    {String(refundMomoWallet)}
                                  </Typography>
                                </Stack>
                              )}
                              {payment?.refundedAt && (
                                <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="flex-start">
                                  <Typography className="refund-label">Ghi nhận lúc</Typography>
                                  <Typography className="refund-value" textAlign="right">{formatDate(payment.refundedAt)}</Typography>
                                </Stack>
                              )}
                              {refundInfo?.requestId && (
                                <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="flex-start">
                                  <Typography className="refund-label">Mã yêu cầu hoàn (MoMo)</Typography>
                                  <Typography className="refund-value" sx={{ fontFamily: 'monospace', fontSize: '0.74rem', wordBreak: 'break-all' }} textAlign="right">{refundInfo.requestId}</Typography>
                                </Stack>
                              )}
                              {refundInfo?.refundOrderId && (
                                <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="flex-start">
                                  <Typography className="refund-label">Mã hoàn tiền MoMo</Typography>
                                  <Typography className="refund-value" sx={{ fontFamily: 'monospace', fontSize: '0.74rem', wordBreak: 'break-all' }} textAlign="right">{refundInfo.refundOrderId}</Typography>
                                </Stack>
                              )}
                              {typeof refundInfo?.resultCode === 'number' && (
                                <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="center">
                                  <Typography variant="caption" color="#0f766e">Mã kết quả MoMo</Typography>
                                  <Chip
                                    label={refundInfo.resultCode === 0 ? `${refundInfo.resultCode} – Thành công` : `${refundInfo.resultCode}`}
                                    size="small"
                                    sx={{ height: 18, fontSize: '0.65rem', bgcolor: refundInfo.resultCode === 0 ? '#0d9488' : '#f59e0b', color: '#fff' }}
                                  />
                                </Stack>
                              )}
                              {refundInfo?.txnRef && (
                                <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="flex-start">
                                  <Typography className="refund-label">Mã giao dịch VNPay</Typography>
                                  <Typography className="refund-value" textAlign="right" sx={{ fontFamily: 'monospace', fontSize: '0.74rem', wordBreak: 'break-all' }}>{refundInfo.txnRef}</Typography>
                                </Stack>
                              )}
                              {refundInfo?.responseCode && (
                                <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="center">
                                  <Typography variant="caption" color="#0f766e">Mã phản hồi VNPay</Typography>
                                  <Chip
                                    label={refundInfo.responseCode === '00' ? `${refundInfo.responseCode} – Thành công` : refundInfo.responseCode}
                                    size="small"
                                    sx={{ height: 18, fontSize: '0.65rem', bgcolor: refundInfo.responseCode === '00' ? '#0d9488' : '#f59e0b', color: '#fff' }}
                                  />
                                </Stack>
                              )}
                              {refundBankCode && (
                                <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="flex-start">
                                  <Typography className="refund-label">Ngân hàng xử lý</Typography>
                                  <Typography className="refund-value" textAlign="right">{String(refundBankCode)}</Typography>
                                </Stack>
                              )}
                              {refundBankTransactionNo && (
                                <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="flex-start">
                                  <Typography className="refund-label">Mã giao dịch ngân hàng</Typography>
                                  <Typography className="refund-value" textAlign="right" sx={{ fontFamily: 'monospace', fontSize: '0.74rem', wordBreak: 'break-all' }}>{String(refundBankTransactionNo)}</Typography>
                                </Stack>
                              )}
                              {refundInfo?.refundTransactionId && (
                                <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="flex-start">
                                  <Typography className="refund-label">Mã giao dịch hoàn</Typography>
                                  <Typography className="refund-value" textAlign="right" sx={{ fontFamily: 'monospace', fontSize: '0.74rem', wordBreak: 'break-all' }}>{refundInfo.refundTransactionId}</Typography>
                                </Stack>
                              )}
                              <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="flex-start">
                                <Typography className="refund-label">Thời gian hoàn dự kiến</Typography>
                                <Typography className="refund-value" textAlign="right">{refundTimeEstimate}</Typography>
                              </Stack>
                              {isVnpayRefund && !hasVnpayDestinationDetails && (
                                <Alert severity="info" sx={{ mt: 0.5, borderRadius: 1.5, py: 0.25 }}>
                                  <Typography sx={{ fontSize: '0.8rem' }} color="text.secondary">
                                    Hệ thống chưa nhận được dữ liệu chi tiết tài khoản nhận hoàn từ VNPay. Khi cổng thanh toán cung cấp, thông tin sẽ tự động hiển thị tại đây.
                                  </Typography>
                                </Alert>
                              )}
                              {refundInfo?.description && (
                                <Typography className="refund-label" display="block">Lý do: {refundInfo.description}</Typography>
                              )}
                            </Stack>
                          </Box>
                        </Box>
                      </Stack>
                    </Box>
                  )}
                </CardContent>
              </Card>

              {status === 'COMPLETED' && (
              <Card sx={{ borderRadius: 4 }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 0.5 }}>{existingReview ? 'Đánh giá của bạn' : 'Đánh giá tài xế'}</Typography>
                  <Stack alignItems="flex-start" spacing={1.5}>
                    <Rating value={rating} size="large" onChange={(_, nextValue) => { if (!existingReview) { setRating(nextValue); } }} readOnly={Boolean(existingReview)} />
                    <TextField fullWidth multiline minRows={4} label="Nhận xét" value={comment} onChange={(event) => { if (!existingReview) { setComment(event.target.value); } }} inputProps={{ 'data-testid': 'review-comment-input' }} InputProps={{ readOnly: Boolean(existingReview) }} />
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2.5 }}>
                    {!existingReview && (
                      <Button variant="contained" onClick={handleSubmitReview} disabled={!rating || submittingReview || !currentRide.driverId} data-testid="submit-review-button" sx={{ borderRadius: 3, py: 1.3, fontWeight: 700 }}>
                        {submittingReview ? 'Đang gửi...' : 'Gửi đánh giá'}
                      </Button>
                    )}
                    <Button variant={existingReview ? 'contained' : 'outlined'} onClick={() => { dispatch(clearRide()); navigate('/home'); }} sx={{ borderRadius: 3, py: 1.3, fontWeight: 700 }}>
                      Về trang chủ
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
              )}
            </>
          )}

          {(status === 'CANCELLED' || status === 'NO_DRIVER_AVAILABLE') && (
            <Button variant="contained" fullWidth data-testid="back-to-home-btn" onClick={() => { dispatch(clearRide()); navigate('/home'); }} sx={{ borderRadius: 3, py: 1.4, fontWeight: 700 }}>
              Quay về trang chủ
            </Button>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default RideTracking;
