import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  AccessTimeRounded,
  CheckCircleRounded,
  DirectionsCarFilledRounded,
  ExpandLessRounded,
  ExpandMoreRounded,
  FlagRounded,
  LocalAtmRounded,
  LocationOnRounded,
  RouteRounded,
  TwoWheelerRounded,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { rideApi } from '../api/ride.api';
import { paymentApi } from '../api/payment.api';
import { Payment, Ride } from '../types';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setCurrentRide } from '../store/ride.slice';
import {
  formatCurrency,
  formatDate,
  getRideStatusColor,
  getRideStatusLabel,
  getVehicleTypeLabel,
} from '../utils/format.utils';

const ONLINE_METHODS = new Set(['MOMO', 'VNPAY', 'CARD', 'WALLET']);

function RefundBadge({ payment }: { payment: Payment }) {
  const [open, setOpen] = useState(false);
  const isRefunded = payment.status === 'REFUNDED';
  const isPending = payment.status === 'COMPLETED' || payment.status === 'PROCESSING';

  if (!isRefunded && !isPending) return null;

  return (
    <Box sx={{ mt: 1 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        {isRefunded ? (
          <Chip
            label="Đã hoàn tiền"
            size="small"
            data-testid="refund-badge-refunded"
            sx={{ bgcolor: 'success.main', color: '#fff', fontWeight: 700, fontSize: 11 }}
          />
        ) : (
          <Chip
            label="Đang hoàn tiền"
            size="small"
            data-testid="refund-badge-pending"
            sx={{ bgcolor: 'warning.main', color: '#fff', fontWeight: 700, fontSize: 11 }}
          />
        )}
        {isRefunded && payment.refund && (
          <Button
            size="small"
            variant="text"
            endIcon={open ? <ExpandLessRounded /> : <ExpandMoreRounded />}
            onClick={() => setOpen((v) => !v)}
            sx={{ fontSize: 11, px: 0.5, minWidth: 0 }}
          >
            Chi tiết
          </Button>
        )}
      </Stack>
      {isRefunded && payment.refund && (
        <Collapse in={open}>
          <Box sx={{ mt: 0.75, p: 1, borderRadius: 2, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.light' }}>
            <Stack spacing={0.25}>
              {payment.refund.amount != null && (
                <Typography variant="caption" display="block">
                  Hoàn: <strong>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(payment.refund.amount)}</strong>
                </Typography>
              )}
              {payment.refundedAt && (
                <Typography variant="caption" display="block" color="text.secondary">
                  {new Date(payment.refundedAt).toLocaleString('vi-VN')}
                </Typography>
              )}
              {payment.refund.refundOrderId && (
                <Typography variant="caption" display="block" data-testid="refund-order-id">
                  Mã: <strong>{payment.refund.refundOrderId}</strong>
                </Typography>
              )}
            </Stack>
          </Box>
        </Collapse>
      )}
    </Box>
  );
}

const Activity: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const currentRide = useAppSelector((state) => state.ride.currentRide);

  const [rides, setRides] = useState<Ride[]>([]);
  const [paymentMap, setPaymentMap] = useState<Map<string, Payment>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'ongoing' | 'history'>('ongoing');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const [activeRideResponse, historyResponse, paymentResponse] = await Promise.allSettled([
          rideApi.getActiveRide(),
          rideApi.getRideHistory(1, 8),
          paymentApi.getCustomerPaymentHistory(1, 50),
        ]);

        if (activeRideResponse.status === 'fulfilled' && activeRideResponse.value?.data?.ride) {
          dispatch(setCurrentRide(activeRideResponse.value.data.ride));
        }

        if (historyResponse.status === 'fulfilled') {
          setRides(historyResponse.value.data.rides || []);
        } else {
          throw (historyResponse as PromiseRejectedResult).reason;
        }

        if (paymentResponse.status === 'fulfilled') {
          const map = new Map<string, Payment>();
          for (const p of paymentResponse.value.data.payments) {
            map.set(p.rideId, p);
          }
          setPaymentMap(map);
        }
      } catch (err: any) {
        setError(err.response?.data?.error?.message || t('errors.loadRideHistory'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dispatch, t]);

  const stats = useMemo(() => {
    const completedRides = rides.filter((ride) => ride.status === 'COMPLETED');
    const totalSpent = completedRides.reduce((sum, ride) => sum + (ride.fare || 0), 0);

    return {
      completed: completedRides.length,
      totalSpent,
    };
  }, [rides]);

  return (
    <Box sx={{ height: '100%', overflow: 'auto', pb: 3 }}>
      <Stack spacing={2}>

        {/* ── Stats row ── */}
        <Stack direction="row" spacing={1.5}>
          <Card sx={{ flex: 1, borderRadius: 4, background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`, color: '#fff', overflow: 'hidden', position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: -12, right: -12, width: 64, height: 64, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.07)' }} />
            <CardContent sx={{ pb: '16px !important' }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                <CheckCircleRounded sx={{ fontSize: 16, color: 'rgba(255,255,255,0.75)' }} />
                <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 600, letterSpacing: 0.3 }}>
                  {t('activity.completedTrips', 'Đã hoàn thành')}
                </Typography>
              </Stack>
              <Typography variant="h4" fontWeight={900} lineHeight={1}>{stats.completed}</Typography>
              <Typography variant="caption" sx={{ opacity: 0.65 }}>chuyến đi</Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1, borderRadius: 4, background: (theme) => `linear-gradient(135deg, ${theme.palette.secondary.dark} 0%, ${theme.palette.secondary.main} 100%)`, color: '#fff', overflow: 'hidden', position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: -12, right: -12, width: 64, height: 64, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.07)' }} />
            <CardContent sx={{ pb: '16px !important' }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                <LocalAtmRounded sx={{ fontSize: 16, color: 'rgba(255,255,255,0.75)' }} />
                <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 600, letterSpacing: 0.3 }}>
                  {t('activity.totalSpent', 'Tổng chi tiêu')}
                </Typography>
              </Stack>
              <Typography variant="h6" fontWeight={900} lineHeight={1.2}>{formatCurrency(stats.totalSpent)}</Typography>
              <Typography variant="caption" sx={{ opacity: 0.65 }}>tất cả chuyến</Typography>
            </CardContent>
          </Card>
        </Stack>

        {/* ── Tabs ── */}
        <Card sx={{ borderRadius: 4, overflow: 'hidden' }}>
          <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="fullWidth"
            sx={{ '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' } }}>
            <Tab value="ongoing" label={t('activity.ongoing', 'Đang diễn ra')} sx={{ fontWeight: 700 }} />
            <Tab value="history" label={t('activity.history', 'Lịch sử')} sx={{ fontWeight: 700 }} />
          </Tabs>
        </Card>

        {error && <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, gap: 2 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">Đang tải dữ liệu...</Typography>
          </Box>
        ) : tab === 'ongoing' ? (
          currentRide ? (
            <Card sx={{ borderRadius: 4, overflow: 'hidden', border: '2px solid', borderColor: 'primary.main', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
              <Box sx={{ px: 2.5, py: 1.5, background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.light}33, ${theme.palette.primary.light}18)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main', animation: 'pulse 1.5s infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
                  <Typography variant="subtitle2" fontWeight={800} color="primary.dark">
                    {t('activity.liveRide', 'Đang diễn ra')} · {getVehicleTypeLabel(currentRide.vehicleType)}
                  </Typography>
                </Stack>
                <Chip label={getRideStatusLabel(currentRide.status)} size="small" sx={{ bgcolor: getRideStatusColor(currentRide.status), color: '#fff', fontWeight: 700, fontSize: '0.72rem' }} />
              </Box>
              <CardContent sx={{ pt: 2 }}>
                <Stack spacing={1.2} mb={2}>
                  <Stack direction="row" spacing={1.2} alignItems="flex-start">
                    <LocationOnRounded sx={{ color: 'success.main', fontSize: 18, mt: 0.2, flexShrink: 0 }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>Điểm đón</Typography>
                      <Typography variant="body2">{currentRide.pickup?.address || 'Đang cập nhật...'}</Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1.2} alignItems="flex-start">
                    <FlagRounded sx={{ color: 'error.main', fontSize: 18, mt: 0.2, flexShrink: 0 }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>Điểm đến</Typography>
                      <Typography variant="body2">{currentRide.dropoff?.address || 'Đang cập nhật...'}</Typography>
                    </Box>
                  </Stack>
                </Stack>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap mb={2}>
                  {currentRide.distance ? <Chip icon={<RouteRounded />} label={`${currentRide.distance.toFixed(1)} km`} size="small" /> : null}
                  {currentRide.duration ? <Chip icon={<AccessTimeRounded />} label={`${Math.max(1, Math.round(currentRide.duration / 60))} phút`} size="small" /> : null}
                  {currentRide.fare ? <Chip icon={<LocalAtmRounded />} label={formatCurrency(currentRide.fare)} size="small" color="success" variant="outlined" /> : null}
                </Stack>
                <Button variant="contained" fullWidth size="large" sx={{ borderRadius: 3, py: 1.3, fontWeight: 700 }} onClick={() => navigate(`/ride/${currentRide.id}`)}>
                  {t('activity.trackRide', 'Theo dõi chuyến đi')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card sx={{ borderRadius: 4 }}>
              <CardContent sx={{ py: 7, textAlign: 'center' }}>
                <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                  <TwoWheelerRounded sx={{ fontSize: 36, color: 'text.disabled' }} />
                </Box>
                <Typography variant="h6" fontWeight={800} gutterBottom>
                  {t('activity.noOngoingTitle', 'Chưa có chuyến đang diễn ra')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 280, mx: 'auto' }}>
                  {t('activity.noOngoingBody', 'Khi bạn đặt xe, trạng thái realtime sẽ xuất hiện ở đây.')}
                </Typography>
                <Button variant="contained" onClick={() => navigate('/home')} sx={{ borderRadius: 3, px: 4 }}>
                  {t('activity.bookNow', 'Đặt xe ngay')}
                </Button>
              </CardContent>
            </Card>
          )
        ) : rides.length === 0 ? (
          <Card sx={{ borderRadius: 4 }}>
            <CardContent sx={{ py: 7, textAlign: 'center' }}>
                <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                <DirectionsCarFilledRounded sx={{ fontSize: 36, color: 'text.disabled' }} />
              </Box>
              <Typography variant="h6" fontWeight={800} gutterBottom>{t('rideHistory.noRides', 'Chưa có chuyến nào')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('rideHistory.noRidesDesc', 'Các chuyến đã hoàn thành sẽ hiển thị ở đây.')}</Typography>
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={1.2}>
            {rides.map((ride) => (
              <Card key={ride.id} sx={{ borderRadius: 4, '&:hover': { boxShadow: 3, transform: 'translateY(-1px)', transition: 'all 0.15s' } }}>
                <CardContent sx={{ pb: '12px !important' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.2}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <DirectionsCarFilledRounded sx={{ fontSize: 18, color: 'text.secondary' }} />
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700}>{getVehicleTypeLabel(ride.vehicleType)}</Typography>
                        <Typography variant="caption" color="text.secondary">{formatDate(ride.requestedAt)}</Typography>
                      </Box>
                    </Stack>
                    <Chip label={getRideStatusLabel(ride.status)} size="small" sx={{ bgcolor: getRideStatusColor(ride.status), color: '#fff', fontWeight: 700, fontSize: '0.68rem' }} />
                  </Stack>

                  <Stack spacing={0.6} mb={1.2}>
                    <Stack direction="row" spacing={0.75} alignItems="flex-start">
                      <LocationOnRounded sx={{ color: 'success.main', fontSize: 14, mt: 0.3, flexShrink: 0 }} />
                      <Typography variant="caption" noWrap sx={{ flex: 1 }}>
                        {ride.pickup?.address || t('common.na')}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.75} alignItems="flex-start">
                      <FlagRounded sx={{ color: 'error.main', fontSize: 14, mt: 0.3, flexShrink: 0 }} />
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
                        {ride.dropoff?.address || t('common.na')}
                      </Typography>
                    </Stack>
                  </Stack>

                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2" fontWeight={800} color={ride.status === 'COMPLETED' ? 'success.dark' : 'text.primary'}>
                      {ride.fare ? formatCurrency(ride.fare) : t('common.na')}
                    </Typography>
                    <Button size="small" variant="text" onClick={() => navigate(`/ride/${ride.id}`)} sx={{ fontWeight: 700, fontSize: '0.76rem' }}>
                      {t('rideHistory.viewRide', 'Chi tiết')} →
                    </Button>
                  </Stack>

                  {ride.status === 'CANCELLED' && ONLINE_METHODS.has(ride.paymentMethod) && paymentMap.get(ride.id) && (
                    <RefundBadge payment={paymentMap.get(ride.id)!} />
                  )}
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
};

export default Activity;