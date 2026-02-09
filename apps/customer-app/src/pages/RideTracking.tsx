import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Avatar,
  IconButton,
  Slide,
  LinearProgress,
  Skeleton,
} from '@mui/material';
import {
  ArrowBack,
  Phone,
  Chat,
  Cancel,
  MyLocation,
  FiberManualRecord,
  NavigateNext,
  StarRate,
  DirectionsCar,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { rideApi } from '../api/ride.api';
import { clearRide, setCurrentRide } from '../store/ride.slice';
import MapView from '../components/map/MapView';
import PickupMarker from '../components/map/PickupMarker';
import DropoffMarker from '../components/map/DropoffMarker';
import DriverMarker from '../components/map/DriverMarker';
import RouteLine from '../components/map/RouteLine';
import {
  formatCurrency,
  getRideStatusColor,
  getVehicleTypeLabel,
  getPaymentMethodLabel,
} from '../utils/format.utils';
import { useTranslation } from 'react-i18next';
import { RideStatus } from '../types';

// ── Status configuration ────────────────────────────────────────
const STATUS_CONFIG: Record<string, {
  label: string;
  description: string;
  color: string;
  showCancel: boolean;
  showDriverInfo: boolean;
  showRoute: boolean;
  pulseAnimation: boolean;
}> = {
  PENDING: {
    label: 'Searching for Driver',
    description: 'Looking for the nearest available driver...',
    color: '#FF9800',
    showCancel: true,
    showDriverInfo: false,
    showRoute: false,
    pulseAnimation: true,
  },
  ASSIGNED: {
    label: 'Driver Found!',
    description: 'A driver has been assigned to your ride',
    color: '#2196F3',
    showCancel: true,
    showDriverInfo: true,
    showRoute: true,
    pulseAnimation: false,
  },
  ACCEPTED: {
    label: 'Driver is Coming',
    description: 'Your driver is on the way to pick you up',
    color: '#2196F3',
    showCancel: true,
    showDriverInfo: true,
    showRoute: true,
    pulseAnimation: false,
  },
  IN_PROGRESS: {
    label: 'Trip in Progress',
    description: 'Enjoy your ride!',
    color: '#4CAF50',
    showCancel: false,
    showDriverInfo: true,
    showRoute: true,
    pulseAnimation: false,
  },
  COMPLETED: {
    label: 'Trip Completed',
    description: 'Thank you for riding with us!',
    color: '#4CAF50',
    showCancel: false,
    showDriverInfo: true,
    showRoute: false,
    pulseAnimation: false,
  },
  CANCELLED: {
    label: 'Ride Cancelled',
    description: 'This ride has been cancelled',
    color: '#F44336',
    showCancel: false,
    showDriverInfo: false,
    showRoute: false,
    pulseAnimation: false,
  },
  NO_DRIVER_AVAILABLE: {
    label: 'No Drivers Available',
    description: 'Sorry, no drivers are available right now. Please try again.',
    color: '#F44336',
    showCancel: false,
    showDriverInfo: false,
    showRoute: false,
    pulseAnimation: false,
  },
};

// ── Pulse animation keyframes (CSS-in-JS) ──────────────────────
const pulseKeyframes = `
@keyframes radar-pulse {
  0% { transform: scale(1); opacity: 0.8; }
  100% { transform: scale(3); opacity: 0; }
}
@keyframes searching-dot {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}
`;

const RideTracking: React.FC = () => {
  const { rideId } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const { currentRide, driver } = useAppSelector((state) => state.ride);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Poll for ride updates every 5 seconds
  useEffect(() => {
    if (!rideId) return;

    const fetchRide = async () => {
      try {
        const response = await rideApi.getRide(rideId);
        dispatch(setCurrentRide(response.data.ride));
      } catch (err: any) {
        if (!currentRide) {
          setError(err.response?.data?.error?.message || t('errors.loadRide'));
        }
      }
    };

    // Initial fetch only if we don't have the ride
    if (!currentRide || currentRide.id !== rideId) {
      setLoading(true);
      fetchRide().finally(() => setLoading(false));
    }

    // Poll for updates while ride is active
    const interval = setInterval(() => {
      if (currentRide?.status !== 'COMPLETED' && currentRide?.status !== 'CANCELLED') {
        fetchRide();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [dispatch, rideId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = useCallback(async () => {
    if (!currentRide) return;
    setCancelling(true);
    try {
      await rideApi.cancelRide(currentRide.id, 'Customer cancelled');
      dispatch(clearRide());
      navigate('/home');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('errors.cancelRide'));
    } finally {
      setCancelling(false);
      setShowCancelConfirm(false);
    }
  }, [currentRide, dispatch, navigate, t]);

  const status = currentRide?.status || 'PENDING';
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;

  const mapCenter = useMemo(() => {
    if (driver?.currentLocation) return driver.currentLocation;
    if (currentRide?.pickup) return currentRide.pickup;
    return { lat: 10.762622, lng: 106.660172 };
  }, [driver?.currentLocation, currentRide?.pickup]);

  // ── Loading state ─────────────────────────────────────────────
  if (loading && !currentRide) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 2 }}>
          <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
          <Skeleton variant="text" sx={{ mt: 2, fontSize: 28 }} />
          <Skeleton variant="text" sx={{ fontSize: 16 }} />
          <Skeleton variant="rectangular" height={100} sx={{ mt: 2, borderRadius: 2 }} />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#f5f5f5' }}>
      {/* Inject animation keyframes */}
      <style>{pulseKeyframes}</style>

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <Box sx={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1100,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 100%)',
        p: 1, pt: 2,
      }}>
        <IconButton
          onClick={() => {
            if (status === 'COMPLETED' || status === 'CANCELLED' || status === 'NO_DRIVER_AVAILABLE') {
              dispatch(clearRide());
              navigate('/home');
            }
          }}
          sx={{ bgcolor: 'white', boxShadow: 2, '&:hover': { bgcolor: 'grey.100' } }}
          disabled={status !== 'COMPLETED' && status !== 'CANCELLED' && status !== 'NO_DRIVER_AVAILABLE'}
        >
          <ArrowBack />
        </IconButton>
      </Box>

      {/* ── Map (full screen background) ────────────────────────── */}
      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        <MapView center={mapCenter} height="100%">
          {currentRide?.pickup && <PickupMarker location={currentRide.pickup} />}
          {currentRide?.dropoff && <DropoffMarker location={currentRide.dropoff} />}
          {driver?.currentLocation && <DriverMarker driver={driver} />}

          {/* Route: driver → pickup (when en route) */}
          {statusCfg.showRoute && driver?.currentLocation && currentRide?.pickup &&
            (status === 'ASSIGNED' || status === 'ACCEPTED') && (
            <RouteLine from={driver.currentLocation} to={currentRide.pickup} color="#2196F3" />
          )}
          {/* Route: driver → dropoff (during trip) */}
          {statusCfg.showRoute && driver?.currentLocation && currentRide?.dropoff &&
            status === 'IN_PROGRESS' && (
            <RouteLine from={driver.currentLocation} to={currentRide.dropoff} color="#4CAF50" />
          )}
        </MapView>

        {/* ── Radar pulse animation while searching ──────────────── */}
        {statusCfg.pulseAnimation && currentRide?.pickup && (
          <Box sx={{
            position: 'absolute', top: '40%', left: '50%',
            transform: 'translate(-50%, -50%)', zIndex: 1000,
            pointerEvents: 'none',
          }}>
            <Box sx={{
              width: 60, height: 60, borderRadius: '50%',
              bgcolor: 'primary.main', opacity: 0.3,
              animation: 'radar-pulse 2s infinite',
            }} />
          </Box>
        )}

        {/* ── Error alert ─────────────────────────────────────────── */}
        {error && (
          <Alert
            severity="error"
            onClose={() => setError('')}
            action={
              <Button color="inherit" size="small" onClick={() => window.location.reload()}>
                Retry
              </Button>
            }
            sx={{ position: 'absolute', top: 60, left: 16, right: 16, zIndex: 1100 }}
          >
            {error}
          </Alert>
        )}
      </Box>

      {/* ── Bottom sheet ─────────────────────────────────────────── */}
      <Slide direction="up" in mountOnEnter>
        <Card sx={{
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
          maxHeight: '55vh',
          overflow: 'auto',
        }}>
          {/* Drag handle */}
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, pb: 0.5 }}>
            <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'grey.300' }} />
          </Box>

          <CardContent sx={{ pt: 1 }}>
            {/* ── Status header ───────────────────────────────────── */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              {statusCfg.pulseAnimation ? (
                /* Animated searching dots */
                <Box sx={{ display: 'flex', gap: 0.5, px: 1 }}>
                  {[0, 1, 2].map((i) => (
                    <Box key={i} sx={{
                      width: 10, height: 10, borderRadius: '50%',
                      bgcolor: statusCfg.color,
                      animation: `searching-dot 1.4s ${i * 0.16}s infinite both`,
                    }} />
                  ))}
                </Box>
              ) : (
                <FiberManualRecord sx={{ color: statusCfg.color, fontSize: 16 }} />
              )}
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" fontWeight={700} sx={{ color: statusCfg.color }}>
                  {statusCfg.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {statusCfg.description}
                </Typography>
              </Box>
            </Box>

            {/* ── Searching progress bar ──────────────────────────── */}
            {status === 'PENDING' && (
              <LinearProgress
                sx={{ mb: 2, borderRadius: 1, height: 6, bgcolor: '#FFE0B2',
                  '& .MuiLinearProgress-bar': { bgcolor: '#FF9800' } }}
              />
            )}

            {/* ── Driver info card ────────────────────────────────── */}
            {statusCfg.showDriverInfo && driver && (
              <Card variant="outlined" sx={{ mb: 2, borderRadius: 3 }}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar
                      sx={{ width: 56, height: 56, bgcolor: 'primary.main', fontSize: 24 }}
                    >
                      {driver.firstName?.[0]}{driver.lastName?.[0]}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {driver.firstName} {driver.lastName}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        <StarRate sx={{ color: '#FFC107', fontSize: 18 }} />
                        <Typography variant="body2" fontWeight={500}>
                          {driver.rating?.toFixed(1) || '0.0'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          ({driver.totalRides || 0} rides)
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        <DirectionsCar sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {driver.vehicleColor} {driver.vehicleMake} {driver.vehicleModel}
                        </Typography>
                      </Box>
                      {driver.licensePlate && (
                        <Chip
                          label={driver.licensePlate}
                          size="small"
                          variant="outlined"
                          sx={{ mt: 0.5, fontWeight: 700, letterSpacing: 1 }}
                        />
                      )}
                    </Box>

                    {/* Call button */}
                    {driver.phoneNumber && (
                      <IconButton
                        color="primary"
                        href={`tel:${driver.phoneNumber}`}
                        sx={{ bgcolor: 'primary.50', '&:hover': { bgcolor: 'primary.100' } }}
                      >
                        <Phone />
                      </IconButton>
                    )}
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* ── Pickup / Dropoff ────────────────────────────────── */}
            {currentRide && (
              <Box sx={{ mb: 2 }}>
                {/* Pickup */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Box sx={{
                    width: 12, height: 12, borderRadius: '50%', mt: 0.8,
                    bgcolor: '#4CAF50', border: '2px solid white',
                    boxShadow: '0 0 0 2px #4CAF50',
                  }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary">PICKUP</Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {currentRide.pickup?.address || 'Pickup location'}
                    </Typography>
                  </Box>
                </Box>

                {/* Connecting line */}
                <Box sx={{
                  width: 2, height: 24, bgcolor: 'grey.300',
                  ml: '5px', my: 0.5,
                }} />

                {/* Dropoff */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Box sx={{
                    width: 12, height: 12, borderRadius: 1, mt: 0.8,
                    bgcolor: '#F44336', border: '2px solid white',
                    boxShadow: '0 0 0 2px #F44336',
                  }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary">DROPOFF</Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {currentRide.dropoff?.address || 'Dropoff location'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}

            <Divider sx={{ my: 1.5 }} />

            {/* ── Fare & ride info ────────────────────────────────── */}
            {currentRide && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {currentRide.vehicleType && getVehicleTypeLabel(currentRide.vehicleType)}
                    {currentRide.paymentMethod && ` • ${getPaymentMethodLabel(currentRide.paymentMethod)}`}
                  </Typography>
                </Box>
                <Typography variant="h5" fontWeight={700} color="primary.main">
                  {currentRide.fare ? formatCurrency(currentRide.fare) : '---'}
                </Typography>
              </Box>
            )}

            {/* ── Action buttons ──────────────────────────────────── */}
            {statusCfg.showCancel && (
              <>
                {showCancelConfirm ? (
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Button
                      fullWidth variant="outlined" size="large"
                      onClick={() => setShowCancelConfirm(false)}
                      sx={{ borderRadius: 3, py: 1.5 }}
                    >
                      Keep Ride
                    </Button>
                    <Button
                      fullWidth variant="contained" color="error" size="large"
                      onClick={handleCancel}
                      disabled={cancelling}
                      sx={{ borderRadius: 3, py: 1.5 }}
                    >
                      {cancelling ? <CircularProgress size={22} color="inherit" /> : 'Yes, Cancel'}
                    </Button>
                  </Box>
                ) : (
                  <Button
                    fullWidth variant="outlined" color="error" size="large"
                    startIcon={<Cancel />}
                    onClick={() => setShowCancelConfirm(true)}
                    sx={{ borderRadius: 3, py: 1.5 }}
                  >
                    Cancel Ride
                  </Button>
                )}
              </>
            )}

            {/* Completed / cancelled → go home */}
            {(status === 'COMPLETED' || status === 'CANCELLED' || status === 'NO_DRIVER_AVAILABLE') && (
              <Button
                fullWidth variant="contained" size="large"
                onClick={() => { dispatch(clearRide()); navigate('/home'); }}
                sx={{ borderRadius: 3, py: 1.5 }}
              >
                {status === 'COMPLETED' ? 'Rate & Go Home' : 'Back to Home'}
              </Button>
            )}
          </CardContent>
        </Card>
      </Slide>
    </Box>
  );
};

export default RideTracking;
