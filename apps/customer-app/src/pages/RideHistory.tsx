import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Collapse,
  Typography,
  Chip,
  Button,
  CircularProgress,
  Alert,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
} from '@mui/material';
import {
  ExpandMoreRounded,
  ExpandLessRounded,
  SearchRounded,
  ReceiptLongRounded,
  LocationOnRounded,
  FlagRounded,
  CloseRounded,
  AttachMoneyRounded,
  RouteRounded,
  AccessTimeRounded,
  DirectionsCarRounded,
  EventRounded,
  StarRounded,
  StarBorderRounded,
  RateReviewRounded,
  CheckCircleRounded,
} from '@mui/icons-material';
import { rideApi } from '../api/ride.api';
import { paymentApi } from '../api/payment.api';
import { reviewApi } from '../api/review.api';
import { Payment, Ride } from '../types';
import {
  formatCurrency,
  formatDate,
  getRideStatusLabel,
  getRideStatusColor,
  getVehicleTypeLabel,
} from '../utils/format.utils';
import { useTranslation } from 'react-i18next';
import ContactBox from '../components/ContactBox';
import { DriverPortraitAvatar } from '../components/common/DriverPortraitFrame';
import { useAppSelector } from '../store/hooks';
import { QRCodeSVG } from 'qrcode.react';

const PAGE_SIZE = 10;

const ONLINE_METHODS = new Set(['MOMO', 'VNPAY', 'CARD', 'WALLET']);

// Quick-select tags grouped by star rating
const QUICK_TAGS: Record<number, { label: string; value: string }[]> = {
  5: [
    { label: 'Tuyệt vời!', value: 'excellent' },
    { label: 'Lái xe an toàn', value: 'safe_driving' },
    { label: 'Rất thân thiện', value: 'friendly' },
    { label: 'Đúng giờ', value: 'on_time' },
    { label: 'Xe sạch sẽ', value: 'clean_car' },
  ],
  4: [
    { label: 'Dịch vụ tốt', value: 'good_service' },
    { label: 'Lái cẩn thận', value: 'careful_driving' },
    { label: 'Thái độ tốt', value: 'good_attitude' },
    { label: 'Đúng tuyến đường', value: 'correct_route' },
  ],
  3: [
    { label: 'Bình thường', value: 'average' },
    { label: 'Cần cải thiện', value: 'needs_improvement' },
    { label: 'Hơi trễ', value: 'slightly_late' },
  ],
  2: [
    { label: 'Lái chưa cẩn thận', value: 'careless_driving' },
    { label: 'Thái độ chưa tốt', value: 'poor_attitude' },
    { label: 'Xe chưa sạch', value: 'unclean_car' },
    { label: 'Đến muộn', value: 'late' },
  ],
  1: [
    { label: 'Lái không an toàn', value: 'unsafe_driving' },
    { label: 'Thái độ không tốt', value: 'bad_attitude' },
    { label: 'Xe không sạch', value: 'dirty_car' },
    { label: 'Đến rất muộn', value: 'very_late' },
    { label: 'Sai tuyến đường', value: 'wrong_route' },
  ],
};

// ─── ReviewModal ────────────────────────────────────────────────────────────
interface ReviewModalProps {
  open: boolean;
  ride: Ride;
  onClose: () => void;
  onSubmitted: () => void;
}

