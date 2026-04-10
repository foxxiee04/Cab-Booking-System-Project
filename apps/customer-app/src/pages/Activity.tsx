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
  Divider,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  AccessTimeRounded,
  DirectionsCarFilledRounded,
  ExpandLessRounded,
  ExpandMoreRounded,
  LocalAtmRounded,
  RouteRounded,
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
            sx={{ bgcolor: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 11 }}
          />
        ) : (
          <Chip
            label="Đang hoàn tiền"
            size="small"
            data-testid="refund-badge-pending"
            sx={{ bgcolor: '#f59e0b', color: '#fff', fontWeight: 700, fontSize: 11 }}
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
          <Box sx={{ mt: 0.75, p: 1, borderRadius: 2, bgcolor: '#f0fdfa', border: '1px solid #99f6e4' }}>
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
    <Box sx={{ height: '100%', overflow: 'auto', pb: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.5}>
          <Card sx={{ flex: 1, borderRadius: 4, background: 'linear-gradient(135deg, #0f172a, #1d4ed8)', color: '#fff' }}>
            <CardContent>
              <Typography variant="overline" sx={{ opacity: 0.8 }}>
                {t('activity.completedTrips', 'Chuyến đã hoàn thành')}
              </Typography>
              <Typography variant="h5" fontWeight={800}>
                {stats.completed}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1, borderRadius: 4, background: 'linear-gradient(135deg, #ffffff, #e0f2fe)' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                {t('activity.totalSpent', 'Tổng chi tiêu')}
              </Typography>
              <Typography variant="h6" fontWeight={800}>
                {formatCurrency(stats.totalSpent)}
              </Typography>
            </CardContent>
          </Card>
        </Stack>

        <Card sx={{ borderRadius: 4 }}>
          <Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="fullWidth">
            <Tab value="ongoing" label={t('activity.ongoing', 'Đang diễn ra')} />
            <Tab value="history" label={t('activity.history', 'Lịch sử')} />
          </Tabs>
        </Card>

        {error && <Alert severity="error">{error}</Alert>}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : tab === 'ongoing' ? (
          currentRide ? (
            <Card sx={{ borderRadius: 5, overflow: 'hidden' }}>
              <Box sx={{ p: 2.5, background: 'linear-gradient(135deg, #dbeafe, #eff6ff)' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="overline" color="primary.main" sx={{ fontWeight: 800 }}>
                      {t('activity.liveRide', 'Cuốc xe hiện tại')}
                    </Typography>
                    <Typography variant="h6" fontWeight={800}>
                      {getVehicleTypeLabel(currentRide.vehicleType)}
                    </Typography>
                  </Box>
                  <Chip label={getRideStatusLabel(currentRide.status)} sx={{ bgcolor: getRideStatusColor(currentRide.status), color: '#fff', fontWeight: 700 }} />
                </Stack>
              </Box>

              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="body2" color="text.secondary">
                    {currentRide.pickup?.address || (currentRide.pickup?.lat ? `${currentRide.pickup.lat.toFixed(5)}, ${currentRide.pickup.lng.toFixed(5)}` : 'Không có địa chỉ')}
                  </Typography>
                  <Divider />
                  <Typography variant="body2" color="text.secondary">
                    {currentRide.dropoff?.address || (currentRide.dropoff?.lat ? `${currentRide.dropoff.lat.toFixed(5)}, ${currentRide.dropoff.lng.toFixed(5)}` : 'Không có địa chỉ')}
                  </Typography>

                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {currentRide.distance ? <Chip icon={<RouteRounded />} label={`${currentRide.distance.toFixed(1)} km`} size="small" /> : null}
                    {currentRide.duration ? <Chip icon={<AccessTimeRounded />} label={`${Math.max(1, Math.round(currentRide.duration / 60))} phút`} size="small" /> : null}
                    {currentRide.fare ? <Chip icon={<LocalAtmRounded />} label={formatCurrency(currentRide.fare)} size="small" /> : null}
                  </Stack>

                  <Button variant="contained" size="large" sx={{ borderRadius: 3, py: 1.4 }} onClick={() => navigate(`/ride/${currentRide.id}`)}>
                    {t('activity.trackRide', 'Theo dõi chuyến đi')}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ) : (
            <Card sx={{ borderRadius: 5 }}>
              <CardContent sx={{ py: 6, textAlign: 'center' }}>
                <DirectionsCarFilledRounded color="disabled" sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h6" fontWeight={800}>
                  {t('activity.noOngoingTitle', 'Chưa có chuyến nào đang diễn ra')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
                  {t('activity.noOngoingBody', 'Khi bạn đặt xe, trạng thái realtime sẽ xuất hiện tại đây để theo dõi ngay.')}
                </Typography>
                <Button variant="contained" onClick={() => navigate('/home')} sx={{ borderRadius: 3 }}>
                  {t('activity.bookNow', 'Đặt xe ngay')}
                </Button>
              </CardContent>
            </Card>
          )
        ) : rides.length === 0 ? (
          <Card sx={{ borderRadius: 5 }}>
            <CardContent sx={{ py: 6, textAlign: 'center' }}>
              <Typography variant="h6" fontWeight={800}>
                {t('rideHistory.noRides')}
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={1.5}>
            {rides.map((ride) => (
              <Card key={ride.id} sx={{ borderRadius: 4 }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={800}>
                        {getVehicleTypeLabel(ride.vehicleType)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(ride.requestedAt)}
                      </Typography>
                    </Box>
                    <Chip label={getRideStatusLabel(ride.status)} size="small" sx={{ bgcolor: getRideStatusColor(ride.status), color: '#fff', fontWeight: 700 }} />
                  </Stack>

                  <Typography variant="body2" sx={{ mb: 0.75 }}>
                    {t('rideHistory.pickup')}: {ride.pickup?.address || (ride.pickup?.lat ? `${ride.pickup.lat.toFixed(5)}, ${ride.pickup.lng.toFixed(5)}` : t('common.na'))}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('rideHistory.dropoff')}: {ride.dropoff?.address || (ride.dropoff?.lat ? `${ride.dropoff.lat.toFixed(5)}, ${ride.dropoff.lng.toFixed(5)}` : t('common.na'))}
                  </Typography>

                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" fontWeight={800}>
                      {ride.fare ? formatCurrency(ride.fare) : t('common.na')}
                    </Typography>
                    <Button size="small" onClick={() => navigate(`/ride/${ride.id}`)}>
                      {t('rideHistory.viewRide')}
                    </Button>
                  </Stack>

                  {ride.status === 'CANCELLED' &&
                    ONLINE_METHODS.has(ride.paymentMethod) &&
                    paymentMap.get(ride.id) && (
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