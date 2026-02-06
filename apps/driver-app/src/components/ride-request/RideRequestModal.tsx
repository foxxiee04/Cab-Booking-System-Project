import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
} from '@mui/material';
import {
  LocationOn,
  Flag,
  DirectionsCar,
  Phone,
  Timer,
} from '@mui/icons-material';
import { Ride } from '../../types';
import { formatCurrency, getVehicleTypeLabel } from '../../utils/format.utils';
import { formatDistance, formatDuration } from '../../utils/map.utils';
import CountdownTimer from './CountdownTimer';
import { useTranslation } from 'react-i18next';

interface RideRequestModalProps {
  ride: Ride | null;
  timeoutSeconds: number;
  open: boolean;
  onAccept: () => void;
  onReject: () => void;
  loading?: boolean;
}

const RideRequestModal: React.FC<RideRequestModalProps> = ({
  ride,
  timeoutSeconds,
  open,
  onAccept,
  onReject,
  loading = false,
}) => {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState(timeoutSeconds);

  useEffect(() => {
    if (open) {
      setTimeLeft(timeoutSeconds);
    }
  }, [open, timeoutSeconds]);

  if (!ride) return null;

  const progress = (timeLeft / timeoutSeconds) * 100;
  const progressColor = progress > 50 ? 'success' : progress > 25 ? 'warning' : 'error';

  return (
    <Dialog
      open={open}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: '90vh',
        },
      }}
      disableEscapeKeyDown
    >
      <DialogContent sx={{ p: 0 }}>
        {/* Header with countdown */}
        <Box
          sx={{
            bgcolor: 'primary.main',
            color: 'white',
            p: 3,
            textAlign: 'center',
          }}
        >
          <Timer sx={{ fontSize: 48, mb: 1 }} />
          <Typography variant="h5" fontWeight="bold">
            {t('rideRequest.title')}
          </Typography>
          <CountdownTimer
            seconds={timeLeft}
            totalSeconds={timeoutSeconds}
            onTick={(remaining) => setTimeLeft(remaining)}
            onComplete={onReject}
          />
          <LinearProgress
            variant="determinate"
            value={progress}
            color={progressColor}
            sx={{ mt: 2, height: 8, borderRadius: 4 }}
          />
        </Box>

        {/* Ride details */}
        <Box sx={{ p: 3 }}>
          {/* Customer info */}
          {ride.customer && (
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  {t('rideRequest.customer')}
                </Typography>
                <Typography variant="h6">
                  {ride.customer.firstName} {ride.customer.lastName}
                </Typography>
                {ride.customer.phoneNumber && (
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                    <Phone sx={{ fontSize: 16, mr: 0.5 }} />
                    <Typography variant="body2">{ride.customer.phoneNumber}</Typography>
                  </Box>
                )}
                {ride.customer.rating && (
                  <Chip
                    label={`⭐ ${ride.customer.rating.toFixed(1)}`}
                    size="small"
                    sx={{ mt: 1 }}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {/* Pickup location */}
          <Box sx={{ display: 'flex', mb: 2 }}>
            <LocationOn sx={{ color: 'success.main', mr: 1 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                {t('rideRequest.pickup')}
              </Typography>
              <Typography variant="body1">
                {ride.pickupLocation.address || t('rideRequest.locationProvided')}
              </Typography>
            </Box>
          </Box>

          {/* Dropoff location */}
          <Box sx={{ display: 'flex', mb: 2 }}>
            <Flag sx={{ color: 'error.main', mr: 1 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                {t('rideRequest.dropoff')}
              </Typography>
              <Typography variant="body1">
                {ride.dropoffLocation.address || t('rideRequest.locationProvided')}
              </Typography>
            </Box>
          </Box>

          {/* Trip details */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={4}>
              <Card variant="outlined" sx={{ textAlign: 'center', p: 1 }}>
                <DirectionsCar sx={{ color: 'primary.main', mb: 0.5 }} />
                <Typography variant="caption" color="text.secondary">
                  {t('rideRequest.vehicle')}
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {getVehicleTypeLabel(ride.vehicleType)}
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={4}>
              <Card variant="outlined" sx={{ textAlign: 'center', p: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('rideRequest.distance')}
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {formatDistance(ride.distance)}
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={4}>
              <Card variant="outlined" sx={{ textAlign: 'center', p: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('rideRequest.duration')}
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {formatDuration(ride.duration)}
                </Typography>
              </Card>
            </Grid>
          </Grid>

          {/* Fare */}
          <Card variant="outlined" sx={{ bgcolor: 'success.50', mb: 3 }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="subtitle2" color="text.secondary">
                {t('rideRequest.estimatedEarnings')}
              </Typography>
              <Typography variant="h4" color="success.main" fontWeight="bold">
                {formatCurrency(ride.fare)}
              </Typography>
            </CardContent>
          </Card>

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              color="error"
              fullWidth
              size="large"
              onClick={onReject}
              disabled={loading}
              sx={{ py: 1.5 }}
            >
              {t('rideRequest.reject')}
            </Button>
            <Button
              variant="contained"
              color="success"
              fullWidth
              size="large"
              onClick={onAccept}
              disabled={loading}
              sx={{ py: 1.5 }}
            >
              {loading ? t('rideRequest.accepting') : t('rideRequest.accept')}
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default RideRequestModal;
