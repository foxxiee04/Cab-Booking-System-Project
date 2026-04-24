import React, { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  Chip,
  Divider,
  LinearProgress,
  Stack,
  Avatar,
} from '@mui/material';
import {
  LocationOn,
  Flag,
  DirectionsCar,
  Timer,
  Route as RouteIcon,
  AccessTime,
  AttachMoney,
  TrendingUp,
} from '@mui/icons-material';
import { Ride } from '../../types';
import { formatCurrency, getVehicleTypeLabel } from '../../utils/format.utils';
import { calculateDistance, formatDistance, formatDuration } from '../../utils/map.utils';
import CountdownTimer from './CountdownTimer';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../store/hooks';
import DriverTripMap from '../../features/trip/components/DriverTripMap';
import SwipeToConfirm from '../../features/trip/components/SwipeToConfirm';

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

interface RideRequestModalProps {
  ride: Ride | null;
  timeoutSeconds: number;
  open: boolean;
  onAccept: () => void;
  onReject: () => void;
  onTimeout: () => void;
  loading?: boolean;
}

const RideRequestModal: React.FC<RideRequestModalProps> = ({
  ride,
  timeoutSeconds,
  open,
  onAccept,
  onReject,
  onTimeout,
  loading = false,
}) => {
  const { t } = useTranslation();
  const { currentLocation } = useAppSelector((state) => state.driver);
  const [timeLeft, setTimeLeft] = useState(timeoutSeconds);
  const [mapKey, setMapKey] = useState(0);
  const timeoutHandledForRideRef = useRef<string | null>(null);

  const driverShare = 0.8;

  useEffect(() => {
    if (open && ride) {
      setTimeLeft(timeoutSeconds);
      setMapKey((k) => k + 1);
      timeoutHandledForRideRef.current = null;
    }
  }, [open, ride, timeoutSeconds]);

  useEffect(() => {
    if (!open || !ride) {
      return;
    }

    if (timeLeft <= 0) {
      if (timeoutHandledForRideRef.current !== ride.id) {
        timeoutHandledForRideRef.current = ride.id;
        onTimeout();
      }
      return;
    }

    const timerId = window.setTimeout(() => {
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [onTimeout, open, ride, timeLeft]);

  if (!ride) return null;

  const progress = (timeLeft / timeoutSeconds) * 100;
  const progressColor = progress > 50 ? 'success' : progress > 25 ? 'warning' : 'error';
  const rideCode = ride.id.slice(0, 8).toUpperCase();
  const customerName = `${ride.customer?.firstName || ''} ${ride.customer?.lastName || ''}`.trim() || 'Khách hàng đang cập nhật';
  const customerPhone = ride.customer?.phoneNumber || 'Số điện thoại đang cập nhật';
  const customerInitials = `${ride.customer?.firstName?.[0] || ''}${ride.customer?.lastName?.[0] || ''}`.trim().toUpperCase() || 'KH';
  const hasFare = ride.fare != null && ride.fare > 0;
  const driverEarning = hasFare ? Math.round(ride.fare! * driverShare) : null;
  const distanceMeters = normalizeDistanceMeters(ride.distance);
  const durationSeconds = normalizeDurationSeconds(ride.duration, ride.estimatedDuration);
  const derivedDistanceMeters = (!distanceMeters && ride.pickupLocation?.lat && ride.pickupLocation?.lng && ride.dropoffLocation?.lat && ride.dropoffLocation?.lng)
    ? Math.round(Math.max(calculateDistance(ride.pickupLocation, ride.dropoffLocation) * 1.22, 0.2) * 1000)
    : undefined;
  const finalDistanceMeters = distanceMeters || derivedDistanceMeters;
  const finalDurationSeconds = durationSeconds || (finalDistanceMeters ? Math.max(180, Math.round(((finalDistanceMeters / 1000) / 24) * 3600)) : undefined);

  return (
    <Dialog
      open={open}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          maxHeight: '95vh',
          overflow: 'hidden',
          background: '#ffffff',
        },
      }}
      disableEscapeKeyDown
    >
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', maxHeight: '95vh' }}>
        {/* Header gradient */}
        <Box
          sx={{
            background: 'linear-gradient(135deg, #0f172a 0%, #0284c7 60%, #0f766e 100%)',
            color: 'white',
            px: 3,
            pt: 2.5,
            pb: 2,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Timer sx={{ fontSize: 22 }} />
            <Typography variant="subtitle1" fontWeight={800} letterSpacing={0.5}>
              {t('rideRequest.title', 'Cuốc xe mới')}
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Chip
              label={`#${rideCode}`}
              size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 700, fontSize: 12 }}
            />
          </Stack>

          <CountdownTimer seconds={timeLeft} totalSeconds={timeoutSeconds} />
          <LinearProgress
            variant="determinate"
            value={progress}
            color={progressColor}
            sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.2)' }}
          />
        </Box>

        {/* Scrollable content */}
        <Box sx={{ overflowY: 'auto', flex: 1, px: 2.5, py: 2 }}>
          <Box sx={{ mb: 2, p: 1.75, borderRadius: 3, bgcolor: '#eff6ff', border: '1px solid rgba(59,130,246,0.16)' }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar sx={{ bgcolor: '#1d4ed8', width: 40, height: 40 }} src={ride.customer?.avatar || undefined}>
                {customerInitials}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={800}>{customerName}</Typography>
                <Typography variant="caption" color="text.secondary">{customerPhone}</Typography>
              </Box>
            </Stack>
          </Box>

          {/* Map with route */}
          <Box key={mapKey} sx={{ borderRadius: 3, overflow: 'hidden', mb: 2.5, height: 240, minHeight: 200, border: '1px solid', borderColor: 'divider' }}>
            <DriverTripMap
              currentLocation={currentLocation}
              pickupLocation={ride.pickupLocation}
              dropoffLocation={ride.dropoffLocation}
              mode="request"
              height={240}
              colorMode="light"
            />
          </Box>

          {/* Pickup & Dropoff */}
          <Box sx={{ mb: 2, bgcolor: '#f8fafc', borderRadius: 3, p: 2 }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Avatar sx={{ width: 32, height: 32, bgcolor: '#dcfce7', mt: 0.5 }}>
                  <LocationOn sx={{ fontSize: 18, color: '#16a34a' }} />
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                    Điểm đón
                  </Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ mt: 0.25 }}>
                    {ride.pickupLocation?.address || t('rideRequest.locationProvided')}
                  </Typography>
                </Box>
              </Stack>

              <Box sx={{ ml: 2, pl: 1.75, borderLeft: '2px dashed #cbd5e1', py: 0.5 }} />

              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Avatar sx={{ width: 32, height: 32, bgcolor: '#fee2e2', mt: 0.5 }}>
                  <Flag sx={{ fontSize: 18, color: '#dc2626' }} />
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                    Điểm đến
                  </Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ mt: 0.25 }}>
                    {ride.dropoffLocation?.address || t('rideRequest.locationProvided')}
                  </Typography>
                </Box>
              </Stack>
            </Stack>
          </Box>

          {/* Trip stats row */}
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Box sx={{ flex: 1, textAlign: 'center', bgcolor: '#f8fafc', borderRadius: 3, p: 1.5 }}>
              <DirectionsCar sx={{ fontSize: 20, color: '#0284c7', mb: 0.5 }} />
              <Typography variant="caption" color="text.secondary" display="block">Loại xe</Typography>
              <Typography variant="body2" fontWeight={700}>
                {ride.vehicleType ? getVehicleTypeLabel(ride.vehicleType) : t('rideRequest.vehicle')}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, textAlign: 'center', bgcolor: '#f8fafc', borderRadius: 3, p: 1.5 }}>
              <RouteIcon sx={{ fontSize: 20, color: '#7c3aed', mb: 0.5 }} />
              <Typography variant="caption" color="text.secondary" display="block">Khoảng cách</Typography>
              <Typography variant="body2" fontWeight={700}>
                {finalDistanceMeters ? formatDistance(finalDistanceMeters) : 'Đang cập nhật'}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, textAlign: 'center', bgcolor: '#f8fafc', borderRadius: 3, p: 1.5 }}>
              <AccessTime sx={{ fontSize: 20, color: '#d97706', mb: 0.5 }} />
              <Typography variant="caption" color="text.secondary" display="block">Thời gian</Typography>
              <Typography variant="body2" fontWeight={700}>
                {finalDurationSeconds ? formatDuration(finalDurationSeconds) : 'Đang cập nhật'}
              </Typography>
            </Box>
          </Stack>

          {/* Fare & commission breakdown */}
          <Box
            sx={{
              borderRadius: 3,
              mb: 2,
              overflow: 'hidden',
              border: '2px solid #dcfce7',
            }}
          >
            <Box sx={{ bgcolor: '#f0fdf4', px: 2, py: 1.5 }}>
              <Stack direction="row" alignItems="center" spacing={1} justifyContent="space-between">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <AttachMoney sx={{ color: '#16a34a', fontSize: 22 }} />
                  <Typography variant="subtitle2" color="text.secondary">Tổng tiền cuốc</Typography>
                </Stack>
                <Typography variant="h5" fontWeight={800} color={hasFare ? '#15803d' : 'text.secondary'}>
                  {hasFare ? formatCurrency(ride.fare!) : '—'}
                </Typography>
              </Stack>
            </Box>
            <Divider />
            <Box sx={{ px: 2, py: 1.5 }}>
              <Stack direction="row" alignItems="center" spacing={1} justifyContent="space-between">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <TrendingUp sx={{ color: '#0284c7', fontSize: 20 }} />
                  <Box>
                    <Typography variant="body2" fontWeight={700} color="#0284c7">
                      Hoa hồng bạn nhận
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {Math.round(driverShare * 100)}% sau phí nền tảng
                    </Typography>
                  </Box>
                </Stack>
                <Typography variant="h6" fontWeight={800} color="#0284c7">
                  {driverEarning != null ? formatCurrency(driverEarning) : '—'}
                </Typography>
              </Stack>
            </Box>
          </Box>

        </Box>

        {/* Action buttons — sticky bottom */}
        <Box sx={{ px: 2.5, pb: 2.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'white' }}>
          <Stack spacing={1.5}>
            <SwipeToConfirm
              label={t('rideRequest.accept', 'Vuốt để nhận chuyến')}
              actionLabel={t('rideRequest.acceptNow', 'Nhận chuyến')}
              confirmLabel={t('rideRequest.accepting', 'Đang nhận chuyến')}
              loading={loading}
              onConfirm={onAccept}
              testId="accept-ride-swipe"
              actionButtonTestId="accept-ride-button"
            />
            <Button
              variant="outlined"
              color="error"
              size="large"
              onClick={onReject}
              disabled={loading}
              data-testid="reject-ride-button"
              sx={{ py: 1.5, borderRadius: 999, fontWeight: 700 }}
            >
              {t('rideRequest.reject', 'Từ chối')}
            </Button>
          </Stack>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default RideRequestModal;
