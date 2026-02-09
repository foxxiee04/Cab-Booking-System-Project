import React, { useState, useCallback, useMemo } from 'react';
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
  Slide,
} from '@mui/material';
import {
  ArrowBack,
  Phone,
  Navigation,
  FiberManualRecord,
  PlayArrow,
  CheckCircle,
  Cancel,
  MyLocation,
  StarRate,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updateRideStatus, clearCurrentRide } from '../store/ride.slice';
import MapView from '../components/map/MapView';
import DriverMarker from '../components/map/DriverMarker';
import PickupMarker from '../components/map/PickupMarker';
import DropoffMarker from '../components/map/DropoffMarker';
import RouteLine from '../components/map/RouteLine';
import { rideApi } from '../api/ride.api';
import { formatCurrency } from '../utils/format.utils';
import { useTranslation } from 'react-i18next';
import { RideStatus } from '../types';

// ── Phase configuration ─────────────────────────────────────────
const PHASE_CONFIG: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
}> = {
  ACCEPTED: {
    label: 'Head to Pickup',
    color: '#2196F3',
    bgColor: '#E3F2FD',
    icon: <Navigation sx={{ fontSize: 20 }} />,
  },
  IN_PROGRESS: {
    label: 'Trip in Progress',
    color: '#4CAF50',
    bgColor: '#E8F5E9',
    icon: <PlayArrow sx={{ fontSize: 20 }} />,
  },
  COMPLETED: {
    label: 'Trip Completed',
    color: '#4CAF50',
    bgColor: '#E8F5E9',
    icon: <CheckCircle sx={{ fontSize: 20 }} />,
  },
};

