import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  MyLocationRounded,
  RouteRounded,
  AccessTimeRounded,
  LocationOnRounded,
  FlagRounded,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setProfile,
  setOnlineStatus,
  setCurrentLocation,
  setEarnings,
} from '../store/driver.slice';
import { clearPendingRide, setCurrentRide } from '../store/ride.slice';
import { driverApi } from '../api/driver.api';
import { rideApi } from '../api/ride.api';
import { driverSocketService } from '../socket/driver.socket';
import { watchPosition, clearWatch, formatDistance, formatDuration } from '../utils/map.utils';
import { formatCurrency } from '../utils/format.utils';
import DriverTripMap from '../features/trip/components/DriverTripMap';
import { Ride } from '../types';

const getOptimisticCompletedRidesKey = (userId?: string) => `driver:completedRidesCount:${userId || 'anonymous'}`;

const hasSameRideList = (left: Ride[], right: Ride[]) => {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((ride, index) => {
    const other = right[index];
    if (!other) {
      return false;
    }

    return (
      ride.id === other.id
      && ride.status === other.status
      && ride.driverId === other.driverId
      && (ride.fare || 0) === (other.fare || 0)
      && (ride.distance || 0) === (other.distance || 0)
      && (ride.duration || ride.estimatedDuration || 0) === (other.duration || other.estimatedDuration || 0)
    );
  });
};

