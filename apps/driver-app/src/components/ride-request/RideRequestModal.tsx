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
  Stack,
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
import { useAppSelector } from '../../store/hooks';
import DriverTripMap from '../../features/trip/components/DriverTripMap';
import SwipeToConfirm from '../../features/trip/components/SwipeToConfirm';

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
  const { currentLocation } = useAppSelector((state) => state.driver);
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
        <Box
          sx={{
            background: 'linear-gradient(135deg, #0f172a 0%, #0f766e 100%)',
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

        <Box sx={{ p: 3 }}>
          <DriverTripMap
            currentLocation={currentLocation}
            pickupLocation={ride.pickupLocation}
            dropoffLocation={ride.dropoffLocation}
            mode="request"
            height={220}
          />

          {ride.customer && (
            <Card variant="outlined" sx={{ mt: 2, mb: 2, borderRadius: 4 }}>
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

          <Box sx={{ display: 'flex', mb: 2 }}>
            <LocationOn sx={{ color: 'success.main', mr: 1 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                {t('rideRequest.pickup')}
              </Typography>
              <Typography variant="body1">
                {ride.pickupLocation?.address || t('rideRequest.locationProvided')}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', mb: 2 }}>
            <Flag sx={{ color: 'error.main', mr: 1 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                {t('rideRequest.dropoff')}
              </Typography>
              <Typography variant="body1">
                {ride.dropoffLocation?.address || t('rideRequest.locationProvided')}
              </Typography>
            </Box>
          </Box>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={4}>
              <Card variant="outlined" sx={{ textAlign: 'center', p: 1, borderRadius: 4 }}>
                <DirectionsCar sx={{ color: 'primary.main', mb: 0.5 }} />
                <Typography variant="caption" color="text.secondary">
                  {t('rideRequest.vehicle')}
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {ride.vehicleType ? getVehicleTypeLabel(ride.vehicleType) : 'Economy'}
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={4}>
              <Card variant="outlined" sx={{ textAlign: 'center', p: 1, borderRadius: 4 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('rideRequest.distance')}
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {ride.distance ? formatDistance(ride.distance) : 'N/A'}
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={4}>
              <Card variant="outlined" sx={{ textAlign: 'center', p: 1, borderRadius: 4 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('rideRequest.duration')}
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {(ride.duration || ride.estimatedDuration) ? formatDuration(ride.duration || ride.estimatedDuration || 0) : 'N/A'}
                </Typography>
              </Card>
            </Grid>
          </Grid>

          <Card variant="outlined" sx={{ bgcolor: 'success.50', mb: 3, borderRadius: 4 }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="subtitle2" color="text.secondary">
                {t('rideRequest.estimatedEarnings')}
              </Typography>
              <Typography variant="h4" color="success.main" fontWeight="bold">
                {ride.fare ? formatCurrency(ride.fare) : 'N/A'}
              </Typography>
            </CardContent>
          </Card>

          <Stack spacing={1.5}>
            <SwipeToConfirm
              label={t('rideRequest.accept', 'Vuốt để nhận chuyến')}
              confirmLabel={t('rideRequest.accepting', 'Đang nhận chuyến')}
              loading={loading}
              onConfirm={onAccept}
            />
            <Button
              variant="outlined"
              color="error"
              size="large"
              onClick={onReject}
              disabled={loading}
              sx={{ py: 1.5, borderRadius: 999 }}
            >
              {t('rideRequest.reject')}
            </Button>
          </Stack>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default RideRequestModal;