const ReviewModal: React.FC<ReviewModalProps> = ({ open, ride, onClose, onSubmitted }) => {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const driverName = `${ride.driver?.firstName || ''} ${ride.driver?.lastName || ''}`.trim() || 'Tài xế';

  const handleStarClick = (star: number) => {
    setRating(star);
    setSelectedTags([]);
  };

  const toggleTag = (value: string) => {
    setSelectedTags((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await reviewApi.createRideReview({
        rideId: ride.id,
        bookingId: ride.bookingId,
        revieweeId: ride.driverId!,
        revieweeName: driverName,
        rating,
        comment: comment.trim() || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
      });
      onSubmitted();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Không thể gửi đánh giá');
    } finally {
      setSubmitting(false);
    }
  };

  const displayRating = hoverRating || rating;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            <RateReviewRounded sx={{ color: '#2563eb' }} />
            <Typography fontWeight={800}>Đánh giá chuyến đi</Typography>
          </Stack>
          <IconButton size="small" onClick={onClose}><CloseRounded fontSize="small" /></IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {/* Driver info */}
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ bgcolor: '#eff6ff', borderRadius: 3, p: 1.5 }}>
            <DriverPortraitAvatar
              src={ride.driver?.avatar}
              initials={
                `${ride.driver?.firstName?.[0] || ''}${ride.driver?.lastName?.[0] || ''}`.trim().toUpperCase() || 'T'
              }
              size={44}
            />
            <Box>
              <Typography variant="subtitle2" fontWeight={800}>{driverName}</Typography>
              <Typography variant="caption" color="text.secondary">{ride.driver?.licensePlate || 'Biển số đang cập nhật'}</Typography>
            </Box>
          </Stack>

          {/* Star selector */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
              {displayRating === 5 ? 'Tuyệt vời' : displayRating === 4 ? 'Tốt' : displayRating === 3 ? 'Bình thường' : displayRating === 2 ? 'Tệ' : 'Rất tệ'}
            </Typography>
            <Stack direction="row" justifyContent="center" spacing={0.5}>
              {[1, 2, 3, 4, 5].map((star) => (
                <IconButton
                  key={star}
                  size="small"
                  onClick={() => handleStarClick(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  sx={{ p: 0.25 }}
                >
                  {star <= displayRating
                    ? <StarRounded sx={{ fontSize: 36, color: '#f59e0b' }} />
                    : <StarBorderRounded sx={{ fontSize: 36, color: '#d1d5db' }} />
                  }
                </IconButton>
              ))}
            </Stack>
          </Box>

          {/* Quick-select tags */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ mb: 1 }}>
              Chọn nhanh (không bắt buộc)
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.75}>
              {(QUICK_TAGS[rating] || []).map((tag) => (
                <Chip
                  key={tag.value}
                  label={tag.label}
                  size="small"
                  onClick={() => toggleTag(tag.value)}
                  variant={selectedTags.includes(tag.value) ? 'filled' : 'outlined'}
                  sx={{
                    fontWeight: 600,
                    cursor: 'pointer',
                    bgcolor: selectedTags.includes(tag.value) ? '#2563eb' : undefined,
                    color: selectedTags.includes(tag.value) ? '#fff' : undefined,
                    borderColor: '#2563eb',
                  }}
                />
              ))}
            </Stack>
          </Box>

          {/* Comment */}
          <TextField
            multiline
            minRows={2}
            maxRows={4}
            placeholder="Thêm nhận xét (không bắt buộc)..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            inputProps={{ maxLength: 300 }}
            size="small"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />

          {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button variant="outlined" onClick={onClose} sx={{ borderRadius: 999 }}>Bỏ qua</Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
          sx={{ borderRadius: 999, px: 3 }}
        >
          Gửi đánh giá
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const getDriverName = (ride: Ride) => {
  const fullName = `${ride.driver?.firstName || ''} ${ride.driver?.lastName || ''}`.trim();
  return fullName || ride.driver?.phoneNumber || 'Tài xế';
};

const canReviewRideConversation = (ride: Ride) => (
  ['ACCEPTED', 'PICKING_UP', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(ride.status)
);

const getLocationText = (location?: { address?: string; lat?: number; lng?: number }) => {
  if (location?.address && location.address.trim()) {
    return location.address;
  }

  if (typeof location?.lat === 'number' && typeof location?.lng === 'number' && !Number.isNaN(location.lat) && !Number.isNaN(location.lng)) {
    return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
  }

  return 'Không có dữ liệu vị trí';
};

function RefundTimeline({ payment }: { payment: Payment }) {
  const [open, setOpen] = useState(false);
  const isRefunded = payment.status === 'REFUNDED';
  const isPending =
    payment.status === 'COMPLETED' || payment.status === 'PROCESSING';

  const isMomo = payment.provider === 'MOMO' || payment.method === 'MOMO';
  const isVnpay = payment.provider === 'VNPAY' || payment.method === 'VNPAY';
  const providerLabel = isMomo ? 'MoMo' : isVnpay ? 'VNPay' : 'cổng thanh toán';
  const destinationLabel = isMomo ? 'ví MoMo' : isVnpay ? 'tài khoản ngân hàng' : 'ví thanh toán';
  const timeEstimate = isMomo ? 'vài phút – 1 giờ' : isVnpay ? '3–5 ngày làm việc' : '1–3 ngày';

  return (
    <Box sx={{ mt: 1.5 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        {isRefunded ? (
          <Chip
            label={`Đã hoàn về ${destinationLabel}`}
            size="small"
            data-testid="refund-badge-refunded"
            sx={{ bgcolor: '#0d9488', color: '#fff', fontWeight: 700 }}
          />
        ) : isPending ? (
          <Chip
            label={`Đang hoàn về ${destinationLabel}`}
            size="small"
            data-testid="refund-badge-pending"
            sx={{ bgcolor: '#f59e0b', color: '#fff', fontWeight: 700 }}
          />
        ) : null}

        {isRefunded && payment.refund && (
          <Button
            size="small"
            variant="text"
            endIcon={open ? <ExpandLessRounded /> : <ExpandMoreRounded />}
            onClick={() => setOpen((v) => !v)}
            sx={{ fontSize: 12, px: 0.5 }}
          >
            Chi tiết
          </Button>
        )}
      </Stack>

      {isRefunded && payment.refund && (
        <Collapse in={open}>
          <Box
            sx={{
              mt: 1,
              borderRadius: 2,
              bgcolor: '#f0fdfa',
              border: '1px solid #99f6e4',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ height: 3, background: 'linear-gradient(90deg, #0d9488, #14b8a6)' }} />
            <Box sx={{ p: 1.5 }}>
              <Stack spacing={0.75}>
                {payment.refund.amount != null && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">Số tiền hoàn</Typography>
                    <Typography variant="caption" fontWeight={800} color="#134e4a">{formatCurrency(payment.refund.amount)}</Typography>
                  </Stack>
                )}
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Hoàn về</Typography>
                  <Typography variant="caption" fontWeight={700} color="#0f766e">{destinationLabel}</Typography>
                </Stack>
                {payment.refundedAt && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">Thời điểm ghi nhận</Typography>
                    <Typography variant="caption" fontWeight={700}>{formatDate(payment.refundedAt)}</Typography>
                  </Stack>
                )}
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Thời gian hoàn dự kiến</Typography>
                  <Typography variant="caption" fontWeight={600}>{timeEstimate}</Typography>
                </Stack>

                {/* MoMo-specific */}
                {payment.refund.requestId && (
                  <Stack direction="row" justifyContent="space-between" alignItems="center" data-testid="refund-request-id">
                    <Typography variant="caption" color="text.secondary">Mã yêu cầu hoàn (MoMo)</Typography>
                    <Typography variant="caption" fontWeight={600} sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{payment.refund.requestId}</Typography>
                  </Stack>
                )}
                {payment.refund.refundOrderId && (
                  <Stack direction="row" justifyContent="space-between" alignItems="center" data-testid="refund-order-id">
                    <Typography variant="caption" color="text.secondary">Mã hoàn tiền MoMo</Typography>
                    <Typography variant="caption" fontWeight={600} sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{payment.refund.refundOrderId}</Typography>
                  </Stack>
                )}
                {typeof payment.refund.resultCode === 'number' && (
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">Mã kết quả MoMo</Typography>
                    <Chip
                      label={payment.refund.resultCode === 0 ? `${payment.refund.resultCode} – OK` : String(payment.refund.resultCode)}
                      size="small"
                      sx={{ height: 18, fontSize: '0.65rem', bgcolor: payment.refund.resultCode === 0 ? '#0d9488' : '#f59e0b', color: '#fff' }}
                    />
                  </Stack>
                )}

                {/* VNPay-specific */}
                {payment.refund.txnRef && (
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">Mã giao dịch VNPay (TxnRef)</Typography>
                    <Typography variant="caption" fontWeight={600} sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{payment.refund.txnRef}</Typography>
                  </Stack>
                )}
                {payment.refund.responseCode && (
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">Mã phản hồi VNPay</Typography>
                    <Chip
                      label={payment.refund.responseCode === '00' ? `00 – Thành công` : payment.refund.responseCode}
                      size="small"
                      sx={{ height: 18, fontSize: '0.65rem', bgcolor: payment.refund.responseCode === '00' ? '#0d9488' : '#f59e0b', color: '#fff' }}
                    />
                  </Stack>
                )}

                {/* Common */}
                {payment.refund.refundTransactionId && (
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">Mã giao dịch hoàn</Typography>
                    <Typography variant="caption" fontWeight={600} sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{payment.refund.refundTransactionId}</Typography>
                  </Stack>
                )}
                {payment.refund.description && (
                  <Typography variant="caption" display="block" color="text.secondary">
                    Lý do: {payment.refund.description}
                  </Typography>
                )}
                <Typography variant="caption" display="block" color="text.secondary" sx={{ pt: 0.5, fontStyle: 'italic' }}>
                  Cổng hoàn tiền: <strong>{providerLabel}</strong>
                </Typography>
              </Stack>
            </Box>
          </Box>
        </Collapse>
      )}
    </Box>
  );
}

const RideHistory: React.FC = () => {
  const { t } = useTranslation();
  const { accessToken, user } = useAppSelector((state) => state.auth);
  const [rides, setRides] = useState<Ride[]>([]);
  const [paymentMap, setPaymentMap] = useState<Map<string, Payment>>(new Map());
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [selectedRideLoading, setSelectedRideLoading] = useState(false);
  const [reviewRide, setReviewRide] = useState<Ride | null>(null);
  const [reviewedRideIds, setReviewedRideIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      setError('');
      try {
        const [rideResponse, paymentResponse] = await Promise.allSettled([
          rideApi.getRideHistory(page, PAGE_SIZE),
          paymentApi.getCustomerPaymentHistory(1, 100),
        ]);

        if (rideResponse.status === 'fulfilled') {
          setRides(rideResponse.value.data.rides || []);
          setTotal(rideResponse.value.data.total || 0);
        } else {
          throw (rideResponse as PromiseRejectedResult).reason;
        }

        if (paymentResponse.status === 'fulfilled') {
          const map = new Map<string, Payment>();
          for (const p of paymentResponse.value.data.payments) {
            map.set(p.rideId, p);
          }
          setPaymentMap(map);
        }
        // Payment fetch failure is non-fatal — badges simply won't show
      } catch (err: any) {
        setError(err.response?.data?.error?.message || t('errors.loadRideHistory'));
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [page, t]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filteredRides = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return rides.filter((ride) => {
      const matchStatus = statusFilter === 'ALL' || ride.status === statusFilter;
      if (!matchStatus) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const rideText = [
        ride.id,
        ride.pickup?.address,
        ride.dropoff?.address,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return rideText.includes(normalizedSearch);
    });
  }, [rides, searchQuery, statusFilter]);

  const handleOpenRideDetails = async (ride: Ride) => {
    setSelectedRide(ride);
    setSelectedRideLoading(true);

    try {
      const response = await rideApi.getRide(ride.id);
      setSelectedRide(response.data.ride);
    } catch {
      setSelectedRide(ride);
    } finally {
      setSelectedRideLoading(false);
    }
  };

  const handleOpenReview = async (ride: Ride) => {
    // Check if customer already reviewed this ride
    if (reviewedRideIds.has(ride.id)) return;
    try {
      const existing = await reviewApi.getMyReviewForRide(ride.id);
      if (existing) {
        setReviewedRideIds((prev) => new Set(prev).add(ride.id));
        return;
      }
    } catch { /* ignore — open modal anyway */ }
    setReviewRide(ride);
  };

  const handleReviewSubmitted = () => {
    if (reviewRide) {
      setReviewedRideIds((prev) => new Set(prev).add(reviewRide.id));
    }
    setReviewRide(null);
    setSelectedRide(null);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        pb: 2,
        background: 'radial-gradient(circle at top left, rgba(56,189,248,0.12), transparent 28%), linear-gradient(180deg, #f8fbff 0%, #eef6ff 100%)',
      }}
    >
      {/* Header card */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 5,
          background: 'linear-gradient(135deg, rgba(14,165,233,0.10), rgba(37,99,235,0.18))',
          border: '1px solid rgba(59,130,246,0.12)',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
          <Box sx={{ p: 1.25, borderRadius: 3, bgcolor: 'rgba(37,99,235,0.10)', display: 'flex' }}>
            <ReceiptLongRounded sx={{ color: '#2563eb', fontSize: 26 }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={800}>{t('rideHistory.title')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {total > 0 ? `${total} chuyến đã đặt` : 'Lịch sử chuyến đi'}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            fullWidth
            placeholder="Tìm theo mã chuyến, điểm đón, điểm đến"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
          />
          <TextField
            select
            size="small"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            sx={{ minWidth: 130, '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
          >
            <MenuItem value="ALL">Tất cả</MenuItem>
            <MenuItem value="PENDING">Đang chờ</MenuItem>
            <MenuItem value="ASSIGNED">Đã gán tài xế</MenuItem>
            <MenuItem value="IN_PROGRESS">Đang chạy</MenuItem>
            <MenuItem value="COMPLETED">Hoàn tất</MenuItem>
            <MenuItem value="CANCELLED">Đã hủy</MenuItem>
          </TextField>
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ borderRadius: 3 }}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {!loading && filteredRides.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 7, px: 3, bgcolor: '#f8fafc', borderRadius: 4, border: '1px solid #e2e8f0' }}>
          <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
            <ReceiptLongRounded sx={{ fontSize: 30, color: 'text.disabled' }} />
          </Box>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>{t('rideHistory.noRides', 'Chưa có chuyến nào')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('rideHistory.noRidesDesc', 'Tất cả chuyến đi sẽ xuất hiện ở đây.')}
          </Typography>
        </Box>
      )}

      <Box sx={{ display: 'grid', gap: 1.5 }}>
        {filteredRides.map((ride) => {
          const payment = paymentMap.get(ride.id);
          const showRefundBadge =
            ride.status === 'CANCELLED' &&
            payment &&
            ONLINE_METHODS.has(ride.paymentMethod);

          return (
            <Card key={ride.id} variant="outlined" sx={{ borderRadius: 4, cursor: 'pointer', borderLeft: '3px solid', borderLeftColor: ride.status === 'COMPLETED' ? 'success.main' : ride.status === 'CANCELLED' ? 'error.main' : 'primary.main', transition: 'all 0.15s', '&:hover': { boxShadow: 3, transform: 'translateY(-1px)' } }} onClick={() => void handleOpenRideDetails(ride)}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={800}>
                      {getVehicleTypeLabel(ride.vehicleType)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(ride.requestedAt)}
                    </Typography>
                  </Box>
                  <Chip
                    label={getRideStatusLabel(ride.status)}
                    sx={{ bgcolor: getRideStatusColor(ride.status), color: '#fff', fontWeight: 700 }}
                    size="small"
                  />
                </Stack>

                {ride.driverId && (
                  <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.25 }}>
                    <DriverPortraitAvatar
                      src={ride.driver?.avatar}
                      initials={
                        `${ride.driver?.firstName?.[0] || ''}${ride.driver?.lastName?.[0] || ''}`.trim().toUpperCase() || 'T'
                      }
                      size={36}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={800} noWrap>
                        {getDriverName(ride)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {ride.driver?.phoneNumber || 'Đang cập nhật số điện thoại'}
                      </Typography>
                    </Box>
                  </Stack>
                )}

                <Stack spacing={0.5} sx={{ mb: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <LocationOnRounded sx={{ fontSize: 16, color: '#16a34a', mt: 0.25, flexShrink: 0 }} />
                    <Typography variant="body2">{ride.pickup?.address || (ride.pickup?.lat ? `${ride.pickup.lat.toFixed(5)}, ${ride.pickup.lng.toFixed(5)}` : t('common.na'))}</Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <FlagRounded sx={{ fontSize: 16, color: '#dc2626', mt: 0.25, flexShrink: 0 }} />
                    <Typography variant="body2">{ride.dropoff?.address || (ride.dropoff?.lat ? `${ride.dropoff.lat.toFixed(5)}, ${ride.dropoff.lng.toFixed(5)}` : t('common.na'))}</Typography>
                  </Stack>
                </Stack>

                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2" fontWeight={800} color="primary.main">
                    {ride.fare ? formatCurrency(ride.fare) : t('common.na')}
                  </Typography>
                  <Stack direction="row" spacing={0.75}>
                    {ride.status === 'COMPLETED' && ride.driverId && !reviewedRideIds.has(ride.id) && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        startIcon={<StarRounded fontSize="small" />}
                        sx={{ borderRadius: 2, fontWeight: 700 }}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleOpenReview(ride);
                        }}
                      >
                        Đánh giá
                      </Button>
                    )}
                    {ride.status === 'COMPLETED' && ride.driverId && reviewedRideIds.has(ride.id) && (
                      <Chip
                        icon={<CheckCircleRounded sx={{ fontSize: '14px !important' }} />}
                        label="Đã đánh giá"
                        size="small"
                        sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: 11 }}
                      />
                    )}
                    <Button
                      size="small"
                      variant="outlined"
                      sx={{ borderRadius: 2 }}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleOpenRideDetails(ride);
                      }}
                    >
                      Xem chi tiết
                    </Button>
                  </Stack>
                </Stack>

                {showRefundBadge && payment && (
                  <RefundTimeline payment={payment} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </Box>

      {totalPages > 1 && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ pt: 1 }}>
          <Button
            variant="outlined"
            size="small"
            disabled={page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            sx={{ borderRadius: 3 }}
          >
            {t('common.previous')}
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1, textAlign: 'center' }}>
            {t('rideHistory.page', { page, total: totalPages })}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            sx={{ borderRadius: 3 }}
          >
            {t('common.next')}
          </Button>
        </Stack>
      )}

      <Dialog
        open={Boolean(selectedRide)}
        onClose={() => setSelectedRide(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 4 } }}
      >
        {selectedRide && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
              <Box>
                <Typography variant="h6" fontWeight={800}>Chi tiết chuyến đi</Typography>
                <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace' }}>
                  #{selectedRide.id.slice(0, 8).toUpperCase()}
                </Typography>
              </Box>
              <Button size="small" onClick={() => setSelectedRide(null)} startIcon={<CloseRounded fontSize="small" />}>
                Đóng
              </Button>
            </DialogTitle>

            <DialogContent dividers>
              <Stack spacing={2}>
                {selectedRideLoading && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">
                      Đang tải đầy đủ thông tin chuyến đi...
                    </Typography>
                  </Stack>
                )}

                {selectedRide.driverId && (
                  <Box sx={{ bgcolor: '#eff6ff', borderRadius: 3, p: 1.5, border: '1px solid rgba(59,130,246,0.14)' }}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <DriverPortraitAvatar
                        src={selectedRide.driver?.avatar}
                        initials={
                          `${selectedRide.driver?.firstName?.[0] || ''}${selectedRide.driver?.lastName?.[0] || ''}`.trim().toUpperCase() || 'T'
                        }
                        size={44}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" fontWeight={800}>{getDriverName(selectedRide)}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {selectedRide.driver?.phoneNumber || 'Số điện thoại đang cập nhật'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {selectedRide.driver?.licensePlate || 'Biển số đang cập nhật'}
                        </Typography>
                      </Box>
                      <Chip label={((selectedRide.driver?.rating || 5)).toFixed(1)} size="small" />
                    </Stack>
                  </Box>
                )}

                <Box sx={{ bgcolor: '#f8fafc', borderRadius: 3, p: 1.5 }}>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <LocationOnRounded color="success" sx={{ mt: 0.25, flexShrink: 0 }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>ĐIỂM ĐÓN</Typography>
                      <Typography variant="body2">{getLocationText(selectedRide.pickupLocation || selectedRide.pickup)}</Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 1.5 }}>
                    <FlagRounded color="error" sx={{ mt: 0.25, flexShrink: 0 }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>ĐIỂM ĐẾN</Typography>
                      <Typography variant="body2">{getLocationText(selectedRide.dropoffLocation || selectedRide.dropoff)}</Typography>
                    </Box>
                  </Stack>
                </Box>

                <Divider />

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <AttachMoneyRounded color="primary" fontSize="small" />
                    <Box>
                      <Typography variant="caption" color="text.secondary">Tiền cước</Typography>
                      <Typography variant="body2" fontWeight={700}>{selectedRide.fare ? formatCurrency(selectedRide.fare) : 'Chưa có'}</Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <DirectionsCarRounded color="action" fontSize="small" />
                    <Box>
                      <Typography variant="caption" color="text.secondary">Loại xe</Typography>
                      <Typography variant="body2" fontWeight={700}>{getVehicleTypeLabel(selectedRide.vehicleType)}</Typography>
                    </Box>
                  </Stack>
                  {selectedRide.distance != null && selectedRide.distance > 0 && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <RouteRounded color="action" fontSize="small" />
                      <Box>
                        <Typography variant="caption" color="text.secondary">Quãng đường chuyến đi</Typography>
                        <Typography variant="body2" fontWeight={700}>
                          {selectedRide.distance < 1
                            ? `${Math.round(selectedRide.distance * 1000)} m`
                            : `${selectedRide.distance.toFixed(1)} km`}
                        </Typography>
                      </Box>
                    </Stack>
                  )}
                  {selectedRide.duration != null && selectedRide.duration > 0 && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AccessTimeRounded color="action" fontSize="small" />
                      <Box>
                        <Typography variant="caption" color="text.secondary">Thời gian ước tính</Typography>
                        <Typography variant="body2" fontWeight={700}>
                          {`${Math.max(1, Math.round(selectedRide.duration / 60))} phút`}
                        </Typography>
                      </Box>
                    </Stack>
                  )}
                </Box>

                <Divider />

                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 1, display: 'block' }}>
                    THỜI GIAN
                  </Typography>
                  <Stack spacing={0.75}>
                    {selectedRide.requestedAt && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <EventRounded color="action" fontSize="small" />
                        <Typography variant="body2" color="text.secondary">Tạo lúc:</Typography>
                        <Typography variant="body2">{formatDate(selectedRide.requestedAt)}</Typography>
                      </Stack>
                    )}
                    {selectedRide.startedAt && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <EventRounded color="action" fontSize="small" sx={{ color: '#16a34a' }} />
                        <Typography variant="body2" color="text.secondary">Bắt đầu:</Typography>
                        <Typography variant="body2">{formatDate(selectedRide.startedAt)}</Typography>
                      </Stack>
                    )}
                    {selectedRide.completedAt && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <EventRounded color="action" fontSize="small" sx={{ color: '#2563eb' }} />
                        <Typography variant="body2" color="text.secondary">Hoàn tất:</Typography>
                        <Typography variant="body2">{formatDate(selectedRide.completedAt)}</Typography>
                      </Stack>
                    )}
                    {selectedRide.cancelledAt && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <EventRounded color="action" fontSize="small" sx={{ color: '#dc2626' }} />
                        <Typography variant="body2" color="text.secondary">Hủy lúc:</Typography>
                        <Typography variant="body2">{formatDate(selectedRide.cancelledAt)}</Typography>
                      </Stack>
                    )}
                  </Stack>
                </Box>

                {/* Hóa đơn QR — quét để mở lại chi tiết hóa đơn / chuyến đi.
                    Encode an absolute deeplink so it works whether scanned from
                    another device or copied to clipboard. */}
                <Divider />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, bgcolor: '#f8fafc', borderRadius: 3, p: 1.5, border: '1px solid rgba(148,163,184,0.18)' }}>
                  <Box sx={{ p: 0.75, bgcolor: '#fff', borderRadius: 2, border: '1px solid #e2e8f0', flexShrink: 0 }}>
                    <QRCodeSVG
                      value={`${window.location.origin}/ride/${selectedRide.id}`}
                      size={96}
                      level="M"
                      includeMargin={false}
                    />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: '0.08em' }}>
                      QR HÓA ĐƠN
                    </Typography>
                    <Typography variant="body2" fontWeight={700} sx={{ mt: 0.25 }}>
                      Quét mã để mở lại chi tiết chuyến đi
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, wordBreak: 'break-all', fontFamily: 'monospace' }}>
                      Mã chuyến: {selectedRide.id.slice(0, 8).toUpperCase()}
                    </Typography>
                  </Box>
                </Box>

                {selectedRide.driverId && canReviewRideConversation(selectedRide) && (
                  <>
                    <Divider />
                    <ContactBox
                      token={accessToken}
                      rideId={selectedRide.id}
                      myUserId={user?.id}
                      contactName={getDriverName(selectedRide)}
                      contactPhone={selectedRide.driver?.phoneNumber || undefined}
                      role="CUSTOMER"
                      triggerMode="inline"
                      triggerLabel="Xem lại cuộc trò chuyện"
                      fullWidthTrigger
                      readOnly
                    />
                  </>
                )}
              </Stack>
            </DialogContent>

            <DialogActions sx={{ p: 2, gap: 1 }}>
              {selectedRide.status === 'COMPLETED' && selectedRide.driverId && (
                reviewedRideIds.has(selectedRide.id)
                  ? (
                    <Chip
                      icon={<CheckCircleRounded sx={{ fontSize: '14px !important' }} />}
                      label="Đã đánh giá tài xế"
                      sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 700 }}
                    />
                  ) : (
                    <Button
                      variant="outlined"
                      color="warning"
                      startIcon={<StarRounded />}
                      onClick={() => void handleOpenReview(selectedRide)}
                      sx={{ borderRadius: 999 }}
                    >
                      Đánh giá tài xế
                    </Button>
                  )
              )}
              <Button variant="contained" onClick={() => setSelectedRide(null)} sx={{ borderRadius: 999, px: 3 }}>
                Đóng
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Review modal */}
      {reviewRide && (
        <ReviewModal
          open={Boolean(reviewRide)}
          ride={reviewRide}
          onClose={() => setReviewRide(null)}
          onSubmitted={handleReviewSubmitted}
        />
      )}
    </Box>
  );
};

export default RideHistory;
