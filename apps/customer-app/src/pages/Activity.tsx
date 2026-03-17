import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  AccessTimeRounded,
  DirectionsCarFilledRounded,
  LocalAtmRounded,
  RouteRounded,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { rideApi } from '../api/ride.api';
import { Ride } from '../types';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setCurrentRide } from '../store/ride.slice';
import {
  formatCurrency,
  formatDate,
  getRideStatusColor,
  getRideStatusLabel,
  getVehicleTypeLabel,
} from '../utils/format.utils';

const Activity: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const currentRide = useAppSelector((state) => state.ride.currentRide);

  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'ongoing' | 'history'>('ongoing');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const [activeRideResponse, historyResponse] = await Promise.all([
          rideApi.getActiveRide(),
          rideApi.getRideHistory(1, 8),
        ]);

        if (activeRideResponse?.data?.ride) {
          dispatch(setCurrentRide(activeRideResponse.data.ride));
        }

        setRides(historyResponse.data.rides || []);
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
                    {currentRide.pickup.address || `${currentRide.pickup.lat}, ${currentRide.pickup.lng}`}
                  </Typography>
                  <Divider />
                  <Typography variant="body2" color="text.secondary">
                    {currentRide.dropoff.address || `${currentRide.dropoff.lat}, ${currentRide.dropoff.lng}`}
                  </Typography>

                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {currentRide.distance ? <Chip icon={<RouteRounded />} label={`${(currentRide.distance / 1000).toFixed(1)} km`} size="small" /> : null}
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
                    {t('rideHistory.pickup')}: {ride.pickup.address || `${ride.pickup.lat}, ${ride.pickup.lng}`}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('rideHistory.dropoff')}: {ride.dropoff.address || `${ride.dropoff.lat}, ${ride.dropoff.lng}`}
                  </Typography>

                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" fontWeight={800}>
                      {ride.fare ? formatCurrency(ride.fare) : t('common.na')}
                    </Typography>
                    <Button size="small" onClick={() => navigate(`/ride/${ride.id}`)}>
                      {t('rideHistory.viewRide')}
                    </Button>
                  </Stack>
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