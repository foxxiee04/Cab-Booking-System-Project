import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Collapse,
  Container,
  Typography,
  Chip,
  Button,
  CircularProgress,
  Alert,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { ExpandMoreRounded, ExpandLessRounded, SearchRounded } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { rideApi } from '../api/ride.api';
import { paymentApi } from '../api/payment.api';
import { Payment, Ride } from '../types';
import {
  formatCurrency,
  formatDate,
  getRideStatusLabel,
  getRideStatusColor,
  getVehicleTypeLabel,
} from '../utils/format.utils';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 10;

const ONLINE_METHODS = new Set(['MOMO', 'VNPAY', 'CARD', 'WALLET']);

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
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [rides, setRides] = useState<Ride[]>([]);
  const [paymentMap, setPaymentMap] = useState<Map<string, Payment>>(new Map());
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

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

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight="bold">
        {t('rideHistory.title')}
      </Typography>

      <Box sx={{ mt: 2, display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 180px' } }}>
        <TextField
          size="small"
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
        />
        <TextField
          select
          size="small"
          label="Trạng thái"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <MenuItem value="ALL">Tất cả</MenuItem>
          <MenuItem value="PENDING">Đang chờ</MenuItem>
          <MenuItem value="ASSIGNED">Đã gán tài xế</MenuItem>
          <MenuItem value="IN_PROGRESS">Đang chạy</MenuItem>
          <MenuItem value="COMPLETED">Hoàn tất</MenuItem>
          <MenuItem value="CANCELLED">Đã hủy</MenuItem>
        </TextField>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box sx={{ mt: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {!loading && filteredRides.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {t('rideHistory.noRides')}
        </Typography>
      )}

      <Box sx={{ mt: 2, display: 'grid', gap: 2 }}>
        {filteredRides.map((ride) => {
          const payment = paymentMap.get(ride.id);
          const showRefundBadge =
            ride.status === 'CANCELLED' &&
            payment &&
            ONLINE_METHODS.has(ride.paymentMethod);

          return (
            <Card key={ride.id} variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {getVehicleTypeLabel(ride.vehicleType)}
                  </Typography>
                  <Chip
                    label={getRideStatusLabel(ride.status)}
                    sx={{ bgcolor: getRideStatusColor(ride.status), color: '#fff' }}
                    size="small"
                  />
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {formatDate(ride.requestedAt)}
                </Typography>

                <Typography variant="body2" sx={{ mt: 1 }}>
                  {t('rideHistory.pickup')}: {ride.pickup?.address || (ride.pickup?.lat ? `${ride.pickup.lat.toFixed(5)}, ${ride.pickup.lng.toFixed(5)}` : t('common.na'))}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {t('rideHistory.dropoff')}: {ride.dropoff?.address || (ride.dropoff?.lat ? `${ride.dropoff.lat.toFixed(5)}, ${ride.dropoff.lng.toFixed(5)}` : t('common.na'))}
                </Typography>

                <Typography variant="body2" sx={{ mt: 1 }}>
                  {t('rideHistory.fare')}: {ride.fare ? formatCurrency(ride.fare) : t('common.na')}
                </Typography>

                {showRefundBadge && payment && (
                  <RefundTimeline payment={payment} />
                )}

                <Button
                  size="small"
                  sx={{ mt: 1 }}
                  onClick={() => navigate(`/ride/${ride.id}`)}
                >
                  {t('rideHistory.viewRide')}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
        <Button
          variant="outlined"
          disabled={page <= 1}
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
        >
          {t('common.previous')}
        </Button>
        <Button
          variant="outlined"
          disabled={page >= totalPages}
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
        >
          {t('common.next')}
        </Button>
        <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
          {t('rideHistory.page', { page, total: totalPages })}
        </Typography>
      </Box>
    </Container>
  );
};

export default RideHistory;
