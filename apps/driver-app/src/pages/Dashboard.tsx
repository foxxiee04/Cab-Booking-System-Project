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
import { clearPendingRide, setCurrentRide, clearCurrentRide, revokeRideFromFeed } from '../store/ride.slice';
import { driverApi } from '../api/driver.api';
import { rideApi } from '../api/ride.api';
import { driverSocketService } from '../socket/driver.socket';
import { watchPosition, clearWatch, calculateDistance, formatDistance, formatDuration, getDemoFallbackLocation } from '../utils/map.utils';
import { formatCurrency, getVehicleTypeLabel } from '../utils/format.utils';
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

const normalizeDistanceMeters = (distance?: number): number | undefined => {
  if (!distance || Number.isNaN(distance) || distance <= 0) {
    return undefined;
  }

  return distance > 100 ? distance : distance * 1000;
};

const normalizeDurationSeconds = (duration?: number, estimatedDuration?: number): number | undefined => {
  const raw = duration && duration > 0 ? duration : estimatedDuration && estimatedDuration > 0 ? estimatedDuration : undefined;
  if (!raw) {
    return undefined;
  }

  return raw <= 30 ? raw * 60 : raw;
};

const getRideMetrics = (ride: Ride) => {
  const distanceFromDriverMeters = typeof ride.distanceFromDriverMeters === 'number' && ride.distanceFromDriverMeters > 0
    ? ride.distanceFromDriverMeters
    : undefined;
  const durationFromDriverSeconds = typeof ride.durationFromDriverSeconds === 'number' && ride.durationFromDriverSeconds > 0
    ? ride.durationFromDriverSeconds
    : undefined;

  // Trip metrics (distance/duration of the ride itself, not driver→pickup ETA)
  const distanceMeters = normalizeDistanceMeters(ride.distance);
  const durationSeconds = normalizeDurationSeconds(ride.duration, ride.estimatedDuration);

  if (distanceFromDriverMeters || durationFromDriverSeconds) {
    // Return trip metrics so the duration chip shows trip time, not driver ETA time.
    // The ETA chip below uses distanceFromDriver / durationFromDriverSeconds directly.
    return { distanceMeters, durationSeconds };
  }

  if (distanceMeters && durationSeconds) {
    return { distanceMeters, durationSeconds };
  }

  if (ride.pickupLocation?.lat && ride.pickupLocation?.lng && ride.dropoffLocation?.lat && ride.dropoffLocation?.lng) {
    const directKm = calculateDistance(ride.pickupLocation, ride.dropoffLocation);
    const routedKm = Math.max(directKm * 1.22, 0.2);
    const estimatedDistanceMeters = Math.round(routedKm * 1000);
    const estimatedDurationSeconds = Math.max(180, Math.round((routedKm / 24) * 3600));

    return {
      distanceMeters: distanceMeters || estimatedDistanceMeters,
      durationSeconds: durationSeconds || estimatedDurationSeconds,
    };
  }

  return { distanceMeters, durationSeconds };
};

