import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  DirectionsCarRounded,
  LinkOffRounded,
  LocationOnRounded,
  RadioButtonCheckedRounded,
} from '@mui/icons-material';
import { BookingMap } from '../features/booking';
import { DriverLocationUpdate, RideStatusSocketPayload } from '../features/booking/types';
import { rideApi } from '../api/ride.api';
import { Ride } from '../types';
import { formatCurrency, formatDate, getVehicleTypeLabel } from '../utils/format.utils';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';

const STATUS_META: Record<string, { label: string; color: string; description: string }> = {
  ASSIGNED: { label: 'Đã có tài xế', color: '#2563eb', description: 'Tài xế đang chuẩn bị tới điểm đón.' },
  ACCEPTED: { label: 'Tài xế đang tới đón', color: '#2563eb', description: 'Vị trí tài xế được cập nhật theo thời gian thực.' },
  PICKING_UP: { label: 'Tài xế đã tới điểm đón', color: '#0f766e', description: 'Hành khách đang chuẩn bị lên xe.' },
  IN_PROGRESS: { label: 'Đang trong chuyến đi', color: '#16a34a', description: 'Chuyến đi đang diễn ra.' },
  FINDING_DRIVER: { label: 'Đang tìm tài xế mới', color: '#f59e0b', description: 'Tài xế trước đó đã hủy, hệ thống đang tìm tài xế khác.' },
  COMPLETED: { label: 'Chuyến đi đã hoàn tất', color: '#16a34a', description: 'Link còn xem được trong 30 phút sau khi chuyến kết thúc.' },
  CANCELLED: { label: 'Chuyến đi đã hủy', color: '#dc2626', description: 'Link còn xem được trong 30 phút sau khi chuyến kết thúc.' },
};

const normalizeLocation = (payload: any): DriverLocationUpdate | null => {
  const lat = payload?.lat ?? payload?.location?.lat;
  const lng = payload?.lng ?? payload?.location?.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return null;
  }

  return {
    rideId: payload.rideId,
    driverId: payload.driverId,
    lat,
    lng,
    heading: payload.heading ?? payload.location?.heading,
    timestamp: payload.timestamp ?? Date.now(),
  };
};