const Dashboard: React.FC = () => {
  const ignoredRideIdsRef = useRef<Map<string, number>>(new Map());
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const { user, accessToken } = useAppSelector((state) => state.auth);
  const { profile, isOnline, currentLocation, earnings } = useAppSelector(
    (state) => state.driver
  );
  const { pendingRide, currentRide } = useAppSelector(
    (state) => state.ride
  );

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [completedRidesCount, setCompletedRidesCount] = useState(0);
  const [availableRides, setAvailableRides] = useState<Ride[]>([]);
  const [isListLoading, setIsListLoading] = useState(false);
  const hasInitialPollRef = useRef(false);

  const dismissPendingRide = (rideId: string) => {
    const holdUntil = Date.now() + 30_000;
    ignoredRideIdsRef.current.set(rideId, holdUntil);
    dispatch(clearPendingRide());
  };

  const browsingLocation = currentLocation || profile?.currentLocation || null;
  const ridesToDisplay = useMemo(() => {
    const merged = new Map<string, Ride>();

    if (pendingRide && !ignoredRideIdsRef.current.has(pendingRide.id)) {
      merged.set(pendingRide.id, pendingRide);
    }

    availableRides.forEach((ride) => {
      if (!ignoredRideIdsRef.current.has(ride.id)) {
        merged.set(ride.id, ride);
      }
    });

    return Array.from(merged.values()).slice(0, 8);
  }, [availableRides, pendingRide]);

  // Fetch driver profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const [profileResponse, earningsResponse] = await Promise.all([
          driverApi.getProfile(),
          driverApi.getEarnings(),
        ]);

        dispatch(setProfile(profileResponse.data.driver));
        dispatch(setEarnings(earningsResponse.data.earnings));

        const remoteCompletedRides = Math.max(
          earningsResponse.data.earnings?.totalRides ?? 0,
          profileResponse.data.driver?.totalRides ?? 0
        );
        const storageKey = getOptimisticCompletedRidesKey(user?.id);
        const optimisticCompletedRides = Number(sessionStorage.getItem(storageKey) || '0');
        const resolvedCompletedRides = Math.max(remoteCompletedRides, optimisticCompletedRides);

        sessionStorage.setItem(storageKey, String(resolvedCompletedRides));
        setCompletedRidesCount(resolvedCompletedRides);
      } catch (error: any) {
        console.error('Failed to fetch profile:', error);
        if (error.response?.status === 404) {
          // Driver profile not set up
          navigate('/profile-setup');
        }
      }
    };

    fetchProfile();
  }, [dispatch, navigate, user?.id]);

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

  // Fallback polling for available rides when realtime delivery is delayed.
  useEffect(() => {
    if (!isOnline || currentRide) {
      setAvailableRides([]);
      setIsListLoading(false);
      hasInitialPollRef.current = false;
      return;
    }

    if (!browsingLocation) {
      return;
    }

    let cancelled = false;

    const pollAvailableRides = async () => {
      try {
        if (!hasInitialPollRef.current) {
          setIsListLoading(true);
        }

        const now = Date.now();
        ignoredRideIdsRef.current.forEach((expiresAt, ignoredRideId) => {
          if (expiresAt <= now) {
            ignoredRideIdsRef.current.delete(ignoredRideId);
          }
        });

        const response = await rideApi.getAvailableRides({
          lat: browsingLocation.lat,
          lng: browsingLocation.lng,
          radius: 8,
        });

        const rides = (response.data?.rides || []).filter(
          (ride) => !ignoredRideIdsRef.current.has(ride.id)
        );

        if (!cancelled) {
          setAvailableRides((previousRides) => (hasSameRideList(previousRides, rides) ? previousRides : rides));
          hasInitialPollRef.current = true;
        }
      } catch (pollError) {
        console.error('Failed to poll available rides:', pollError);
      } finally {
        if (!cancelled && !hasInitialPollRef.current) {
          setIsListLoading(false);
        }
      }
    };

    pollAvailableRides();
    const intervalId = window.setInterval(pollAvailableRides, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [browsingLocation, currentRide, isOnline]);

  // Handle go online/offline
  const handleToggleOnline = async () => {
    setLoading(true);
    setError('');
    try {
      if (isOnline) {
        const response = await driverApi.goOffline();
        dispatch(setProfile(response.data.driver));
        dispatch(setOnlineStatus(false));
      } else {
        const response = await driverApi.goOnline();
        dispatch(setProfile(response.data.driver));
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

  const handleAcceptSpecificRide = async (rideId: string) => {
    setLoading(true);
    ignoredRideIdsRef.current.delete(rideId);
    try {
      const response = await rideApi.acceptRide(rideId);
      dispatch(setCurrentRide(response.data.ride));
      dispatch(clearPendingRide());
      navigate('/active-ride');
    } catch (acceptError: any) {
      setError(acceptError.response?.data?.error?.message || t('dashboard.acceptRideFailed'));
    } finally {
      setLoading(false);
    }
  };

  // Handle logout
  return (
    <Box
      sx={{
        minHeight: '100%',
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        gap: 1.5,
        pb: 1.5,
        background: 'radial-gradient(circle at top left, rgba(56,189,248,0.12), transparent 28%), linear-gradient(180deg, #f8fbff 0%, #eef6ff 100%)',
      }}
    >
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
              {t('dashboard.welcome', { name: user?.firstName || 'tài xế' })}
            </Typography>
            <Typography variant="h6" fontWeight={800}>
              {isOnline ? t('dashboard.readyToAccept') : t('dashboard.goOnlineHint')}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 2 }}>
          <Chip icon={<DriveEtaRounded />} label={isOnline ? t('dashboard.youOnline') : t('dashboard.youOffline')} color={isOnline ? 'success' : 'default'} />
          <Chip icon={<RouteRounded />} label={pendingRide ? t('dashboard.newRideRequest', 'Đang có yêu cầu mới') : t('dashboard.ridesCompleted', { count: completedRidesCount })} variant="outlined" />
        </Stack>
      </Paper>

      <Box sx={{ position: 'relative', minHeight: 0, borderRadius: 6, overflow: 'hidden', background: 'linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%)', boxShadow: '0 18px 48px rgba(15,23,42,0.12)', border: '1px solid rgba(59,130,246,0.12)' }}>
        <DriverTripMap currentLocation={currentLocation} mode="request" height="100%" colorMode="light" />
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
              <Typography variant="subtitle2" fontWeight={800}>
                {(profile?.reviewCount ?? 0) > 0 ? `${(profile?.rating ?? 0).toFixed(1)} / 5` : t('profile.noReviews')}
              </Typography>
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
          {browsingLocation && <Chip icon={<MyLocationRounded />} label={`${browsingLocation.lat.toFixed(5)}, ${browsingLocation.lng.toFixed(5)}`} size="small" variant="outlined" />}
          <Chip icon={<AttachMoneyRounded />} label={t('dashboard.ridesCompleted', { count: completedRidesCount })} size="small" variant="outlined" />
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
                  inputProps={{ 'data-testid': 'driver-online-toggle' } as any}
                />
              }
              label=""
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 2.5 }}>
          <Typography variant="h6" fontWeight={800} sx={{ mb: 0.5 }}>
            Danh sách cuốc đang chờ nhận
          </Typography>

          {!isOnline && (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Bật trạng thái trực tuyến để xem các cuốc xe đang chờ nhận.
            </Alert>
          )}

          {isOnline && !browsingLocation && (
            <Alert severity="warning" sx={{ borderRadius: 2, mb: 1.5 }}>
              Chưa lấy được GPS hiện tại. Hệ thống sẽ dùng vị trí gần nhất đã lưu khi có dữ liệu để lọc cuốc xe quanh bạn.
            </Alert>
          )}

          {isOnline && !isListLoading && ridesToDisplay.length === 0 && (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Hiện chưa có cuốc xe phù hợp trong bán kính tìm kiếm.
            </Alert>
          )}

          {isOnline && ridesToDisplay.length > 0 && (
            <Stack spacing={1.2}>
              {ridesToDisplay.map((ride) => {
                const displayDuration = ride.duration || ride.estimatedDuration || 0;
                const displayDistance = ride.distance || 0;
                const isFreshOffer = pendingRide?.id === ride.id;

                return (
                  <Paper key={ride.id} variant="outlined" sx={{ p: 1.5, borderRadius: 3, borderColor: isFreshOffer ? 'success.main' : undefined, boxShadow: isFreshOffer ? '0 10px 28px rgba(22,163,74,0.12)' : undefined }}>
                    <Stack spacing={1}>
                      <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle2" fontWeight={800}>
                          Mã cuốc {ride.id.slice(0, 8).toUpperCase()}
                        </Typography>
                        {isFreshOffer && <Chip size="small" color="success" label="Cuốc mới" />}
                      </Stack>

                      <Stack direction="row" spacing={1} alignItems="center">
                        <LocationOnRounded color="success" fontSize="small" />
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>Điểm đón:</Typography>
                        <Typography variant="body2" sx={{ flex: 1 }} noWrap>
                          {ride.pickupLocation?.address || 'Đã có vị trí điểm đón'}
                        </Typography>
                      </Stack>

                      <Stack direction="row" spacing={1} alignItems="center">
                        <FlagRounded color="error" fontSize="small" />
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>Điểm đến:</Typography>
                        <Typography variant="body2" sx={{ flex: 1 }} noWrap>
                          {ride.dropoffLocation?.address || 'Đã có vị trí điểm đến'}
                        </Typography>
                      </Stack>

                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                        <Chip size="small" icon={<AttachMoneyRounded />} label={`Tiền: ${ride.fare ? formatCurrency(ride.fare) : 'N/A'}`} />
                        <Chip size="small" icon={<RouteRounded />} label={`Khoảng cách: ${displayDistance > 0 ? formatDistance(displayDistance) : 'N/A'}`} />
                        <Chip size="small" icon={<AccessTimeRounded />} label={`Di chuyển: ${displayDuration > 0 ? formatDuration(displayDuration) : 'N/A'}`} />
                      </Stack>

                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        {isFreshOffer && (
                          <Button
                            variant="text"
                            size="medium"
                            onClick={() => dismissPendingRide(ride.id)}
                            disabled={loading}
                            sx={{ borderRadius: 999, px: 2.5, fontWeight: 700 }}
                          >
                            Bỏ qua
                          </Button>
                        )}
                        <Button
                          variant="contained"
                          size="medium"
                          onClick={() => handleAcceptSpecificRide(ride.id)}
                          disabled={loading}
                          sx={{ alignSelf: 'flex-end', borderRadius: 999, px: 2.5, fontWeight: 700 }}
                        >
                          Nhận cuốc này
                        </Button>
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default Dashboard;
