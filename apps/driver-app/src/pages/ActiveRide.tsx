import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
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
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
} from '@mui/material';
import {
  ArrowBack,
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
import { showNotification } from '../store/ui.slice';
import { rideApi } from '../api/ride.api';
import { driverApi } from '../api/driver.api';
import { Ride } from '../types';
import { formatCurrency, getPaymentMethodLabel } from '../utils/format.utils';
import { useTranslation } from 'react-i18next';
import DriverTripMap from '../features/trip/components/DriverTripMap';
import { driverSocketService } from '../socket/driver.socket';
import { watchPosition, clearWatch, getDemoFallbackLocation } from '../utils/map.utils';

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

const DRIVER_CANCEL_REASONS = [
  'Khách không xuất hiện tại điểm đón',
  'Không thể liên hệ với khách',
  'Khách yêu cầu hủy chuyến',
  'Sự cố phương tiện',
  'Sự cố giao thông / an toàn',
  'Khác',
];

const hasCustomerIdentity = (customer: Ride['customer'] | undefined) => Boolean(
  customer && (
    `${customer.firstName || ''} ${customer.lastName || ''}`.trim()
    || customer.phoneNumber
    || customer.avatar
  )
);

const ActiveRide: React.FC = () => {
  const loggedGeoErrorCodesRef = useRef<Set<number>>(new Set());
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const { user } = useAppSelector((state) => state.auth);

  const { currentLocation, isOnline } = useAppSelector((state) => state.driver);
  const { currentRide } = useAppSelector((state) => state.ride);

  const [initializing, setInitializing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [customCancelReason, setCustomCancelReason] = useState('');
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOnline || !currentRide || watchIdRef.current !== null) {
      return;
    }

    const fallback = getDemoFallbackLocation(user?.phoneNumber) ?? undefined;
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
      },
      fallback
    );

    watchIdRef.current = id;

    return () => {
      clearWatch(id);
      watchIdRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRide, dispatch, isOnline, t]);

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

  useEffect(() => {
    if (!currentRide?.id) {
      return;
    }

    const shouldRefreshCustomerIdentity = ['ASSIGNED', 'ACCEPTED', 'PICKING_UP', 'IN_PROGRESS'].includes(currentRide.status)
      && !hasCustomerIdentity(currentRide.customer);

    if (!shouldRefreshCustomerIdentity) {
      return;
    }

    let isMounted = true;

    const hydrateCurrentRide = async () => {
      try {
        const response = await rideApi.getRide(currentRide.id);
        if (isMounted && response.data.ride) {
          dispatch(setCurrentRide(response.data.ride));
        }
      } catch {
        // Keep current ride usable even if the customer profile hydration fails.
      }
    };

    void hydrateCurrentRide();

    return () => {
      isMounted = false;
    };
  }, [currentRide?.customer, currentRide?.id, currentRide?.status, dispatch]);

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
  }, [currentRide, dispatch]);

  const handleCompleteRide = useCallback(async () => {
    if (!currentRide) return;
    setLoading(true);
    try {
      await rideApi.completeRide(currentRide.id);
      const storageKey = getOptimisticCompletedRidesKey(user?.id);
      const currentCompletedRides = Number(sessionStorage.getItem(storageKey) || '0');
      sessionStorage.setItem(storageKey, String(currentCompletedRides + 1));

      // Dispatch earnings/debt notification so driver knows what to expect in wallet
      const fare = currentRide.fare || 0;
      const isCash = currentRide.paymentMethod === 'CASH';
      const commissionRateMap: Record<string, number> = {
        MOTORBIKE: 0.20, SCOOTER: 0.20, CAR_4: 0.18, CAR_7: 0.15,
      };
      const rate = commissionRateMap[currentRide.vehicleType || ''] ?? 0.20;
      const commission = Math.round(fare * rate);
      const netEarnings = fare - commission;

      if (isCash) {
        dispatch(showNotification({
          type: 'warning',
          title: 'Chuyến tiền mặt hoàn thành',
          message: `Bạn giữ ${formatCurrency(fare)} tiền mặt. Phí nền tảng ${formatCurrency(commission)} (${Math.round(rate * 100)}%) đã ghi nợ vào ví. Xem chi tiết công nợ trong mục Ví tiền.`,
          persistMs: 9000,
        }));
      } else {
        dispatch(showNotification({
          type: 'success',
          title: 'Thu nhập đang xử lý',
          message: `${formatCurrency(netEarnings)} sẽ vào ví trong vòng 24h (sau khi hệ thống xử lý). Xem trạng thái trong Ví tiền → Tiền chờ xử lý.`,
          persistMs: 9000,
        }));
      }

      dispatch(clearCurrentRide());
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('errors.completeRide'));
    } finally {
      setLoading(false);
    }
  }, [currentRide, dispatch, navigate, t, user?.id]);

  const handleCancelRide = useCallback(async (reason: string) => {
    if (!currentRide) return;
    setLoading(true);
    try {
      await rideApi.cancelRide(currentRide.id, reason);
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
  const customerIdentityReady = hasCustomerIdentity(currentRide.customer);
  const customerPhoneNumber = currentRide.customer?.phoneNumber || '';
  const customerName = customerIdentityReady
    ? `${currentRide.customer?.firstName || ''} ${currentRide.customer?.lastName || ''}`.trim() || customerPhoneNumber || 'Khách hàng'
    : 'Đang tải thông tin khách hàng';
  const customerInitials = `${currentRide.customer?.firstName?.[0] || ''}${currentRide.customer?.lastName?.[0] || ''}`.trim().toUpperCase() || 'KH';
  const pickupAddress = currentRide.pickupLocation?.address || `${currentRide.pickupLocation.lat.toFixed(5)}, ${currentRide.pickupLocation.lng.toFixed(5)}`;
  const dropoffAddress = currentRide.dropoffLocation?.address || `${currentRide.dropoffLocation.lat.toFixed(5)}, ${currentRide.dropoffLocation.lng.toFixed(5)}`;

  return (
    <Box sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 1.5, pb: 1.5 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: { xs: 0.5, md: 0 } }}>
        <Button
          variant="text"
          startIcon={<ArrowBack />}
          onClick={() => navigate('/dashboard')}
          sx={{ borderRadius: 999, fontWeight: 700, px: 1.5 }}
        >
          Quay lại
        </Button>
        <Chip
          icon={phase.icon as React.ReactElement}
          label={phase.label}
          sx={{
            bgcolor: phase.bgColor,
            color: phase.color,
            fontWeight: 700,
            '& .MuiChip-icon': { color: phase.color },
          }}
        />
      </Stack>

      {/* Map section with explicit height so Leaflet tiles render correctly */}
      <Box sx={{
        position: 'relative',
        height: { xs: 340, sm: 420, md: 480 },
        minHeight: 280,
        borderRadius: { xs: 3, md: 4 },
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%)',
        boxShadow: '0 18px 48px rgba(15,23,42,0.12)',
        border: '1px solid rgba(59,130,246,0.12)',
      }}>
        <DriverTripMap
          currentLocation={mapCenter}
          pickupLocation={currentRide.pickupLocation}
          dropoffLocation={currentRide.dropoffLocation}
          mode={status === 'IN_PROGRESS' ? 'trip' : 'pickup'}
          height="100%"
          colorMode="light"
        />
      </Box>

      {/* Ride info card */}
      <Card sx={{ borderRadius: 5, boxShadow: '0 18px 45px rgba(15,23,42,0.12)', backgroundColor: 'rgba(255,255,255,0.96)', border: '1px solid rgba(148,163,184,0.14)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, pb: 0.5 }}>
          <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'grey.300' }} />
        </Box>

        <CardContent sx={{ pt: 1 }}>
          {error && (
            <Alert
              severity="error"
              onClose={() => setError('')}
              sx={{ mb: 1.5 }}
            >
              {error}
            </Alert>
          )}
          <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, mb: 2 }}>
            <Avatar src={currentRide.customer?.avatar || undefined} sx={{ width: 50, height: 50, bgcolor: 'primary.main', fontSize: 20 }}>
              {customerInitials}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                {customerName}
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 0.75 }}>
                {customerIdentityReady && customerPhoneNumber && (
                  <Chip size="small" label={customerPhoneNumber} sx={{ borderRadius: 999, bgcolor: '#ecfeff', color: '#0f766e', fontWeight: 700 }} />
                )}
                <Chip size="small" label={`Mã chuyến ${currentRide.id.slice(0, 8).toUpperCase()}`} sx={{ borderRadius: 999, bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }} />
              </Stack>
              {currentRide.customer?.rating && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <StarRate sx={{ color: '#FFC107', fontSize: 16 }} />
                  <Typography variant="body2" color="text.secondary">
                    {currentRide.customer.rating.toFixed(1)}
                  </Typography>
                </Box>
              )}
            </Box>
            {/* Chat button rendered separately as floating FAB — see below */}
          </Box>


          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25, mb: 2 }}>
            <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <Typography variant="caption" color="text.secondary">Điểm đón</Typography>
              <Typography variant="body2" fontWeight={700} sx={{ mt: 0.5 }}>
                {pickupAddress}
              </Typography>
            </Box>
            <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <Typography variant="caption" color="text.secondary">Điểm đến</Typography>
              <Typography variant="body2" fontWeight={700} sx={{ mt: 0.5 }}>
                {dropoffAddress}
              </Typography>
            </Box>
            <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: '#eff6ff', border: '1px solid rgba(59,130,246,0.14)' }}>
              <Typography variant="caption" color="text.secondary">Thanh toán</Typography>
              <Typography variant="body2" fontWeight={800} sx={{ mt: 0.5, color: '#1d4ed8' }}>
                {getPaymentMethodLabel(currentRide.paymentMethod || 'CASH')}
              </Typography>
            </Box>
            <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: '#ecfeff', border: '1px solid rgba(13,148,136,0.16)' }}>
              <Typography variant="caption" color="text.secondary">Mã chuyến</Typography>
              <Typography variant="body2" fontWeight={800} sx={{ mt: 0.5, color: '#0f766e' }}>
                {currentRide.id.slice(0, 8).toUpperCase()}
              </Typography>
            </Box>
          </Box>

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
        onClose={() => {
          setShowCancelDialog(false);
          setCancelReason('');
          setCustomCancelReason('');
        }}
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {t('activeRide.confirmCancelTitle', 'Hủy chuyến đi này?')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('activeRide.confirmCancelMessage', 'Bạn có chắc muốn hủy chuyến? Thao tác này có thể ảnh hưởng đến tỷ lệ nhận chuyến của bạn.')}
          </DialogContentText>
          <RadioGroup
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            sx={{ mt: 2 }}
          >
            {DRIVER_CANCEL_REASONS.map((reason) => (
              <FormControlLabel
                key={reason}
                value={reason}
                control={<Radio />}
                label={reason}
              />
            ))}
          </RadioGroup>
          {cancelReason === 'Khác' && (
            <TextField
              fullWidth
              autoFocus
              multiline
              minRows={2}
              label="Nhập lý do hủy chuyến"
              value={customCancelReason}
              onChange={(event) => setCustomCancelReason(event.target.value)}
              sx={{ mt: 1 }}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button
            onClick={() => {
              setShowCancelDialog(false);
              setCancelReason('');
              setCustomCancelReason('');
            }}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            {t('common.no', 'Tiếp tục chuyến này')}
          </Button>
          <Button
            onClick={() => {
              const reason = cancelReason === 'Khác'
                ? customCancelReason.trim()
                : cancelReason;
              if (!reason) {
                return;
              }
              void handleCancelRide(reason);
            }}
            color="error"
            variant="contained"
            disabled={loading || !cancelReason || (cancelReason === 'Khác' && !customCancelReason.trim())}
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
