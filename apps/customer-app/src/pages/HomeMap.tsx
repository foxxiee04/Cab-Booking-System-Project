import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import {
  AccessTimeRounded,
  DirectionsCarFilledRounded,
  MyLocationRounded,
  RouteRounded,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setPickupLocation, setDropoffLocation, setCurrentRide } from '../store/ride.slice';
import { setCurrentLocation } from '../store/location.slice';
import RideBookingFlow from '../components/booking/RideBookingFlow';
import { getCurrentLocation, reverseGeocode } from '../utils/map.utils';
import { driverApi } from '../api/driver.api';
import { rideApi } from '../api/ride.api';
import { BookingMap, BookingMapLocation, NearbyDriver, RouteSummary } from '../features/booking';

const HomeMap: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const { user } = useAppSelector((state) => state.auth);
  const { isAuthenticated, accessToken } = useAppSelector((state) => state.auth);
  const { pickupLocation, dropoffLocation } = useAppSelector((state) => state.ride);

  const [error, setErrorMessage] = useState('');
  const [locationNotice, setLocationNotice] = useState('');
  const [bookingFlowOpen, setBookingFlowOpen] = useState(false);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [bootstrappingLocation, setBootstrappingLocation] = useState(false);
  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriver[]>([]);

  useEffect(() => {
    const fetchLocation = async () => {
      setBootstrappingLocation(true);
      try {
        const location = await getCurrentLocation();
        setLocationNotice('');
        dispatch(setCurrentLocation(location));
        dispatch(setPickupLocation(location));

        const address = await reverseGeocode(location.lat, location.lng);
        dispatch(setPickupLocation({ ...location, address }));
      } catch (fetchLocationError: any) {
        if (fetchLocationError?.code === 1) {
          setLocationNotice('Trình duyệt đang chặn vị trí của bạn. Bạn vẫn có thể nhập điểm đón thủ công để tiếp tục đặt xe.');
        } else {
          console.error('Failed to get location:', fetchLocationError);
          setLocationNotice('Không lấy được vị trí hiện tại. Hãy nhập điểm đón thủ công để tiếp tục.');
        }
      } finally {
        setBootstrappingLocation(false);
      }
    };

    fetchLocation();
  }, [dispatch]);

  useEffect(() => {
    const checkActiveRide = async () => {
      try {
        const activeRide = await rideApi.getActiveRide();
        if (activeRide?.data?.ride) {
          dispatch(setCurrentRide(activeRide.data.ride));
          navigate(`/ride/${activeRide.data.ride.id}`);
        }
      } catch (activeRideError) {
        console.error('Failed to check active ride:', activeRideError);
      }
    };

    checkActiveRide();
  }, [dispatch, navigate]);

  useEffect(() => {
    if (!pickupLocation?.lat || !pickupLocation?.lng || !isAuthenticated || !accessToken) {
      setNearbyDrivers([]);
      return;
    }

    let cancelled = false;
    let stopPolling = false;

    const fetchNearbyDrivers = async () => {
      try {
        const response = await driverApi.getNearbyDrivers({
          lat: pickupLocation.lat,
          lng: pickupLocation.lng,
          radius: 4,
        });

        if (!cancelled) {
          setNearbyDrivers(response.data.drivers);
        }
      } catch (nearbyDriversError: any) {
        if (!cancelled) {
          if (nearbyDriversError?.response?.status === 401) {
            stopPolling = true;
            return;
          }

          console.error('Failed to fetch nearby drivers:', nearbyDriversError);
          setNearbyDrivers([]);
        }
      }
    };

    fetchNearbyDrivers();
    const interval = window.setInterval(() => {
      if (!stopPolling) {
        void fetchNearbyDrivers();
      }
    }, 20000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [accessToken, isAuthenticated, pickupLocation?.lat, pickupLocation?.lng]);

  const handleOpenBooking = () => {
    if (pickupLocation && dropoffLocation) {
      setErrorMessage('');
      setBookingFlowOpen(true);
    } else {
      setErrorMessage(t('errors.selectLocations'));
    }
  };

  const handleRideCreated = (rideId: string) => {
    setBookingFlowOpen(false);
    navigate(`/ride/${rideId}`);
  };

  const routeMeta = useMemo(() => {
    if (!routeSummary) {
      return [] as Array<{ icon: React.ReactElement; label: string }>;
    }

    return [
      { icon: <RouteRounded />, label: routeSummary.distanceText },
      { icon: <AccessTimeRounded />, label: routeSummary.durationText },
    ];
  }, [routeSummary]);

  const normalizeLocation = (location: BookingMapLocation | null) => {
    if (!location) {
      return null;
    }

    return {
      lat: location.lat,
      lng: location.lng,
      address: location.address,
    };
  };

  return (
    <Box
      sx={{
        minHeight: '100%',
        display: 'grid',
        gridTemplateRows: bookingFlowOpen ? 'auto minmax(440px, 1fr) auto' : 'auto minmax(520px, 1fr) auto',
        gap: 1.5,
        pb: { xs: 14, sm: 2 },
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
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }} src={user?.avatar}>
            {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary">
              {t('app.welcome', { name: user?.firstName || 'bạn' })}
            </Typography>
            <Typography variant="h6" fontWeight={800}>
              {t('home.mobileHeadline', 'Bạn muốn đi đâu hôm nay?')}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 2 }}>
          <Chip icon={<DirectionsCarFilledRounded />} label={`${nearbyDrivers.length} ${t('home.nearbyDrivers', 'tài xế gần bạn')}`} color="primary" />
          <Chip icon={<MyLocationRounded />} label={pickupLocation?.address || t('home.pickupHint', 'Chọn điểm đón')} variant="outlined" />
        </Stack>
      </Paper>

      <Box
        sx={{
          position: 'relative',
          minHeight: { xs: 400, md: 560 },
          borderRadius: 6,
          overflow: 'hidden',
          background: 'linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%)',
          boxShadow: '0 18px 48px rgba(15,23,42,0.12)',
          border: '1px solid rgba(59,130,246,0.12)',
        }}
      >
        {bootstrappingLocation && !pickupLocation ? (
          <Box sx={{ p: 2, height: '100%' }}>
            <Skeleton variant="rectangular" width="100%" height="100%" sx={{ minHeight: 420, borderRadius: 6 }} />
          </Box>
        ) : (
          <BookingMap
            pickup={normalizeLocation(pickupLocation)}
            dropoff={normalizeLocation(dropoffLocation)}
            nearbyDrivers={nearbyDrivers}
            colorMode="light"
            onPickupChange={(location) => dispatch(setPickupLocation(normalizeLocation(location)))}
            onDropoffChange={(location) => dispatch(setDropoffLocation(normalizeLocation(location)))}
            onRouteComputed={setRouteSummary}
            onError={setErrorMessage}
            height="100%"
          />
        )}
      </Box>

      <Paper
        elevation={8}
        sx={{
          borderRadius: 5,
          p: 2.25,
          pb: { xs: 3.5, sm: 2.25 },
          mb: { xs: 4, sm: 0 },
          backgroundColor: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(18px)',
          border: '1px solid rgba(148,163,184,0.14)',
        }}
      >
        {locationNotice && <Alert severity="info" sx={{ mb: error ? 1.5 : 2, borderRadius: 2 }} onClose={() => setLocationNotice('')}>{locationNotice}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setErrorMessage('')}>{error}</Alert>}

        {!bookingFlowOpen ? (
          <>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1.5 }}>
              <Chip icon={<MyLocationRounded />} label={pickupLocation?.address || t('home.pickupHint', 'Chọn điểm đón')} size="small" color="success" variant="outlined" />
              {routeMeta.map((item) => (
                <Chip key={item.label} icon={item.icon} label={item.label} size="small" variant="outlined" />
              ))}
            </Stack>

            <Typography variant="h6" fontWeight={800} sx={{ mb: 0.5 }}>
              {t('home.bookingHeadline', 'Đặt xe theo luồng 3 bước')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('home.bookingBody', 'Chọn điểm đón, xem quãng đường và ETA, sau đó chọn loại xe cùng giá ước tính ngay trong bottom sheet.')}
            </Typography>

            <Stack direction="row" spacing={1.25} sx={{ mb: 2 }}>
              <Paper variant="outlined" sx={{ flex: 1, p: 1.5, borderRadius: 3 }}>
                <Typography variant="overline" color="text.secondary">{t('home.stepOne', 'Bước 1')}</Typography>
                <Typography variant="subtitle2" fontWeight={800}>{t('home.stepOneBody', 'Chọn điểm đón và điểm đến')}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ flex: 1, p: 1.5, borderRadius: 3 }}>
                <Typography variant="overline" color="text.secondary">{t('home.stepTwo', 'Bước 2')}</Typography>
                <Typography variant="subtitle2" fontWeight={800}>{t('home.stepTwoBody', 'Xem loại xe và giá')}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ flex: 1, p: 1.5, borderRadius: 3 }}>
                <Typography variant="overline" color="text.secondary">{t('home.stepThree', 'Bước 3')}</Typography>
                <Typography variant="subtitle2" fontWeight={800}>{t('home.stepThreeBody', 'Tìm tài xế gần nhất')}</Typography>
              </Paper>
            </Stack>

            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handleOpenBooking}
              disabled={!pickupLocation || !dropoffLocation}
              data-testid="open-booking-flow"
              sx={{
                py: 1.65,
                fontSize: '1rem',
                fontWeight: 800,
                borderRadius: 3.5,
                textTransform: 'none',
                boxShadow: !pickupLocation || !dropoffLocation ? 'none' : '0 10px 24px rgba(37,99,235,0.28)',
              }}
            >
              {t('home.continueBooking', 'Tiếp tục đặt xe')}
            </Button>
          </>
        ) : (
          <RideBookingFlow
            open={bookingFlowOpen}
            onClose={() => setBookingFlowOpen(false)}
            pickup={pickupLocation!}
            dropoff={dropoffLocation!}
            onRideCreated={handleRideCreated}
            presentation="inline"
          />
        )}
      </Paper>
    </Box>
  );
};

export default HomeMap;
