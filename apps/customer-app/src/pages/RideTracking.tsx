import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  Rating,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ArrowBack, AutorenewRounded, Cancel, Chat, PaymentRounded, Phone, StarRate } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { BookingMap, useSocket } from '../features/booking';
import { paymentApi } from '../api/payment.api';
import { reviewApi, RideReview } from '../api/review.api';
import { rideApi } from '../api/ride.api';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { clearRide, setCurrentRide, setDriver, updateRideStatus } from '../store/ride.slice';
import { Payment } from '../types';
import { formatCurrency, formatDate, getPaymentMethodLabel, getVehicleTypeLabel } from '../utils/format.utils';

const STATUS_META: Record<string, { label: string; description: string; color: string; allowCancel: boolean }> = {
  PENDING: {
    label: 'Đang tìm tài xế',
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
};

const SEARCHING_DRIVER_STATUSES = new Set(['PENDING', 'CREATED', 'FINDING_DRIVER']);

const formatDistanceKm = (distance: number | null | undefined) => {
  if (!distance || Number.isNaN(distance)) {
    return '0 km';
  }

  return distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${distance.toFixed(1)} km`;
};

const formatDuration = (duration: number | null | undefined) => {
  if (!duration || Number.isNaN(duration)) {
    return '0 phút';
  }

  const minutes = duration > 180 ? Math.round(duration / 60) : Math.round(duration);
  return `${minutes} phút`;
};

const RideTracking: React.FC = () => {
  const { rideId } = useParams();
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
    if (currentRide?.status === 'COMPLETED') {
      hydrateReceipt().catch((err) => {
        console.error(err);
        setError('Không thể tải hóa đơn chuyến đi.');
      });
    }
  }, [currentRide?.status, hydrateReceipt]);

  useEffect(() => {
    if (currentRide?.status !== 'COMPLETED') {
      return;
    }

    if (payment?.status === 'COMPLETED' || payment?.status === 'FAILED') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      hydrateReceipt().catch((err) => {
        console.error(err);
      });
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [currentRide?.status, hydrateReceipt, payment?.status]);

  const handleCancel = useCallback(async () => {
    if (!currentRide) {
      return;
    }

    setCancelling(true);
    try {
      await rideApi.cancelRide(currentRide.id, 'Khách hàng hủy chuyến');
      dispatch(clearRide());
      navigate('/home');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('errors.cancelRide'));
    } finally {
      setCancelling(false);
    }
  }, [currentRide, dispatch, navigate, t]);

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

  const status = currentRide?.status || 'PENDING';
  const statusMeta = STATUS_META[status] || STATUS_META.PENDING;

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
          background: 'linear-gradient(180deg, rgba(15,23,42,0.72) 0%, rgba(15,23,42,0) 100%)',
          p: 1,
          pt: 2,
        }}
      >
        <IconButton
          onClick={() => {
            if (status === 'COMPLETED' || status === 'CANCELLED' || status === 'NO_DRIVER_AVAILABLE') {
              dispatch(clearRide());
              navigate('/home');
            }
          }}
          sx={{ bgcolor: 'white', boxShadow: 3, '&:hover': { bgcolor: 'grey.100' } }}
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
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: statusMeta.color }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" fontWeight={800}>{statusMeta.label}</Typography>
              <Typography variant="body2" color="text.secondary">{statusMeta.description}</Typography>
            </Box>
            <Chip label={statusMeta.label} size="small" sx={{ bgcolor: `${statusMeta.color}18`, color: statusMeta.color, fontWeight: 700 }} />
          </Stack>

          {SEARCHING_DRIVER_STATUSES.has(status) && (
            <Card sx={{ borderRadius: 4, mb: 2.5, bgcolor: '#fff7ed', border: '1px solid rgba(245, 158, 11, 0.24)' }}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
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
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight={800}>Đang xoay và tìm tài xế phù hợp</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Hệ thống đang quét tài xế ở gần điểm đón, ưu tiên khoảng cách gần, ETA ngắn và loại xe khớp yêu cầu của bạn.
                    </Typography>
                  </Box>
                  <CircularProgress size={26} thickness={5} />
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
                  <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Loại xe</Typography><Typography variant="body2" fontWeight={600}>{getVehicleTypeLabel(currentRide.vehicleType || 'ECONOMY')}</Typography></Stack>
                  <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Thanh toán</Typography><Typography variant="body2" fontWeight={600}>{getPaymentMethodLabel(currentRide.paymentMethod || 'CASH')}</Typography></Stack>
                  <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Quãng đường</Typography><Typography variant="body2" fontWeight={600}>{formatDistanceKm(currentRide.distance)}</Typography></Stack>
                  <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Thời lượng</Typography><Typography variant="body2" fontWeight={600}>{formatDuration(currentRide.duration)}</Typography></Stack>
                  <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Cước phí</Typography><Typography variant="body2" fontWeight={800}>{formatCurrency(currentRide.fare || 0)}</Typography></Stack>
                </Stack>

                {statusMeta.allowCancel && (
                  <Button color="error" variant="outlined" startIcon={cancelling ? <CircularProgress size={16} /> : <Cancel />} fullWidth onClick={handleCancel} disabled={cancelling} sx={{ borderRadius: 3, py: 1.2, mt: 2.5 }}>
                    Hủy chuyến
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {status === 'COMPLETED' && currentRide && (
            <>
              <Card sx={{ borderRadius: 4, mb: 2.5, bgcolor: '#eff6ff' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                    <Typography variant="subtitle1" fontWeight={800}>Hóa đơn chuyến đi</Typography>
                    {(paymentLoading || reviewLoading) && <CircularProgress size={18} />}
                  </Stack>
                  <Stack spacing={1.25}>
                    <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Mã chuyến</Typography><Typography variant="body2" fontWeight={600}>{currentRide.id.slice(0, 8).toUpperCase()}</Typography></Stack>
                    <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Thời gian đặt</Typography><Typography variant="body2" fontWeight={600}>{formatDate(currentRide.requestedAt)}</Typography></Stack>
                    {currentRide.completedAt && <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Hoàn thành lúc</Typography><Typography variant="body2" fontWeight={600}>{formatDate(currentRide.completedAt)}</Typography></Stack>}
                    <Divider sx={{ my: 0.5 }} />
                    <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Số tiền</Typography><Typography variant="h6" fontWeight={900}>{formatCurrency(payment?.amount || currentRide.fare || 0)}</Typography></Stack>
                    <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Phương thức</Typography><Typography variant="body2" fontWeight={600}>{getPaymentMethodLabel(payment?.method || currentRide.paymentMethod || 'CASH')}</Typography></Stack>
                    <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Trạng thái thanh toán</Typography><Chip size="small" icon={<PaymentRounded />} label={PAYMENT_STATUS_LABELS[payment?.status || 'PENDING'] || 'Đang chờ'} data-testid="payment-status-chip" color={payment?.status === 'COMPLETED' ? 'success' : payment?.status === 'FAILED' ? 'error' : 'warning'} /></Stack>
                  </Stack>
                </CardContent>
              </Card>

              <Card sx={{ borderRadius: 4 }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 0.5 }}>{existingReview ? 'Đánh giá của bạn' : 'Đánh giá tài xế'}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Phản hồi của bạn giúp cải thiện chất lượng phục vụ và xếp hạng tài xế.</Typography>
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
            </>
          )}

          {(status === 'CANCELLED' || status === 'NO_DRIVER_AVAILABLE') && (
            <Button variant="contained" fullWidth onClick={() => { dispatch(clearRide()); navigate('/home'); }} sx={{ borderRadius: 3, py: 1.4, fontWeight: 700 }}>
              Quay về trang chủ
            </Button>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default RideTracking;
