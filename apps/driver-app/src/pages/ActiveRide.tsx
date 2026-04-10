import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
  Card,
  CardContent,
  Button,
  Chip,
  Alert,
  Avatar,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  Stack,
} from '@mui/material';
import {
  ArrowBack,
  Phone,
  Navigation,
  FiberManualRecord,
  PlayArrow,
  CheckCircle,
  Cancel,
  StarRate,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updateRideStatus, clearCurrentRide, setCurrentRide } from '../store/ride.slice';
import { setCurrentLocation } from '../store/driver.slice';
import { rideApi } from '../api/ride.api';
import { driverApi } from '../api/driver.api';
import { formatCurrency } from '../utils/format.utils';
import { useTranslation } from 'react-i18next';
import DriverTripMap from '../features/trip/components/DriverTripMap';
import { driverSocketService } from '../socket/driver.socket';
import { watchPosition, clearWatch } from '../utils/map.utils';

const getOptimisticCompletedRidesKey = (userId?: string) => `driver:completedRidesCount:${userId || 'anonymous'}`;

const PHASE_CONFIG: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
}> = {
  ACCEPTED: {
    label: 'Đang tới điểm đón',
    color: '#2196F3',
    bgColor: '#E3F2FD',
    icon: <Navigation sx={{ fontSize: 20 }} />,
  },
  PICKING_UP: {
    label: 'Đã tới điểm đón',
    color: '#0F766E',
    bgColor: '#CCFBF1',
    icon: <FiberManualRecord sx={{ fontSize: 16 }} />,
  },
  IN_PROGRESS: {
    label: 'Đang chở khách',
    color: '#4CAF50',
    bgColor: '#E8F5E9',
    icon: <PlayArrow sx={{ fontSize: 20 }} />,
  },
  COMPLETED: {
    label: 'Chuyến đi đã hoàn tất',
    color: '#4CAF50',
    bgColor: '#E8F5E9',
    icon: <CheckCircle sx={{ fontSize: 20 }} />,
  },
};