const Dashboard: React.FC = () => {
  const loggedGeoErrorCodesRef = useRef<Set<number>>(new Set());
  const ignoredRideIdsRef = useRef<Map<string, number>>(new Map());
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const { user } = useAppSelector((state) => state.auth);
  const { profile, isOnline, currentLocation, earnings } = useAppSelector(
    (state) => state.driver
  );
  const { pendingRide, currentRide, revokedFeedRideIds } = useAppSelector(
    (state) => state.ride
  );

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptingRideId, setAcceptingRideId] = useState<string | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [completedRidesCount, setCompletedRidesCount] = useState(0);
  const [availableRides, setAvailableRides] = useState<Ride[]>([]);
  const [isListLoading, setIsListLoading] = useState(false);
  const [showGpsWarning, setShowGpsWarning] = useState(true);
  const hasInitialPollRef = useRef(false);

  const dismissPendingRide = (rideId: string) => {
    const holdUntil = Date.now() + 30_000;
    ignoredRideIdsRef.current.set(rideId, holdUntil);
    dispatch(clearPendingRide());
    // Notify server so re-dispatch skips this driver immediately
    rideApi.declineOffer(rideId).catch(() => {});
  };

  const browsingLocation = currentLocation || profile?.currentLocation || null;

  useEffect(() => {
    if (browsingLocation) {
      setShowGpsWarning(false);
      return;
    }

    if (isOnline) {
      setShowGpsWarning(true);
    }
  }, [browsingLocation, isOnline]);

  const ridesToDisplay = useMemo(() => {
    const merged = new Map<string, Ride>();

    if (pendingRide && !ignoredRideIdsRef.current.has(pendingRide.id) && !revokedFeedRideIds.includes(pendingRide.id)) {
      merged.set(pendingRide.id, pendingRide);
    }

    availableRides.forEach((ride) => {
      if (!ignoredRideIdsRef.current.has(ride.id) && !revokedFeedRideIds.includes(ride.id)) {
        merged.set(ride.id, ride);
      }
    });

    return Array.from(merged.values()).slice(0, 8);
  }, [availableRides, pendingRide, revokedFeedRideIds]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }
  }, []);

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

  // Watch location when online
  useEffect(() => {
    if (isOnline && !watchId) {
      const fallback = getDemoFallbackLocation(user?.phoneNumber) ?? undefined;
      const id = watchPosition(
        (location) => {
          dispatch(setCurrentLocation(location));
          // Send location to server via socket
          driverSocketService.updateLocation(location);
          // Also update via API
          driverApi.updateLocation(location).catch(console.error);
        },
        (error) => {
          if (error?.code !== 1 && !loggedGeoErrorCodesRef.current.has(error?.code)) {
            loggedGeoErrorCodesRef.current.add(error.code);
            console.error('Location error:', error);
          }
          setError(t('dashboard.gpsError'));
        },
        fallback
      );
      setWatchId(id);
    }

    return () => {
      if (watchId) {
        clearWatch(watchId);
        setWatchId(null);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, isOnline, t, watchId]);

  // Check for active ride on mount
  useEffect(() => {
    let cancelled = false;
    const checkActiveRide = async () => {
      try {
        const response = await rideApi.getActiveRide();
        if (cancelled) return;
        if (response?.data?.ride) {
          dispatch(setCurrentRide(response.data.ride));
          navigate('/active-ride');
        } else {
          dispatch(clearCurrentRide());
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to check active ride:', error);
          dispatch(clearCurrentRide());
        }
      }
    };

    checkActiveRide();
    return () => { cancelled = true; };
  }, [dispatch, navigate, user?.id]);

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
          radius: 3,
          vehicleType: profile?.vehicleType,
        });

        const rides = (response.data?.rides || []).filter(
          (ride) =>
            !ignoredRideIdsRef.current.has(ride.id)
            && !revokedFeedRideIds.includes(ride.id)
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
    const intervalId = window.setInterval(pollAvailableRides, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [browsingLocation, currentRide, isOnline, profile?.vehicleType, revokedFeedRideIds]);

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
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptSpecificRide = async (rideId: string) => {
    setLoading(true);
    setAcceptingRideId(rideId);
    ignoredRideIdsRef.current.delete(rideId);
    try {
      const response = await rideApi.acceptRide(rideId);
      const acceptedRide = response.data.ride;
      // Guard: ensure we have location data before navigating
      if (!acceptedRide?.pickupLocation?.lat || !acceptedRide?.dropoffLocation?.lat) {
        // Fetch the full ride to get complete location data
        try {
          const fullRideRes = await rideApi.getRide(rideId);
          dispatch(setCurrentRide(fullRideRes.data.ride));
        } catch {
          dispatch(setCurrentRide(acceptedRide));
        }
      } else {
        dispatch(setCurrentRide(acceptedRide));
      }
      dispatch(clearPendingRide());
      navigate('/active-ride');
    } catch (acceptError: any) {
      const msg = acceptError.response?.data?.error?.message || t('dashboard.acceptRideFailed');
      setError(msg);
      // Remove the ride from list if it was already taken or expired
      if (acceptError.response?.status === 409 || acceptError.response?.status === 404) {
        dispatch(revokeRideFromFeed(rideId));
        setAvailableRides((prev) => prev.filter((r) => r.id !== rideId));
        dispatch(clearPendingRide());
      }
    } finally {
      setLoading(false);
      setAcceptingRideId(null);
    }
  };

  // Handle logout
  return (
    <Box
      sx={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
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

      <Box sx={{ position: 'relative', height: { xs: 300, sm: 360, md: 420 }, borderRadius: 6, overflow: 'hidden', background: (theme: any) => `linear-gradient(180deg, ${theme.palette.primary.light}33 0%, ${theme.palette.primary.light}66 100%)`, boxShadow: '0 18px 48px rgba(15,23,42,0.12)', border: '1px solid', borderColor: 'primary.100' }}>
        <DriverTripMap currentLocation={currentLocation || undefined} mode="request" height="100%" colorMode="light" />
      </Box>

      <Paper
        elevation={8}
        sx={{
          borderRadius: 5,
          p: 2.25,
          overflow: 'auto',
          backgroundColor: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(18px)',
          border: '1px solid rgba(148,163,184,0.14)',
        }}
      >
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>}

        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid item xs={4}>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary" display="block">Đánh giá</Typography>
              <Typography variant="subtitle2" fontWeight={800}>
                {(profile?.reviewCount ?? 0) > 0 ? `${(profile?.rating ?? 0).toFixed(1)} ★` : '—'}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={4}>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary" display="block">Chuyến</Typography>
              <Typography variant="subtitle2" fontWeight={800}>{completedRidesCount}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={4}>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary" display="block">Hôm nay</Typography>
              <Typography variant="subtitle2" fontWeight={800}>{formatCurrency(earnings?.today || 0)}</Typography>
            </Paper>
          </Grid>
        </Grid>

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
          <Chip icon={<AttachMoneyRounded />} label={`${completedRidesCount} chuyến hoàn tất`} size="small" variant="outlined" />
        </Stack>

        <Grid container spacing={2} alignItems="center" sx={{ mb: 1 }}>
          <Grid item xs>
            <Typography variant="subtitle1" fontWeight={800}>
              {isOnline ? 'Trực tuyến' : 'Ngoại tuyến'}
            </Typography>
            {profile?.status === 'PENDING' && (
              <Typography variant="caption" color="info.main">Cần admin duyệt hồ sơ trước</Typography>
            )}
            {profile?.status === 'REJECTED' && (
              <Typography variant="caption" color="error.main">Hồ sơ bị từ chối — không thể bật online</Typography>
            )}
            {profile?.status === 'SUSPENDED' && (
              <Typography variant="caption" color="text.secondary">Tài khoản bị tạm khóa</Typography>
            )}
          </Grid>
          <Grid item>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(isOnline)}
                  onChange={handleToggleOnline}
                  disabled={loading || profile?.status !== 'APPROVED'}
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

          {isOnline && !browsingLocation && showGpsWarning && (
            <Alert severity="warning" sx={{ borderRadius: 2, mb: 1.5 }} onClose={() => setShowGpsWarning(false)}>
              Chưa lấy được GPS hiện tại. Hệ thống sẽ dùng vị trí gần nhất đã lưu khi có dữ liệu để lọc cuốc xe quanh bạn.
            </Alert>
          )}

          {isOnline && !isListLoading && ridesToDisplay.length === 0 && (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Hiện chưa có cuốc xe phù hợp trong bán kính tìm kiếm.
            </Alert>
          )}

          {isOnline && ridesToDisplay.length > 0 && (
            <Stack spacing={1.5}>
              {ridesToDisplay.map((ride) => {
                const metrics = getRideMetrics(ride);
                const isFreshOffer = pendingRide?.id === ride.id;
                const rawVehicleType = (ride as any).requestedVehicleType || ride.vehicleType;
                const rideVehicleType = rawVehicleType ? getVehicleTypeLabel(rawVehicleType as any) : 'N/A';
                const paymentMethod = (ride as any).paymentMethod as string | undefined;
                const isCash = paymentMethod === 'CASH';

                // Commission rates must match backend: MOTORBIKE/SCOOTER 20%, CAR_4 18%, CAR_7 15%
                const commissionRates: Record<string, number> = {
                  MOTORBIKE: 0.20, SCOOTER: 0.20, CAR_4: 0.18, CAR_7: 0.15,
                };
                const commissionRate = commissionRates[rawVehicleType || ''] ?? 0.20;
                const netEarnings = ride.fare ? Math.round(ride.fare * (1 - commissionRate)) : null;

                // ETA to pickup
                const etaMins = ride.etaMinutes
                  ? Math.round(ride.etaMinutes)
                  : ride.durationFromDriverSeconds
                    ? Math.round(ride.durationFromDriverSeconds / 60)
                    : null;
                const distanceFromDriver = ride.distanceFromDriverMeters ?? null;

                const customerName = ride.customer
                  ? `${ride.customer.firstName || ''} ${ride.customer.lastName || ''}`.trim() || 'Khách hàng'
                  : null;
                const customerRating = ride.customer?.rating;

                return (
                  <Paper
                    key={ride.id}
                    variant="outlined"
                    sx={{
                      borderRadius: 3,
                      overflow: 'hidden',
                      borderColor: isFreshOffer ? 'success.main' : 'divider',
                      boxShadow: isFreshOffer ? '0 4px 20px rgba(22,163,74,0.15)' : '0 1px 4px rgba(0,0,0,0.06)',
                    }}
                  >
                    {/* Top bar: Fresh offer badge + payment method */}
                    {isFreshOffer && (
                      <Box sx={{ bgcolor: 'success.main', px: 2, py: 0.6 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Typography variant="caption" fontWeight={800} sx={{ color: '#fff', letterSpacing: 0.5 }}>
                            ⚡ YÊU CẦU MỚI — Phản hồi ngay!
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)' }}>
                            #{ride.id.slice(0, 6).toUpperCase()}
                          </Typography>
                        </Stack>
                      </Box>
                    )}

                    <Box sx={{ p: 1.5 }}>
                      <Stack spacing={1.2}>
                        {/* Row 1: Fare + Net earnings */}
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Stack direction="row" alignItems="baseline" spacing={0.8}>
                            <Typography variant="h6" fontWeight={900} color={isFreshOffer ? 'success.dark' : 'text.primary'}>
                              {ride.fare ? formatCurrency(ride.fare) : '—'}
                            </Typography>
                            {netEarnings && (
                              <Typography variant="caption" color="text.secondary">
                                → nhận ~{formatCurrency(netEarnings)} ({Math.round((1 - commissionRate) * 100)}%)
                              </Typography>
                            )}
                          </Stack>
                          <Stack direction="row" spacing={0.6} alignItems="center">
                            {/* Payment method badge */}
                            <Chip
                              size="small"
                              label={isCash ? '💵 Tiền mặt' : paymentMethod === 'MOMO' ? '🟣 MoMo' : paymentMethod === 'VNPAY' ? '🔵 VNPay' : paymentMethod || 'Online'}
                              sx={{
                                fontWeight: 700, fontSize: '0.68rem',
                                bgcolor: isCash ? '#fef3c7' : '#ede9fe',
                                color: isCash ? '#92400e' : '#5b21b6',
                              }}
                            />
                            {!isFreshOffer && (
                              <Typography variant="caption" color="text.disabled">#{ride.id.slice(0, 6).toUpperCase()}</Typography>
                            )}
                          </Stack>
                        </Stack>

                        {/* Row 2: Customer info */}
                        {customerName && (
                          <Stack direction="row" alignItems="center" spacing={0.8}>
                            <Avatar sx={{ width: 22, height: 22, fontSize: '0.65rem', bgcolor: 'primary.light' }}>
                              {customerName[0]?.toUpperCase()}
                            </Avatar>
                            <Typography variant="caption" fontWeight={700}>{customerName}</Typography>
                            {customerRating && customerRating > 0 && (
                              <Typography variant="caption" color="warning.main">★ {customerRating.toFixed(1)}</Typography>
                            )}
                          </Stack>
                        )}

                        {/* Row 3: Pickup */}
                        <Stack direction="row" spacing={1} alignItems="flex-start">
                          <LocationOnRounded sx={{ color: 'success.main', fontSize: 16, mt: 0.2, flexShrink: 0 }} />
                          <Box flex={1} minWidth={0}>
                            <Typography variant="caption" color="text.secondary" fontWeight={700}>Điểm đón</Typography>
                            <Typography variant="body2" sx={{ lineHeight: 1.3 }}>
                              {ride.pickupLocation?.address || 'Đang cập nhật địa chỉ...'}
                            </Typography>
                          </Box>
                        </Stack>

                        {/* Row 4: Dropoff */}
                        <Stack direction="row" spacing={1} alignItems="flex-start">
                          <FlagRounded sx={{ color: 'error.main', fontSize: 16, mt: 0.2, flexShrink: 0 }} />
                          <Box flex={1} minWidth={0}>
                            <Typography variant="caption" color="text.secondary" fontWeight={700}>Điểm đến</Typography>
                            <Typography variant="body2" sx={{ lineHeight: 1.3 }}>
                              {ride.dropoffLocation?.address || 'Đang cập nhật địa chỉ...'}
                            </Typography>
                          </Box>
                        </Stack>

                        {/* Row 5: Stats chips */}
                        <Stack direction="row" spacing={0.6} useFlexGap flexWrap="wrap">
                          {metrics.distanceMeters && (
                            <Chip size="small" icon={<RouteRounded sx={{ fontSize: '13px !important' }} />}
                              label={formatDistance(metrics.distanceMeters)} sx={{ fontSize: '0.7rem' }} />
                          )}
                          {metrics.durationSeconds && (
                            <Chip size="small" icon={<AccessTimeRounded sx={{ fontSize: '13px !important' }} />}
                              label={formatDuration(metrics.durationSeconds)} sx={{ fontSize: '0.7rem' }} />
                          )}
                          {(distanceFromDriver != null || etaMins != null) && (
                            <Chip size="small" icon={<LocationOnRounded sx={{ fontSize: '13px !important' }} />}
                              label={distanceFromDriver ? `Cách bạn ${formatDistance(distanceFromDriver)}${etaMins ? ` · ~${etaMins} phút đến đón` : ''}` : `Đến đón ~${etaMins} phút`}
                              color="info" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                          )}
                          <Chip size="small" label={rideVehicleType} sx={{ fontSize: '0.7rem' }} />
                        </Stack>

                        {/* Row 6: Actions */}
                        <Stack direction="row" spacing={1} pt={0.3}>
                          <Button
                            variant="outlined" size="small" color="inherit"
                            onClick={() => dismissPendingRide(ride.id)}
                            disabled={acceptingRideId === ride.id}
                            sx={{ borderRadius: 99, flex: 1, fontWeight: 700, fontSize: '0.8rem' }}
                          >
                            Bỏ qua
                          </Button>
                          <Button
                            variant="contained" size="small"
                            onClick={() => handleAcceptSpecificRide(ride.id)}
                            disabled={acceptingRideId !== null}
                            data-testid="accept-ride-button"
                            color={isFreshOffer ? 'success' : 'primary'}
                            sx={{ borderRadius: 99, flex: 2, fontWeight: 800, fontSize: '0.88rem' }}
                          >
                            {acceptingRideId === ride.id ? 'Đang xử lý...' : isFreshOffer ? '✓ Nhận ngay' : 'Nhận cuốc'}
                          </Button>
                        </Stack>
                      </Stack>
                    </Box>
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
