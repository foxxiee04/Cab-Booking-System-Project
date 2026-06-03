import React, { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Button,
  Alert,
  CircularProgress,
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
  ReceiptLongRounded,
} from '@mui/icons-material';
import { driverApi } from '../api/driver.api';
import { rideApi } from '../api/ride.api';
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
import ContactBox from '../components/ContactBox';
import { useAppSelector } from '../store/hooks';
import DriverTripMap from '../features/trip/components/DriverTripMap';

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

  return raw <= 30 ? raw * 60 : raw;
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

const hasLocationCoordinates = (location?: { lat?: number; lng?: number } | null) => (
  typeof location?.lat === 'number'
  && typeof location?.lng === 'number'
  && !Number.isNaN(location.lat)
  && !Number.isNaN(location.lng)
);

const getCustomerName = (ride: Ride) => {
  const fullName = `${ride.customer?.firstName || ''} ${ride.customer?.lastName || ''}`.trim();
  return fullName || ride.customer?.phoneNumber || 'Khách hàng';
};

const canReviewRideConversation = (ride: Ride) => (
  ['ACCEPTED', 'PICKING_UP', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(ride.status)
);

const History: React.FC = () => {
  const { t } = useTranslation();
  const { accessToken, user } = useAppSelector((state) => state.auth);
  const [rides, setRides] = useState<Ride[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [selectedRideLoading, setSelectedRideLoading] = useState(false);

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

  const handleOpenRideDetails = async (ride: Ride) => {
    setSelectedRide(ride);
    setSelectedRideLoading(true);

    try {
      const response = await rideApi.getRide(ride.id);
      setSelectedRide(response.data.ride);
    } catch {
      setSelectedRide(ride);
    } finally {
      setSelectedRideLoading(false);
    }
  };

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
            <ReceiptLongRounded sx={{ color: '#2563eb', fontSize: 26 }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={800}>Lịch sử chuyến đi</Typography>
            <Typography variant="body2" color="text.secondary">
              {total > 0 ? `${total} chuyến đã chạy` : 'Lịch sử hành trình'}
            </Typography>
          </Box>
        </Stack>
        {/* Search + Filter row */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Tìm theo mã chuyến, điểm đón, điểm đến"
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
          <MenuItem value="ACCEPTED">Đã nhận</MenuItem>
          <MenuItem value="PICKING_UP">Đang đón khách</MenuItem>
          <MenuItem value="IN_PROGRESS">Đang chạy</MenuItem>
          <MenuItem value="COMPLETED">Hoàn tất</MenuItem>
          <MenuItem value="CANCELLED">Đã hủy</MenuItem>
          <MenuItem value="PENDING">Đang chờ</MenuItem>
        </TextField>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {!loading && filteredRides.length === 0 && (
        <Box sx={{ py: 6, textAlign: 'center', bgcolor: '#f8fafc', borderRadius: 4, border: '1px solid #e2e8f0' }}>
          <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
            <ReceiptLongRounded sx={{ fontSize: 32, color: 'text.disabled' }} />
          </Box>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>{t('history.noRides', 'Chưa có chuyến nào')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {searchQuery ? 'Không tìm thấy kết quả phù hợp' : 'Các chuyến đã hoàn thành sẽ xuất hiện ở đây.'}
          </Typography>
        </Box>
      )}

      <Stack spacing={1.5}>
        {filteredRides.map((ride) => {
          const metrics = getRideDistanceAndDuration(ride);
          return (
            <Card
              key={ride.id}
              variant="outlined"
              onClick={() => void handleOpenRideDetails(ride)}
              sx={{
                cursor: 'pointer',
                borderRadius: 4,
                transition: 'all 0.15s',
                borderLeft: `3px solid`,
                borderLeftColor: ride.status === 'COMPLETED' ? 'success.main' : ride.status === 'CANCELLED' ? 'error.main' : 'primary.main',
                '&:hover': { boxShadow: 3, transform: 'translateY(-1px)' },
              }}
            >
              <CardContent>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={800}>{getVehicleTypeLabel(ride.vehicleType)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {ride.createdAt ? formatDate(ride.createdAt) : ''}
                    </Typography>
                  </Box>
                  <Stack alignItems="flex-end" spacing={0.5}>
                    <Chip label={getRideStatusLabel(ride.status)} color={getRideStatusColor(ride.status)} size="small" />
                    <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace' }}>
                      #{ride.id.slice(0, 8).toUpperCase()}
                    </Typography>
                  </Stack>
                </Stack>

                <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.25 }}>
                  <Avatar src={ride.customer?.avatar || undefined} sx={{ width: 36, height: 36, bgcolor: '#1d4ed8' }}>
                    {ride.customer?.firstName?.[0] || 'K'}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={800} noWrap>
                      {getCustomerName(ride)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {ride.customer?.phoneNumber || 'Đang cập nhật số điện thoại'}
                    </Typography>
                  </Box>
                </Stack>

                {/* Locations */}
                <Stack spacing={0.5} sx={{ mb: 1 }}>
                  {ride.pickupLocation?.address && (
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <LocationOnRounded sx={{ fontSize: 16, color: '#16a34a', mt: 0.25, flexShrink: 0 }} />
                      <Typography variant="body2">{ride.pickupLocation.address}</Typography>
                    </Stack>
                  )}
                  {ride.dropoffLocation?.address && (
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <FlagRounded sx={{ fontSize: 16, color: '#dc2626', mt: 0.25, flexShrink: 0 }} />
                      <Typography variant="body2">{ride.dropoffLocation.address}</Typography>
                    </Stack>
                  )}
                </Stack>

                {/* Metrics row */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Typography variant="subtitle2" fontWeight={800} color="primary.main">
                    {ride.fare ? formatCurrency(ride.fare) : '—'}
                  </Typography>
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap justifyContent="flex-end">
                    {metrics.distanceMeters && (
                      <Typography variant="caption" color="text.secondary">{formatDistance(metrics.distanceMeters)}</Typography>
                    )}
                    {metrics.durationSeconds && (
                      <Typography variant="caption" color="text.secondary">{formatDuration(metrics.durationSeconds)}</Typography>
                    )}
                    {ride.paymentMethod && (
                      <Typography variant="caption" color="text.secondary">{getPaymentMethodLabel(ride.paymentMethod)}</Typography>
                    )}
                    <Button
                      size="small"
                      variant="outlined"
                      sx={{ borderRadius: 2 }}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleOpenRideDetails(ride);
                      }}
                    >
                      Xem chi tiết
                    </Button>
                  </Stack>
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
            const hasRouteMap = hasLocationCoordinates(selectedRide.pickupLocation)
              && hasLocationCoordinates(selectedRide.dropoffLocation);
            return (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
              <Box>
                <Typography variant="h6" fontWeight={800}>Chi tiết chuyến đi</Typography>
                <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace' }}>
                  #{selectedRide.id.slice(0, 8).toUpperCase()}
                </Typography>
              </Box>
              <Button size="small" onClick={() => setSelectedRide(null)} startIcon={<CloseRounded fontSize="small" />}>
                Đóng
              </Button>
            </DialogTitle>

            <DialogContent dividers>
              <Stack spacing={2}>
                {selectedRideLoading && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">
                      Đang tải đầy đủ thông tin chuyến đi...
                    </Typography>
                  </Stack>
                )}

                {hasRouteMap && (
                  <Box>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <RouteRounded sx={{ fontSize: 18, color: '#2563eb' }} />
                        <Typography variant="subtitle2" fontWeight={800}>
                          Lộ trình chuyến đi
                        </Typography>
                      </Stack>
                      {metrics.distanceMeters && (
                        <Chip size="small" label={formatDistance(metrics.distanceMeters)} variant="outlined" sx={{ fontWeight: 700 }} />
                      )}
                    </Stack>
                    <DriverTripMap
                      currentLocation={selectedRide.pickupLocation}
                      pickupLocation={selectedRide.pickupLocation}
                      dropoffLocation={selectedRide.dropoffLocation}
                      mode="trip"
                      height="clamp(240px, 42vh, 320px)"
                      colorMode="light"
                    />
                  </Box>
                )}

                {selectedRide.customer && (
                  <Box sx={{ bgcolor: '#eff6ff', borderRadius: 3, p: 1.5, border: '1px solid rgba(59,130,246,0.14)' }}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Avatar src={selectedRide.customer.avatar || undefined} sx={{ width: 44, height: 44, bgcolor: '#1d4ed8' }}>
                        {selectedRide.customer.firstName?.[0] || 'K'}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={800}>{getCustomerName(selectedRide)}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {selectedRide.customer.phoneNumber || 'Số điện thoại đang cập nhật'}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                )}

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

                {canReviewRideConversation(selectedRide) && selectedRide.customerId && (
                  <>
                    <Divider />
                    <ContactBox
                      token={accessToken}
                      rideId={selectedRide.id}
                      myUserId={user?.id}
                      contactName={getCustomerName(selectedRide)}
                      contactPhone={selectedRide.customer?.phoneNumber || undefined}
                      role="DRIVER"
                      triggerMode="inline"
                      triggerLabel="Xem lại cuộc trò chuyện"
                      fullWidthTrigger
                      readOnly
                    />
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
