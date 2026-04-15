import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Button,
  Alert,
  InputAdornment,
  MenuItem,
  Paper,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Stack,
  IconButton,
  Skeleton,
} from '@mui/material';
import {
  SearchRounded,
  CloseRounded,
  LocationOnRounded,
  FlagRounded,
  AttachMoneyRounded,
  RouteRounded,
  AccessTimeRounded,
  DirectionsBikeRounded,
  EventRounded,
  TagRounded,
  DriveEtaRounded,
} from '@mui/icons-material';
import { driverApi } from '../api/driver.api';
import { Ride } from '../types';
import {
  formatCurrency,
  formatDate,
  getRideStatusColor,
  getRideStatusLabel,
  getVehicleTypeLabel,
  getPaymentMethodLabel,
} from '../utils/format.utils';
import { calculateDistance, formatDistance, formatDuration } from '../utils/map.utils';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 10;

const normalizeDistanceMeters = (distance?: number) => {
  if (!distance || Number.isNaN(distance) || distance <= 0) {
    return undefined;
  }

  return distance > 100 ? distance : distance * 1000;
};

const normalizeDurationSeconds = (duration?: number, estimatedDuration?: number) => {
  const raw = duration && duration > 0 ? duration : estimatedDuration && estimatedDuration > 0 ? estimatedDuration : undefined;
  if (!raw) {
    return undefined;
  }

  return raw <= 180 ? raw * 60 : raw;
};

const getRideDistanceAndDuration = (ride: Ride) => {
  const normalizedDistance = normalizeDistanceMeters(ride.distance);
  const normalizedDuration = normalizeDurationSeconds(ride.duration, ride.estimatedDuration);

  if (normalizedDistance && normalizedDuration) {
    return { distanceMeters: normalizedDistance, durationSeconds: normalizedDuration };
  }

  const pickup = ride.pickupLocation;
  const dropoff = ride.dropoffLocation;
  if (pickup?.lat && pickup?.lng && dropoff?.lat && dropoff?.lng) {
    const straightLineKm = calculateDistance(pickup, dropoff);
    const routedKm = Math.max(straightLineKm * 1.22, 0.2);
    const estimatedDistanceMeters = Math.round(routedKm * 1000);
    const estimatedDurationSeconds = Math.round((routedKm / 24) * 3600);
    return {
      distanceMeters: normalizedDistance || estimatedDistanceMeters,
      durationSeconds: normalizedDuration || Math.max(180, estimatedDurationSeconds),
    };
  }

  return {
    distanceMeters: normalizedDistance,
    durationSeconds: normalizedDuration,
  };
};

const getLocationText = (location?: { address?: string; lat?: number; lng?: number }) => {
  if (location?.address && location.address.trim()) {
    return location.address;
  }

  if (typeof location?.lat === 'number' && typeof location?.lng === 'number' && !Number.isNaN(location.lat) && !Number.isNaN(location.lng)) {
    return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
  }

  return 'Không có dữ liệu vị trí';
};