const ActiveRide: React.FC = () => {
  const loggedGeoErrorCodesRef = useRef<Set<number>>(new Set());
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const { user } = useAppSelector((state) => state.auth);
  const { accessToken } = useAppSelector((state) => state.auth);

  const { currentLocation, isOnline } = useAppSelector((state) => state.driver);
  const { currentRide } = useAppSelector((state) => state.ride);

  const [initializing, setInitializing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);

  useEffect(() => {
    if (isOnline && accessToken) {
      driverSocketService.connect(accessToken);
    } else {
      driverSocketService.disconnect();
    }

    return () => {
      driverSocketService.disconnect();
    };
  }, [accessToken, isOnline]);

  useEffect(() => {
    if (!isOnline || !currentRide || watchId) {
      return;
    }

    const id = watchPosition(
      (location) => {
        dispatch(setCurrentLocation(location));
        driverSocketService.updateLocation(location, currentRide.id);
        driverApi.updateLocation(location).catch(console.error);
      },
      (geoError) => {
        if (geoError?.code !== 1 && !loggedGeoErrorCodesRef.current.has(geoError?.code)) {
          loggedGeoErrorCodesRef.current.add(geoError.code);
          console.error('Location error:', geoError);
        }
        setError(t('dashboard.gpsError'));
      }
    );

    setWatchId(id);

    return () => {
      clearWatch(id);
      setWatchId(null);
    };
  }, [currentRide, dispatch, isOnline, t, watchId]);

  useEffect(() => {
    if (currentRide) {
      return;
    }

    let isMounted = true;

    const loadActiveRide = async () => {
      setInitializing(true);
      try {
        const response = await rideApi.getActiveRide();
        const activeRide = response.data.ride;

        if (!isMounted) {
          return;
        }

        if (activeRide) {
          dispatch(setCurrentRide(activeRide));
        }
      } catch (err: any) {
        if (!isMounted) {
          return;
        }

        setError(err.response?.data?.error?.message || t('activeRide.noActiveRide'));
      } finally {
        if (isMounted) {
          setInitializing(false);
        }
      }
    };

    void loadActiveRide();

    return () => {
      isMounted = false;
    };
  }, [currentRide, dispatch, t]);

  const handleStartRide = useCallback(async () => {
    if (!currentRide) return;
    setLoading(true);
    try {
      const response = await rideApi.startRide(currentRide.id);
      dispatch(updateRideStatus(response.data.ride.status));
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('errors.startRide'));
    } finally {
      setLoading(false);
    }
  }, [currentRide, dispatch, t]);

  const handlePickupRide = useCallback(async () => {
    if (!currentRide) return;
    setLoading(true);
    try {
      const response = await rideApi.pickupRide(currentRide.id);
      dispatch(updateRideStatus(response.data.ride.status));
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Không thể xác nhận đã tới điểm đón');
    } finally {
      setLoading(false);
    }
  }, [currentRide, dispatch, t]);

  const handleCompleteRide = useCallback(async () => {
    if (!currentRide) return;
    setLoading(true);
    try {
      await rideApi.completeRide(currentRide.id);
      const storageKey = getOptimisticCompletedRidesKey(user?.id);
      const currentCompletedRides = Number(sessionStorage.getItem(storageKey) || '0');
      sessionStorage.setItem(storageKey, String(currentCompletedRides + 1));
      dispatch(clearCurrentRide());
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('errors.completeRide'));
    } finally {
      setLoading(false);
    }
  }, [currentRide, dispatch, navigate, t, user?.id]);

  const handleCancelRide = useCallback(async () => {
    if (!currentRide) return;
    setLoading(true);
    try {
      await rideApi.cancelRide(currentRide.id, 'Tài xế hủy chuyến');
      dispatch(clearCurrentRide());
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('errors.cancelRide'));
    } finally {
      setLoading(false);
      setShowCancelDialog(false);
    }
  }, [currentRide, dispatch, navigate, t]);

  const mapCenter = useMemo(() => {
    return currentLocation || currentRide?.pickupLocation || { lat: 10.762622, lng: 106.660172 };
  }, [currentLocation, currentRide?.pickupLocation]);

  if (initializing && !currentRide) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 2 }}>
        <CircularProgress />
        <Typography color="text.secondary">{t('common.loading', 'Đang tải...')}</Typography>
      </Box>
    );
  }

  if (!currentRide) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 2 }}>
        <Typography color="text.secondary">{t('activeRide.noActiveRide')}</Typography>
        <Button variant="contained" onClick={() => navigate('/dashboard')}>
          {t('common.backToDashboard', 'Quay về bảng điều khiển')}
        </Button>
      </Box>
    );
  }

  const status = currentRide.status;
  const phase = PHASE_CONFIG[status] || PHASE_CONFIG.ACCEPTED;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#f5f5f5' }}>
      <Box sx={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1100,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, transparent 100%)',
        p: 1, pt: 2,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <IconButton
          onClick={() => navigate('/dashboard')}
          sx={{ bgcolor: 'white', boxShadow: 2, '&:hover': { bgcolor: 'grey.100' } }}
        >
          <ArrowBack />
        </IconButton>

        {/* Phase pill */}
        <Chip
          icon={phase.icon as React.ReactElement}
          label={phase.label}
          sx={{
            bgcolor: phase.bgColor, color: phase.color,
            fontWeight: 700, fontSize: 14,
            '& .MuiChip-icon': { color: phase.color },
          }}
        />
      </Box>

      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        <DriverTripMap
          currentLocation={mapCenter}
          pickupLocation={currentRide.pickupLocation}
          dropoffLocation={currentRide.dropoffLocation}
          mode={status === 'IN_PROGRESS' ? 'trip' : 'pickup'}
          height="100%"
          colorMode="light"
        />

        {error && (
          <Alert
            severity="error"
            onClose={() => setError('')}
            sx={{ position: 'absolute', top: 60, left: 16, right: 16, zIndex: 1100 }}
          >
            {error}
          </Alert>
        )}
      </Box>

      <Card sx={{
        borderRadius: '20px 20px 0 0',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
        maxHeight: '40vh',
        overflow: 'auto',
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, pb: 0.5 }}>
          <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'grey.300' }} />
        </Box>

        <CardContent sx={{ pt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Avatar sx={{ width: 50, height: 50, bgcolor: 'primary.main', fontSize: 20 }}>
              {currentRide.customer?.firstName?.[0]}{currentRide.customer?.lastName?.[0]}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                {currentRide.customer?.firstName} {currentRide.customer?.lastName}
              </Typography>
              {currentRide.customer?.rating && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <StarRate sx={{ color: '#FFC107', fontSize: 16 }} />
                  <Typography variant="body2" color="text.secondary">
                    {currentRide.customer.rating.toFixed(1)}
                  </Typography>
                </Box>
              )}
            </Box>

            {currentRide.customer?.phoneNumber && (
              <IconButton color="primary" href={`tel:${currentRide.customer.phoneNumber}`} sx={{ bgcolor: 'primary.50', '&:hover': { bgcolor: 'primary.100' } }}>
                <Phone />
              </IconButton>
            )}
          </Box>

          <Stack spacing={1} sx={{ mb: 2 }}>
            <Typography variant="body2"><strong>Điểm đón:</strong> {currentRide.pickupLocation?.address || `${currentRide.pickupLocation.lat.toFixed(5)}, ${currentRide.pickupLocation.lng.toFixed(5)}`}</Typography>
            <Typography variant="body2"><strong>Điểm đến:</strong> {currentRide.dropoffLocation?.address || `${currentRide.dropoffLocation.lat.toFixed(5)}, ${currentRide.dropoffLocation.lng.toFixed(5)}`}</Typography>
          </Stack>

          <Divider sx={{ my: 1.5 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {t('activeRide.fare')}
            </Typography>
            <Typography variant="h5" fontWeight={700} color="success.main">
              {currentRide.fare ? formatCurrency(currentRide.fare) : 'Chưa có'}
            </Typography>
          </Box>

          {(status === 'ASSIGNED' || status === 'ACCEPTED') && (
            <Button
              fullWidth variant="contained" size="large"
              onClick={handlePickupRide}
              disabled={loading}
              data-testid="pickup-ride-button"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <FiberManualRecord />}
              sx={{ borderRadius: 3, py: 1.8, fontSize: 16, fontWeight: 700, bgcolor: '#0f766e', '&:hover': { bgcolor: '#115e59' } }}
            >
              {t('activeRide.arrivedPickup', 'Đã tới điểm đón')}
            </Button>
          )}

          {status === 'PICKING_UP' && (
            <Button
              fullWidth variant="contained" size="large"
              onClick={handleStartRide}
              disabled={loading}
              data-testid="start-ride-button"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Navigation />}
              sx={{ borderRadius: 3, py: 1.8, fontSize: 16, fontWeight: 700, bgcolor: '#2196F3', '&:hover': { bgcolor: '#1976D2' } }}
            >
              {t('activeRide.startRide', 'Đón khách và bắt đầu chuyến đi')}
            </Button>
          )}

          {status === 'IN_PROGRESS' && (
            <Button
              fullWidth variant="contained" color="success" size="large"
              onClick={handleCompleteRide}
              disabled={loading}
              data-testid="complete-ride-button"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CheckCircle />}
              sx={{ borderRadius: 3, py: 1.8, fontSize: 16, fontWeight: 700 }}
            >
              {t('activeRide.completeRide', 'Complete Ride')}
            </Button>
          )}

          {status !== 'IN_PROGRESS' && status !== 'COMPLETED' && (
            <Button
              fullWidth variant="outlined" color="error" size="small"
              onClick={() => setShowCancelDialog(true)}
              startIcon={<Cancel />}
              data-testid="cancel-ride-button"
              sx={{ borderRadius: 3, mt: 1, py: 1 }}
            >
              {t('activeRide.cancelRide')}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ── Cancel confirmation dialog ────────────────────────────── */}
      <Dialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {t('activeRide.confirmCancelTitle', 'Hủy chuyến đi này?')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('activeRide.confirmCancelMessage', 'Bạn có chắc muốn hủy chuyến? Thao tác này có thể ảnh hưởng đến tỷ lệ nhận chuyến của bạn.')}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button
            onClick={() => setShowCancelDialog(false)}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            {t('common.no', 'Tiếp tục chuyến này')}
          </Button>
          <Button
            onClick={handleCancelRide}
            color="error"
            variant="contained"
            disabled={loading}
            data-testid="confirm-cancel-ride-button"
            sx={{ borderRadius: 2 }}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : t('common.yes', 'Xác nhận hủy chuyến')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ActiveRide;
