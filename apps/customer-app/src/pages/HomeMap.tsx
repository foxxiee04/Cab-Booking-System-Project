import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { setPickupLocation, setDropoffLocation, setCurrentRide, clearRide } from '../store/ride.slice';
import { setCurrentLocation } from '../store/location.slice';
import RideBookingFlow from '../components/booking/RideBookingFlow';
import { getCurrentLocation, reverseGeocode } from '../utils/map.utils';
import { driverApi } from '../api/driver.api';
import { rideApi } from '../api/ride.api';
import { BookingMap, BookingMapLocation, NearbyDriver, RouteSummary } from '../features/booking';

// Module-level helper — never recreated between renders.
const normalizeLocation = (location: BookingMapLocation | null) => {
  if (!location) {
    return null;
  }

  return { lat: location.lat, lng: location.lng, address: location.address };
};

const MAX_VISIBLE_NEARBY_RADIUS_KM = 3;
const NEARBY_DRIVER_RADIUS_KM = Math.max(
  0.5,
  Math.min(
    Number(import.meta.env.VITE_NEARBY_DRIVER_RADIUS_KM || MAX_VISIBLE_NEARBY_RADIUS_KM),
    MAX_VISIBLE_NEARBY_RADIUS_KM,
  ),
);

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
        } else {
          dispatch(clearRide());
        }
      } catch (activeRideError) {
        console.error('Failed to check active ride:', activeRideError);
        dispatch(clearRide());
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
    let currentInterval: number | null = null;

    const fetchNearbyDrivers = async () => {
      try {
        const response = await driverApi.getNearbyDrivers({
          lat: pickupLocation.lat,
          lng: pickupLocation.lng,
          radius: NEARBY_DRIVER_RADIUS_KM,
        });

        if (!cancelled) {
          // Filter and sort drivers by distance
          const driversWithDistance = (response.data.drivers || [])
            .filter((driver: any) => driver?.id && driver?.lat != null && driver?.lng != null)
            .map((driver: any) => {
              // Calculate rough distance
              const latDiff = driver.lat - pickupLocation.lat;
              const lngDiff = driver.lng - pickupLocation.lng;
              const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111; // rough km
              return { ...driver, distance };
            })
            .filter((driver: any) => driver.distance <= NEARBY_DRIVER_RADIUS_KM)
            .sort((a: any, b: any) => a.distance - b.distance);

          setNearbyDrivers(driversWithDistance);
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

    // Initial fetch
    void fetchNearbyDrivers();

    // Poll every 10 seconds (faster than before for real-time updates)
    currentInterval = window.setInterval(() => {
      if (!stopPolling) {
        void fetchNearbyDrivers();
      }
    }, 10000);

    return () => {
      cancelled = true;
      if (currentInterval !== null) {
        window.clearInterval(currentInterval);
      }
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

  // Memoize normalized locations by primitive values so BookingMap's route
  // effect only re-fires when lat/lng/address actually changes.
  const normalizedPickup = useMemo(
    () => normalizeLocation(pickupLocation),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pickupLocation?.lat, pickupLocation?.lng, pickupLocation?.address],
  );

  const normalizedDropoff = useMemo(
    () => normalizeLocation(dropoffLocation),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dropoffLocation?.lat, dropoffLocation?.lng, dropoffLocation?.address],
  );

  const handlePickupChange = useCallback(
    (location: BookingMapLocation | null) => dispatch(setPickupLocation(normalizeLocation(location))),
    [dispatch],
  );

  const handleDropoffChange = useCallback(
    (location: BookingMapLocation | null) => dispatch(setDropoffLocation(normalizeLocation(location))),
    [dispatch],
  );

  return (
    <Box
      sx={{
        minHeight: '100%',
        display: 'grid',
        gridTemplateRows: bookingFlowOpen ? 'auto minmax(440px, 1fr) auto' : 'auto minmax(520px, 1fr) auto',
        gap: 1.5,
        pb: { xs: 14, sm: 2 },
        background: '#f8fafc',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 5,
          background: '#ffffff',
          border: '1px solid rgba(148,163,184,0.16)',
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
          background: '#e2e8f0',
          boxShadow: '0 8px 20px rgba(15,23,42,0.08)',
          border: '1px solid rgba(148,163,184,0.2)',
        }}
      >
        {bootstrappingLocation && !pickupLocation ? (
          <Box sx={{ p: 2, height: '100%' }}>
            <Skeleton variant="rectangular" width="100%" height="100%" sx={{ minHeight: 420, borderRadius: 6 }} />
          </Box>
        ) : (
          <BookingMap
            pickup={normalizedPickup}
            dropoff={normalizedDropoff}
            nearbyDrivers={nearbyDrivers}
            colorMode="light"
            onPickupChange={handlePickupChange}
            onDropoffChange={handleDropoffChange}
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
          backgroundColor: '#ffffff',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(148,163,184,0.14)',
        }}
      >
        {locationNotice && <Alert severity="info" sx={{ mb: error ? 1.5 : 2, borderRadius: 2 }} onClose={() => setLocationNotice('')}>{locationNotice}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setErrorMessage('')}>{error}</Alert>}

        {!bookingFlowOpen ? (
          <>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
              <Chip icon={<MyLocationRounded />} label={pickupLocation?.address || t('home.pickupHint', 'Chọn điểm đón')} size="small" color="success" variant="outlined" />
              {routeMeta.map((item) => (
                <Chip key={item.label} icon={item.icon} label={item.label} size="small" variant="outlined" />
              ))}
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
