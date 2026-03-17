import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Box,
  Alert,
  Button,
  Chip,
  FormControlLabel,
  Grid,
  Paper,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import {
  AttachMoneyRounded,
  DriveEtaRounded,
  LocalFireDepartmentRounded,
  MyLocationRounded,
  RouteRounded,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setProfile,
  setOnlineStatus,
  setCurrentLocation,
} from '../store/driver.slice';
import { clearPendingRide, setCurrentRide } from '../store/ride.slice';
import RideRequestModal from '../components/ride-request/RideRequestModal';
import { driverApi } from '../api/driver.api';
import { rideApi } from '../api/ride.api';
import { driverSocketService } from '../socket/driver.socket';
import { watchPosition, clearWatch } from '../utils/map.utils';
import { formatCurrency } from '../utils/format.utils';
import DriverTripMap from '../features/trip/components/DriverTripMap';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const { user, accessToken } = useAppSelector((state) => state.auth);
  const { profile, isOnline, currentLocation, earnings } = useAppSelector(
    (state) => state.driver
  );
  const { pendingRide, timeoutSeconds } = useAppSelector(
    (state) => state.ride
  );

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);

  // Fetch driver profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await driverApi.getProfile();
        dispatch(setProfile(response.data.driver));

        // Fetch earnings
        await driverApi.getEarnings();
      } catch (error: any) {
        console.error('Failed to fetch profile:', error);
        if (error.response?.status === 404) {
          // Driver profile not set up
          navigate('/profile-setup');
        }
      }
    };

    fetchProfile();
  }, [dispatch, navigate]);

  // Connect socket when online
  useEffect(() => {
    if (isOnline && accessToken) {
      driverSocketService.connect(accessToken);
    } else {
      driverSocketService.disconnect();
    }

    return () => {
      driverSocketService.disconnect();
    };
  }, [isOnline, accessToken]);

  // Watch location when online
  useEffect(() => {
    if (isOnline && !watchId) {
      const id = watchPosition(
        (location) => {
          dispatch(setCurrentLocation(location));
          // Send location to server via socket
          driverSocketService.updateLocation(location);
          // Also update via API
          driverApi.updateLocation(location).catch(console.error);
        },
        (error) => {
          console.error('Location error:', error);
          setError(t('dashboard.gpsError'));
        }
      );
      setWatchId(id);
    }

    return () => {
      if (watchId) {
        clearWatch(watchId);
        setWatchId(null);
      }
    };
  }, [dispatch, isOnline, t, watchId]);

  // Check for active ride on mount
  useEffect(() => {
    const checkActiveRide = async () => {
      try {
        const response = await rideApi.getActiveRide();
        if (response?.data?.ride) {
          dispatch(setCurrentRide(response.data.ride));
          navigate('/active-ride');
        }
      } catch (error) {
        console.error('Failed to check active ride:', error);
      }
    };

    checkActiveRide();
  }, [dispatch, navigate]);

  // Handle go online/offline
  const handleToggleOnline = async () => {
    setLoading(true);
    setError('');
    try {
      if (isOnline) {
        await driverApi.goOffline();
        dispatch(setOnlineStatus(false));
      } else {
        await driverApi.goOnline();
        dispatch(setOnlineStatus(true));
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || t('dashboard.statusChangeFailed');
      setError(errorMessage);
      
      // Check if error is due to approval status
      if (errorMessage.includes('approved') || errorMessage.includes('PENDING')) {
        setError(t('dashboard.needApproval'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle accept ride
  const handleAcceptRide = async () => {
    if (!pendingRide) return;

    setLoading(true);
    try {
      const response = await rideApi.acceptRide(pendingRide.id);
      dispatch(setCurrentRide(response.data.ride));
      dispatch(clearPendingRide());
      navigate('/active-ride');
    } catch (error: any) {
      setError(error.response?.data?.error?.message || t('dashboard.acceptRideFailed'));
      dispatch(clearPendingRide());
    } finally {
      setLoading(false);
    }
  };

  // Handle reject ride
  const handleRejectRide = async () => {
    if (!pendingRide) return;

    try {
      await rideApi.rejectRide(pendingRide.id);
      dispatch(clearPendingRide());
    } catch (error) {
      console.error('Failed to reject ride:', error);
      dispatch(clearPendingRide());
    }
  };

  // Handle logout
  return (
    <Box sx={{ height: '100%', display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 1.5, pb: 1.5 }}>
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 5,
          background: 'linear-gradient(135deg, rgba(14,165,233,0.10), rgba(37,99,235,0.18))',
          border: '1px solid rgba(59,130,246,0.12)',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
            {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary">
              {t('app.welcome', { name: user?.firstName || 'tài xế' })}
            </Typography>
            <Typography variant="h6" fontWeight={800}>
              {isOnline ? t('dashboard.readyToAccept') : t('dashboard.goOnlineHint')}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 2 }}>
          <Chip icon={<DriveEtaRounded />} label={isOnline ? t('dashboard.youOnline') : t('dashboard.youOffline')} color={isOnline ? 'success' : 'default'} />
          <Chip icon={<RouteRounded />} label={pendingRide ? t('dashboard.newRideRequest', 'Đang có yêu cầu mới') : t('dashboard.waitingRide', 'Đang chờ cuốc xe mới')} variant="outlined" />
          <Chip icon={<LocalFireDepartmentRounded />} label={t('dashboard.fastEta', 'Bản đồ và ETA cập nhật trực tiếp')} variant="outlined" />
        </Stack>
      </Paper>

      <Box sx={{ position: 'relative', minHeight: 0, borderRadius: 6, overflow: 'hidden', bgcolor: '#eff6ff', boxShadow: '0 18px 48px rgba(15,23,42,0.12)' }}>
        <DriverTripMap currentLocation={currentLocation} mode="request" height="100%" />
      </Box>

      <Paper
        elevation={8}
        sx={{
          borderRadius: 5,
          p: 2.25,
          backgroundColor: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(18px)',
          border: '1px solid rgba(148,163,184,0.14)',
        }}
      >
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>}

        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={4}>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}>
              <Typography variant="overline" color="text.secondary">{t('dashboard.status', 'Trạng thái')}</Typography>
              <Typography variant="subtitle2" fontWeight={800}>{isOnline ? t('dashboard.youOnline') : t('dashboard.youOffline')}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}>
              <Typography variant="overline" color="text.secondary">{t('dashboard.rating', 'Đánh giá')}</Typography>
              <Typography variant="subtitle2" fontWeight={800}>{(profile?.rating ?? 0).toFixed(1)} / 5</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}>
              <Typography variant="overline" color="text.secondary">{t('dashboard.todayEarnings')}</Typography>
              <Typography variant="subtitle2" fontWeight={800}>{formatCurrency(earnings?.today || 0)}</Typography>
            </Paper>
          </Grid>
        </Grid>

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
          {currentLocation && <Chip icon={<MyLocationRounded />} label={`${currentLocation.lat.toFixed(5)}, ${currentLocation.lng.toFixed(5)}`} size="small" variant="outlined" />}
          <Chip icon={<AttachMoneyRounded />} label={t('dashboard.ridesCompleted', { count: profile?.totalRides || 0 })} size="small" variant="outlined" />
        </Stack>

        <Grid container spacing={2} alignItems="center">
          <Grid item xs>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 0.5 }}>
              {t('dashboard.availabilityControl', 'Điều khiển trạng thái nhận cuốc')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isOnline ? t('dashboard.readyToAccept') : t('dashboard.goOnlineHint')}
            </Typography>
          </Grid>
          <Grid item>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(isOnline)}
                  onChange={handleToggleOnline}
                  disabled={loading}
                  color="success"
                />
              }
              label=""
            />
          </Grid>
        </Grid>

        {pendingRide && (
          <Button
            fullWidth
            variant="contained"
            sx={{ mt: 2, py: 1.5, borderRadius: 3.5, fontWeight: 800 }}
            onClick={handleAcceptRide}
            disabled={loading}
          >
            {t('dashboard.acceptRideNow', 'Nhận cuốc xe ngay')}
          </Button>
        )}
      </Paper>

      {/* Ride Request Modal */}
      {pendingRide && (
        <RideRequestModal
          ride={pendingRide}
          timeoutSeconds={timeoutSeconds}
          open={!!pendingRide}
          onAccept={handleAcceptRide}
          onReject={handleRejectRide}
          loading={loading}
        />
      )}
    </Box>
  );
};

export default Dashboard;