const History: React.FC = () => {
  const { t } = useTranslation();
  const [rides, setRides] = useState<Ride[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await driverApi.getRideHistory({
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        });
        setRides(response.data.rides || []);
        setTotal(response.data.total || 0);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || t('errors.loadRideHistory'));
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [page, t]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filteredRides = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return rides.filter((ride) => {
      const statusMatched = statusFilter === 'ALL' || ride.status === statusFilter;
      if (!statusMatched) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const rideText = [ride.id, ride.pickupLocation?.address, ride.dropoffLocation?.address]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return rideText.includes(normalizedSearch);
    });
  }, [rides, searchQuery, statusFilter]);

  return (
    <Box
      sx={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        pb: 2,
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
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
          <Box sx={{ p: 1.25, borderRadius: 3, bgcolor: 'rgba(37,99,235,0.10)', display: 'flex' }}>
            <DriveEtaRounded sx={{ color: '#2563eb', fontSize: 26 }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={800}>Chuyến đi</Typography>
            <Typography variant="body2" color="text.secondary">
              {total > 0 ? `${total} chuyến` : 'Lịch sử hành trình'}
            </Typography>
          </Box>
        </Stack>
        {/* Search + Filter row */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Tìm theo mã hoặc địa chỉ"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
        />
        <TextField
          select
          size="small"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          sx={{ minWidth: 130, '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
        >
          <MenuItem value="ALL">Tất cả</MenuItem>
          <MenuItem value="COMPLETED">Hoàn tất</MenuItem>
          <MenuItem value="CANCELLED">Đã hủy</MenuItem>
          <MenuItem value="IN_PROGRESS">Đang chạy</MenuItem>
          <MenuItem value="ACCEPTED">Đã nhận</MenuItem>
          <MenuItem value="PENDING">Đang chờ</MenuItem>
        </TextField>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

      {loading && (
        <Stack spacing={1.5}>
          {[1, 2, 3].map((k) => <Skeleton key={k} variant="rounded" height={90} sx={{ borderRadius: 3 }} />)}
        </Stack>
      )}

      {!loading && filteredRides.length === 0 && (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <DriveEtaRounded sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">{t('history.noRides')}</Typography>
        </Box>
      )}

      <Stack spacing={1.5}>
        {filteredRides.map((ride) => {
          const metrics = getRideDistanceAndDuration(ride);
          return (
            <Card
              key={ride.id}
              variant="outlined"
              onClick={() => setSelectedRide(ride)}
              sx={{
                cursor: 'pointer',
                borderRadius: 3,
                transition: 'box-shadow 0.15s',
                '&:hover': { boxShadow: 4, borderColor: 'primary.main' },
              }}
            >
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={0.75}>
                  <Box>
                    <Typography variant="body2" fontWeight={700}>{getVehicleTypeLabel(ride.vehicleType)}</Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace' }}>
                      #{ride.id.slice(0, 8).toUpperCase()}
                    </Typography>
                  </Box>
                  <Stack alignItems="flex-end" spacing={0.5}>
                    <Chip label={getRideStatusLabel(ride.status)} color={getRideStatusColor(ride.status)} size="small" />
                    <Typography variant="caption" color="text.secondary">
                      {ride.createdAt ? formatDate(ride.createdAt) : ''}
                    </Typography>
                  </Stack>
                </Stack>

                {/* Locations */}
                <Stack spacing={0.25} mb={0.75}>
                  {ride.pickupLocation?.address && (
                    <Stack direction="row" spacing={0.75} alignItems="flex-start">
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main', mt: '5px', flexShrink: 0 }} />
                      <Typography variant="caption" color="text.secondary" noWrap>{ride.pickupLocation.address}</Typography>
                    </Stack>
                  )}
                  {ride.dropoffLocation?.address && (
                    <Stack direction="row" spacing={0.75} alignItems="flex-start">
                      <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: 'error.main', mt: '5px', flexShrink: 0 }} />
                      <Typography variant="caption" color="text.secondary" noWrap>{ride.dropoffLocation.address}</Typography>
                    </Stack>
                  )}
                </Stack>

                {/* Metrics row */}
                <Stack direction="row" spacing={1.5} flexWrap="wrap">
                  <Typography variant="caption" fontWeight={700} color="primary.main">
                    {ride.fare ? formatCurrency(ride.fare) : '—'}
                  </Typography>
                  {metrics.distanceMeters && (
                    <Typography variant="caption" color="text.secondary">{formatDistance(metrics.distanceMeters)}</Typography>
                  )}
                  {metrics.durationSeconds && (
                    <Typography variant="caption" color="text.secondary">{formatDuration(metrics.durationSeconds)}</Typography>
                  )}
                  {ride.paymentMethod && (
                    <Typography variant="caption" color="text.secondary">{getPaymentMethodLabel(ride.paymentMethod)}</Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      {/* Pagination */}
      {totalPages > 1 && (
        <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" sx={{ mt: 3 }}>
          <Button
            variant="outlined"
            size="small"
            disabled={page <= 0}
            onClick={() => setPage((prev) => Math.max(0, prev - 1))}
            sx={{ borderRadius: 3 }}
          >
            {t('history.previous')}
          </Button>
          <Typography variant="body2" color="text.secondary">
            {page + 1} / {totalPages}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
            sx={{ borderRadius: 3 }}
          >
            {t('history.next')}
          </Button>
        </Stack>
      )}

      <Dialog
        open={Boolean(selectedRide)}
        onClose={() => setSelectedRide(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 4 } }}
      >
        {selectedRide && (
          (() => {
            const metrics = getRideDistanceAndDuration(selectedRide);
            return (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
              <Box>
                <Typography variant="h6" fontWeight={800}>Chi tiết chuyến đi</Typography>
                <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace' }}>
                  #{selectedRide.id.toUpperCase()}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  label={getRideStatusLabel(selectedRide.status)}
                  color={getRideStatusColor(selectedRide.status)}
                  size="small"
                />
                <IconButton size="small" onClick={() => setSelectedRide(null)}>
                  <CloseRounded fontSize="small" />
                </IconButton>
              </Box>
            </DialogTitle>

            <DialogContent dividers>
              <Stack spacing={2}>
                {/* Locations */}
                <Box sx={{ bgcolor: '#f8fafc', borderRadius: 3, p: 1.5 }}>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <LocationOnRounded color="success" sx={{ mt: 0.25, flexShrink: 0 }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>ĐIỂM ĐÓN</Typography>
                      <Typography variant="body2">
                        {getLocationText(selectedRide.pickupLocation)}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 1.5 }}>
                    <FlagRounded color="error" sx={{ mt: 0.25, flexShrink: 0 }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>ĐIỂM ĐẾN</Typography>
                      <Typography variant="body2">
                        {getLocationText(selectedRide.dropoffLocation)}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>

                <Divider />

                {/* Trip Stats */}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <AttachMoneyRounded color="primary" fontSize="small" />
                    <Box>
                      <Typography variant="caption" color="text.secondary">Tiền cước</Typography>
                      <Typography variant="body2" fontWeight={700}>
                        {selectedRide.fare ? formatCurrency(selectedRide.fare) : 'Chưa có'}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <DirectionsBikeRounded color="action" fontSize="small" />
                    <Box>
                      <Typography variant="caption" color="text.secondary">Loại xe</Typography>
                      <Typography variant="body2" fontWeight={700}>
                        {getVehicleTypeLabel(selectedRide.vehicleType)}
                      </Typography>
                    </Box>
                  </Stack>
                  {metrics.distanceMeters && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <RouteRounded color="action" fontSize="small" />
                      <Box>
                        <Typography variant="caption" color="text.secondary">Khoảng cách</Typography>
                        <Typography variant="body2" fontWeight={700}>
                          {formatDistance(metrics.distanceMeters)}
                        </Typography>
                      </Box>
                    </Stack>
                  )}
                  {metrics.durationSeconds && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AccessTimeRounded color="action" fontSize="small" />
                      <Box>
                        <Typography variant="caption" color="text.secondary">Thời gian</Typography>
                        <Typography variant="body2" fontWeight={700}>
                          {formatDuration(metrics.durationSeconds)}
                        </Typography>
                      </Box>
                    </Stack>
                  )}
                  {selectedRide.paymentMethod && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TagRounded color="action" fontSize="small" />
                      <Box>
                        <Typography variant="caption" color="text.secondary">Thanh toán</Typography>
                        <Typography variant="body2" fontWeight={700}>
                          {getPaymentMethodLabel(selectedRide.paymentMethod)}
                        </Typography>
                      </Box>
                    </Stack>
                  )}
                  {selectedRide.paymentStatus && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TagRounded color="action" fontSize="small" />
                      <Box>
                        <Typography variant="caption" color="text.secondary">TT thanh toán</Typography>
                        <Typography variant="body2" fontWeight={700}>
                          {selectedRide.paymentStatus === 'COMPLETED' ? 'Đã thanh toán' :
                           selectedRide.paymentStatus === 'FAILED' ? 'Thất bại' : 'Chờ thanh toán'}
                        </Typography>
                      </Box>
                    </Stack>
                  )}
                </Box>

                <Divider />

                {/* Timestamps */}
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 1, display: 'block' }}>
                    THỜI GIAN
                  </Typography>
                  <Stack spacing={0.75}>
                    {selectedRide.createdAt && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <EventRounded color="action" fontSize="small" />
                        <Typography variant="body2" color="text.secondary">Tạo lúc:</Typography>
                        <Typography variant="body2">{formatDate(selectedRide.createdAt)}</Typography>
                      </Stack>
                    )}
                    {selectedRide.acceptedAt && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <EventRounded color="action" fontSize="small" />
                        <Typography variant="body2" color="text.secondary">Nhận lúc:</Typography>
                        <Typography variant="body2">{formatDate(selectedRide.acceptedAt)}</Typography>
                      </Stack>
                    )}
                    {selectedRide.startedAt && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <EventRounded color="action" fontSize="small" />
                        <Typography variant="body2" color="text.secondary">Bắt đầu:</Typography>
                        <Typography variant="body2">{formatDate(selectedRide.startedAt)}</Typography>
                      </Stack>
                    )}
                    {selectedRide.completedAt && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <EventRounded color="action" fontSize="small" />
                        <Typography variant="body2" color="text.secondary">Hoàn tất:</Typography>
                        <Typography variant="body2">{formatDate(selectedRide.completedAt)}</Typography>
                      </Stack>
                    )}
                  </Stack>
                </Box>

                {/* Customer info if available */}
                {selectedRide.customer && (
                  <>
                    <Divider />
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 1, display: 'block' }}>
                        KHÁCH HÀNG
                      </Typography>
                      <Typography variant="body2">
                        {selectedRide.customer.firstName} {selectedRide.customer.lastName}
                      </Typography>
                      {selectedRide.customer.phoneNumber && (
                        <Typography variant="body2" color="text.secondary">
                          {selectedRide.customer.phoneNumber}
                        </Typography>
                      )}
                    </Box>
                  </>
                )}
              </Stack>
            </DialogContent>

            <DialogActions sx={{ p: 2 }}>
              <Button variant="contained" onClick={() => setSelectedRide(null)} sx={{ px: 3, borderRadius: 999 }}>
                Đóng
              </Button>
            </DialogActions>
          </>
            );
          })()
        )}
      </Dialog>
    </Box>
  );
};

export default History;
