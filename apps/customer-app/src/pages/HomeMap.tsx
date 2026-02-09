import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Autocomplete,
} from '@mui/material';
import {
  MyLocation,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setPickupLocation,
  setDropoffLocation,
  setCurrentRide,
} from '../store/ride.slice';
import { setCurrentLocation } from '../store/location.slice';
import NavigationBar from '../components/common/NavigationBar';
import MapView from '../components/map/MapView';
import PickupMarker from '../components/map/PickupMarker';
import DropoffMarker from '../components/map/DropoffMarker';
import RideBookingFlow from '../components/booking/RideBookingFlow';
import {
  getCurrentLocation,
  geocodeAddress,
  reverseGeocode,
} from '../utils/map.utils';
import { rideApi } from '../api/ride.api';
import { Location } from '../types';

const HomeMap: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const { user } = useAppSelector((state) => state.auth);
  const { currentLocation } = useAppSelector((state) => state.location);
  const { pickupLocation, dropoffLocation } =
    useAppSelector((state) => state.ride);

  const [pickupSearch, setPickupSearch] = useState('');
  const [dropoffSearch, setDropoffSearch] = useState('');
  const [pickupOptions, setPickupOptions] = useState<Location[]>([]);
  const [dropoffOptions, setDropoffOptions] = useState<Location[]>([]);
  const [error, setErrorMessage] = useState('');
  const [bookingFlowOpen, setBookingFlowOpen] = useState(false);
  const pickupSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropoffSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickupAbort = useRef<AbortController | null>(null);
  const dropoffAbort = useRef<AbortController | null>(null);

  // Get current location on mount
  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const location = await getCurrentLocation();
        dispatch(setCurrentLocation(location));
        dispatch(setPickupLocation(location));
        
        // Get address
        const address = await reverseGeocode(location.lat, location.lng);
        dispatch(setPickupLocation({ ...location, address }));
      } catch (error) {
        console.error('Failed to get location:', error);
      }
    };

    fetchLocation();
  }, [dispatch]);

  // Check for active ride
  useEffect(() => {
    const checkActiveRide = async () => {
      try {
        const activeRide = await rideApi.getActiveRide();
        if (activeRide && activeRide.data && activeRide.data.ride) {
          dispatch(setCurrentRide(activeRide.data.ride));
          navigate(`/ride/${activeRide.data.ride.id}`);
        }
      } catch (error) {
        console.error('Failed to check active ride:', error);
      }
    };

    checkActiveRide();
  }, [dispatch, navigate]);

  // Search pickup locations
  const handlePickupSearch = async (value: string) => {
    setPickupSearch(value);
    if (pickupSearchTimer.current) {
      clearTimeout(pickupSearchTimer.current);
    }
    if (pickupAbort.current) {
      pickupAbort.current.abort();
    }
    if (value.trim().length < 3) {
      setPickupOptions([]);
      return;
    }
    pickupSearchTimer.current = setTimeout(async () => {
      const controller = new AbortController();
      pickupAbort.current = controller;
      try {
        const results = await geocodeAddress(value.trim(), { signal: controller.signal });
        setPickupOptions(results);
      } catch (error: any) {
        if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') {
          return;
        }
        console.error('Pickup search failed:', error);
      }
    }, 350);
  };

  // Search dropoff locations
  const handleDropoffSearch = async (value: string) => {
    setDropoffSearch(value);
    if (dropoffSearchTimer.current) {
      clearTimeout(dropoffSearchTimer.current);
    }
    if (dropoffAbort.current) {
      dropoffAbort.current.abort();
    }
    if (value.trim().length < 3) {
      setDropoffOptions([]);
      return;
    }
    dropoffSearchTimer.current = setTimeout(async () => {
      const controller = new AbortController();
      dropoffAbort.current = controller;
      try {
        const results = await geocodeAddress(value.trim(), { signal: controller.signal });
        setDropoffOptions(results);
      } catch (error: any) {
        if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') {
          return;
        }
        console.error('Dropoff search failed:', error);
      }
    }, 350);
  };

  // Open booking flow when both locations are selected
  const handleOpenBooking = () => {
    if (pickupLocation && dropoffLocation) {
      setBookingFlowOpen(true);
    } else {
      setErrorMessage(t('errors.selectLocations'));
    }
  };

  // Handle successful ride creation
  const handleRideCreated = (rideId: string) => {
    navigate(`/ride/${rideId}`);
  };

  // Memoize map center calculation to prevent unnecessary re-renders
  // Priority: dropoff > pickup > current location > default HCM center
  const mapCenter = useMemo(() => {
    if (dropoffLocation) return dropoffLocation;
    if (pickupLocation) return pickupLocation;
    if (currentLocation) return currentLocation;
    return { lat: 10.762622, lng: 106.660172 }; // Default: Ho Chi Minh City center
  }, [dropoffLocation, pickupLocation, currentLocation]);

  // GPS status
  const [gpsReady, setGpsReady] = useState(false);
  useEffect(() => {
    if (currentLocation) setGpsReady(true);
  }, [currentLocation]);

  // Re-center to current location
  const handleRecenter = async () => {
    try {
      const location = await getCurrentLocation();
      dispatch(setCurrentLocation(location));
      dispatch(setPickupLocation(location));
      const address = await reverseGeocode(location.lat, location.lng);
      dispatch(setPickupLocation({ ...location, address }));
      setPickupSearch(address);
    } catch (err) {
      console.error('Failed to get location:', err);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Navigation Bar */}
      <NavigationBar title={t('app.title')} />

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, position: 'relative', mt: 8 }}>
        {/* Map */}
        <MapView center={mapCenter} height="100%">
          {pickupLocation && <PickupMarker location={pickupLocation} />}
          {dropoffLocation && <DropoffMarker location={dropoffLocation} />}
        </MapView>

        {/* GPS recenter button */}
        <Box sx={{
          position: 'absolute',
          bottom: 320,
          right: 16,
          zIndex: 1000,
        }}>
          <Paper
            elevation={3}
            onClick={handleRecenter}
            sx={{
              width: 44, height: 44,
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'grey.100' },
            }}
          >
            <MyLocation sx={{ color: gpsReady ? 'primary.main' : 'grey.400' }} />
          </Paper>
        </Box>

        {/* ── Bottom booking card ─────────────────────────────────── */}
        <Paper
          elevation={6}
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            borderRadius: '20px 20px 0 0',
            p: 2.5,
            pt: 1.5,
            boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
          }}
        >
          {/* Drag handle */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'grey.300' }} />
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setErrorMessage('')}>{error}</Alert>}

          {/* Location inputs with connecting dots */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            {/* Dots column */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 2.5, width: 20 }}>
              <Box sx={{
                width: 12, height: 12, borderRadius: '50%',
                bgcolor: '#4CAF50', border: '2px solid white',
                boxShadow: '0 0 0 2px #4CAF50',
              }} />
              <Box sx={{ width: 2, height: 40, bgcolor: 'grey.300', my: 0.5 }} />
              <Box sx={{
                width: 12, height: 12, borderRadius: 1,
                bgcolor: '#F44336', border: '2px solid white',
                boxShadow: '0 0 0 2px #F44336',
              }} />
            </Box>

            {/* Inputs column */}
            <Box sx={{ flex: 1 }}>
              {/* Pickup Location */}
              <Autocomplete
                freeSolo
                options={pickupOptions}
                getOptionLabel={(option: any) => option.address || ''}
                inputValue={pickupSearch}
                onInputChange={(_, value) => handlePickupSearch(value)}
                onChange={(_, value: any) => {
                  if (value) {
                    dispatch(setPickupLocation(value));
                    setPickupSearch(value.address || '');
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={t('home.pickupPlaceholder', 'Where to pick you up?')}
                    variant="outlined"
                    size="small"
                    sx={{
                      mb: 1.5,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        bgcolor: 'grey.50',
                      },
                    }}
                    fullWidth
                  />
                )}
              />

              {/* Dropoff Location */}
              <Autocomplete
                freeSolo
                options={dropoffOptions}
                getOptionLabel={(option: any) => option.address || ''}
                inputValue={dropoffSearch}
                onInputChange={(_, value) => handleDropoffSearch(value)}
                onChange={(_, value: any) => {
                  if (value) {
                    dispatch(setDropoffLocation(value));
                    setDropoffSearch(value.address || '');
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={t('home.dropoffPlaceholder', 'Where are you going?')}
                    variant="outlined"
                    size="small"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        bgcolor: 'grey.50',
                      },
                    }}
                    fullWidth
                  />
                )}
              />
            </Box>
          </Box>

          {/* Request Ride Button */}
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleOpenBooking}
            disabled={!pickupLocation || !dropoffLocation}
            sx={{
              mt: 2,
              py: 1.8,
              fontSize: '1rem',
              fontWeight: 700,
              borderRadius: 3,
              textTransform: 'none',
              boxShadow: !pickupLocation || !dropoffLocation ? 'none' : '0 4px 12px rgba(25,118,210,0.3)',
            }}
          >
            {t('home.continueBooking', 'Book a Ride')}
          </Button>
        </Paper>
      </Box>

      {/* Ride Booking Flow Modal */}
      <RideBookingFlow
        open={bookingFlowOpen}
        onClose={() => setBookingFlowOpen(false)}
        pickup={pickupLocation!}
        dropoff={dropoffLocation!}
        onRideCreated={handleRideCreated}
      />
    </Box>
  );
};

export default HomeMap;