const PublicRideTracking: React.FC = () => {
  const { token = '' } = useParams();
  const [ride, setRide] = useState<Ride | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocationUpdate | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);

  const loadShare = useCallback(async () => {
    if (!token) {
      setError('Link theo dõi không hợp lệ.');
      setLoading(false);
      return;
    }

    try {
      const response = await rideApi.getPublicRideShare(token);
      setRide(response.data.ride);
      setExpiresAt(response.data.expiresAt);
      const currentLocation = response.data.ride.driver?.currentLocation;
      if (currentLocation?.lat && currentLocation?.lng) {
        setDriverLocation({
          rideId: response.data.ride.id,
          driverId: response.data.ride.driver?.id,
          lat: currentLocation.lat,
          lng: currentLocation.lng,
          timestamp: Date.now(),
        });
      }
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Link theo dõi đã hết hạn hoặc không còn khả dụng.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadShare();
  }, [loadShare]);

  useEffect(() => {
    if (!token || error) {
      return undefined;
    }

    const socket: Socket = io(SOCKET_URL, {
      auth: { shareToken: token },
      transports: ['websocket', 'polling'],
      upgrade: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('share:subscribe');
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('driver_location_update', (payload) => {
      const next = normalizeLocation(payload);
      if (next) {
        setDriverLocation(next);
      }
    });
    socket.on('driver:location', (payload) => {
      const next = normalizeLocation(payload);
      if (next) {
        setDriverLocation(next);
      }
    });
    socket.on('RIDE_STATUS_UPDATE', (payload: RideStatusSocketPayload) => {
      setRide((prev) => prev ? { ...prev, status: payload.status as Ride['status'], driverId: payload.driverId || prev.driverId } : prev);
      if (payload.status === 'COMPLETED' || payload.status === 'CANCELLED') {
        setError(STATUS_META[payload.status]?.description || 'Link còn xem được trong 30 phút sau khi chuyến kết thúc.');
      }
    });
    socket.on('RIDE_COMPLETED', (payload: RideStatusSocketPayload) => {
      setRide((prev) => prev ? { ...prev, status: 'COMPLETED' } : prev);
      setError(STATUS_META.COMPLETED.description);
    });
    socket.on('ride:assigned', (payload: any) => {
      setRide((prev) => prev ? {
        ...prev,
        status: payload.ride?.status || prev.status,
        driverId: payload.ride?.driverId || prev.driverId,
        driver: payload.driver || prev.driver,
      } : prev);
    });

    return () => {
      socket.disconnect();
    };
  }, [error, token]);

  const statusMeta = STATUS_META[ride?.status || ''] || STATUS_META.ACCEPTED;
  const driverName = useMemo(() => {
    const driver = ride?.driver;
    return `${driver?.firstName || ''} ${driver?.lastName || ''}`.trim() || 'Tài xế FoxGo';
  }, [ride?.driver]);
  const driverVehicle = [ride?.driver?.vehicleMake, ride?.driver?.vehicleModel, ride?.driver?.vehicleColor]
    .filter(Boolean)
    .join(' ');

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#f8fafc' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!ride) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#f8fafc', px: 2 }}>
        <Paper sx={{ p: 3, borderRadius: 4, maxWidth: 420, textAlign: 'center' }}>
          <LinkOffRounded sx={{ fontSize: 42, color: '#dc2626', mb: 1 }} />
          <Typography variant="h6" fontWeight={900}>Link không khả dụng</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {error || 'Link theo dõi đã hết hạn.'}
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', pb: 2 }}>
      <Box sx={{ maxWidth: 960, mx: 'auto', px: { xs: 1.5, sm: 2 }, py: 2 }}>
        <Stack spacing={1.5}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 4, border: '1px solid rgba(148,163,184,0.2)' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
              <Box>
                <Typography variant="h6" fontWeight={900}>Theo dõi chuyến đi FoxGo</Typography>
                <Typography variant="body2" color="text.secondary">
                  Cập nhật trực tiếp từ tài xế
                </Typography>
              </Box>
              <Chip
                icon={<RadioButtonCheckedRounded />}
                label={connected ? 'Realtime' : 'Đang nối'}
                color={connected ? 'success' : 'default'}
                sx={{ fontWeight: 800 }}
              />
            </Stack>
          </Paper>

          {error && (
            <Alert severity={ride.status === 'COMPLETED' ? 'success' : 'warning'} sx={{ borderRadius: 3 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ height: { xs: 360, sm: 480 }, borderRadius: 5, overflow: 'hidden', border: '1px solid rgba(148,163,184,0.2)', boxShadow: '0 18px 48px rgba(15,23,42,0.12)' }}>
            <BookingMap
              pickup={ride.pickup}
              dropoff={ride.dropoff}
              driverLocation={driverLocation || ride.driver?.currentLocation || null}
              mode="tracking"
              height="100%"
            />
          </Box>

          <Card sx={{ borderRadius: 4 }}>
            <CardContent>
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: statusMeta.color }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" fontWeight={900}>{statusMeta.label}</Typography>
                  <Typography variant="body2" color="text.secondary">{statusMeta.description}</Typography>
                </Box>
                <Chip label={getVehicleTypeLabel(ride.vehicleType || 'CAR_4')} size="small" sx={{ fontWeight: 800 }} />
              </Stack>

              <Divider sx={{ my: 1.5 }} />

              <Stack spacing={1.2}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <LocationOnRounded color="success" fontSize="small" />
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={800}>ĐIỂM ĐÓN</Typography>
                    <Typography variant="body2">{ride.pickup?.address || '-'}</Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <DirectionsCarRounded color="error" fontSize="small" />
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={800}>ĐIỂM ĐẾN</Typography>
                    <Typography variant="body2">{ride.dropoff?.address || '-'}</Typography>
                  </Box>
                </Stack>
              </Stack>

              <Divider sx={{ my: 1.5 }} />

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.2 }}>
                <Typography variant="body2"><strong>Tài xế:</strong> {driverName}</Typography>
                <Typography variant="body2"><strong>Xe:</strong> {driverVehicle || 'Đang cập nhật'}</Typography>
                <Typography variant="body2"><strong>Biển số:</strong> {ride.driver?.licensePlate || 'Đang cập nhật'}</Typography>
                <Typography variant="body2"><strong>Cước dự kiến:</strong> {formatCurrency(ride.fare || 0)}</Typography>
                <Typography variant="body2"><strong>Bắt đầu:</strong> {ride.requestedAt ? formatDate(ride.requestedAt) : '-'}</Typography>
                <Typography variant="body2"><strong>Link hết hạn:</strong> {expiresAt ? formatDate(expiresAt) : '-'}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </Box>
  );
};

export default PublicRideTracking;