const ActiveRide: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const { currentLocation } = useAppSelector((state) => state.driver);
  const { currentRide } = useAppSelector((state) => state.ride);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);

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

  const handleCompleteRide = useCallback(async () => {
    if (!currentRide) return;
    setLoading(true);
    try {
      await rideApi.completeRide(currentRide.id);
      dispatch(clearCurrentRide());
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('errors.completeRide'));
    } finally {
      setLoading(false);
    }
  }, [currentRide, dispatch, navigate, t]);

  const handleCancelRide = useCallback(async () => {
    if (!currentRide) return;
    setLoading(true);
    try {
      await rideApi.cancelRide(currentRide.id, 'Driver cancelled');
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

  if (!currentRide) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 2 }}>
        <Typography color="text.secondary">{t('activeRide.noActiveRide')}</Typography>
        <Button variant="contained" onClick={() => navigate('/dashboard')}>
          {t('common.backToDashboard', 'Back to Dashboard')}
        </Button>
      </Box>
    );
  }

  const status = currentRide.status;
  const phase = PHASE_CONFIG[status] || PHASE_CONFIG.ACCEPTED;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#f5f5f5' }}>
      {/* ── Floating back button ────────────────────────────────── */}
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

      {/* ── Full-screen map ─────────────────────────────────────── */}
      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        <MapView center={mapCenter} height="100%">
          {currentLocation && <DriverMarker location={currentLocation} />}
          <PickupMarker location={currentRide.pickupLocation} />
          <DropoffMarker location={currentRide.dropoffLocation} />

          {/* Route: driver → pickup (en route to pickup) */}
          {currentLocation && (status === 'ACCEPTED' || status === 'ASSIGNED') && (
            <RouteLine start={currentLocation} end={currentRide.pickupLocation} />
          )}
          {/* Route: driver → dropoff (trip in progress) */}
          {currentLocation && status === 'IN_PROGRESS' && (
            <RouteLine start={currentLocation} end={currentRide.dropoffLocation} />
          )}
        </MapView>

        {/* Error alert */}
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

      {/* ── Bottom sheet ─────────────────────────────────────────── */}
      <Slide direction="up" in mountOnEnter>
        <Card sx={{
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
          maxHeight: '45vh',
          overflow: 'auto',
        }}>
          {/* Drag handle */}
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, pb: 0.5 }}>
            <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'grey.300' }} />
          </Box>

          <CardContent sx={{ pt: 1 }}>
            {/* ── Customer info ───────────────────────────────────── */}
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

              {/* Call customer */}
              {currentRide.customer?.phoneNumber && (
                <IconButton
                  color="primary"
                  href={`tel:${currentRide.customer.phoneNumber}`}
                  sx={{ bgcolor: 'primary.50', '&:hover': { bgcolor: 'primary.100' } }}
                >
                  <Phone />
                </IconButton>
              )}
            </Box>

            {/* ── Pickup / Dropoff ────────────────────────────────── */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <Box sx={{
                  width: 12, height: 12, borderRadius: '50%', mt: 0.8,
                  bgcolor: '#4CAF50', border: '2px solid white',
                  boxShadow: '0 0 0 2px #4CAF50',
                }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">PICKUP</Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {currentRide.pickupLocation?.address || `${currentRide.pickupLocation.lat.toFixed(5)}, ${currentRide.pickupLocation.lng.toFixed(5)}`}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ width: 2, height: 20, bgcolor: 'grey.300', ml: '5px', my: 0.5 }} />

              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <Box sx={{
                  width: 12, height: 12, borderRadius: 1, mt: 0.8,
                  bgcolor: '#F44336', border: '2px solid white',
                  boxShadow: '0 0 0 2px #F44336',
                }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">DROPOFF</Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {currentRide.dropoffLocation?.address || `${currentRide.dropoffLocation.lat.toFixed(5)}, ${currentRide.dropoffLocation.lng.toFixed(5)}`}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Divider sx={{ my: 1.5 }} />

            {/* Fare */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {t('activeRide.fare')}
              </Typography>
              <Typography variant="h5" fontWeight={700} color="success.main">
                {currentRide.fare ? formatCurrency(currentRide.fare) : 'N/A'}
              </Typography>
            </Box>

            {/* ── Primary action button (per phase) ───────────────── */}
            {status === 'ACCEPTED' && (
              <Button
                fullWidth variant="contained" size="large"
                onClick={handleStartRide}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Navigation />}
                sx={{
                  borderRadius: 3, py: 1.8, fontSize: 16, fontWeight: 700,
                  bgcolor: '#2196F3',
                  '&:hover': { bgcolor: '#1976D2' },
                }}
              >
                {t('activeRide.startRide', 'Arrived - Start Ride')}
              </Button>
            )}

            {status === 'IN_PROGRESS' && (
              <Button
                fullWidth variant="contained" color="success" size="large"
                onClick={handleCompleteRide}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CheckCircle />}
                sx={{
                  borderRadius: 3, py: 1.8, fontSize: 16, fontWeight: 700,
                }}
              >
                {t('activeRide.completeRide', 'Complete Ride')}
              </Button>
            )}

            {/* Cancel button (only before trip starts) */}
            {status !== 'IN_PROGRESS' && status !== 'COMPLETED' && (
              <Button
                fullWidth variant="outlined" color="error" size="small"
                onClick={() => setShowCancelDialog(true)}
                startIcon={<Cancel />}
                sx={{ borderRadius: 3, mt: 1, py: 1 }}
              >
                {t('activeRide.cancelRide')}
              </Button>
            )}
          </CardContent>
        </Card>
      </Slide>

      {/* ── Cancel confirmation dialog ────────────────────────────── */}
      <Dialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {t('activeRide.confirmCancelTitle', 'Cancel this ride?')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('activeRide.confirmCancelMessage', 'Are you sure you want to cancel? This may affect your acceptance rate.')}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button
            onClick={() => setShowCancelDialog(false)}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            {t('common.no', 'Keep Ride')}
          </Button>
          <Button
            onClick={handleCancelRide}
            color="error"
            variant="contained"
            disabled={loading}
            sx={{ borderRadius: 2 }}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : t('common.yes', 'Yes, Cancel')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ActiveRide;
