import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  TextField,
  Button,
  Card,
  CardContent,
  Chip,
  Alert,
  CircularProgress,
  Autocomplete,
} from '@mui/material';
import {
  Menu as MenuIcon,
  History,
  Person,
  Logout,
  DirectionsCar,
  MyLocation,
  Search,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logout } from '../store/auth.slice';
import {
  setPickupLocation,
  setDropoffLocation,
  setFareEstimate,
  setSurgeMultiplier,
  setCurrentRide,
} from '../store/ride.slice';
import { setCurrentLocation } from '../store/location.slice';
import MapView from '../components/map/MapView';
import PickupMarker from '../components/map/PickupMarker';
import DropoffMarker from '../components/map/DropoffMarker';
import {
  getCurrentLocation,
  geocodeAddress,
  reverseGeocode,
} from '../utils/map.utils';
import { formatCurrency } from '../utils/format.utils';
import { pricingApi } from '../api/pricing.api';
import { rideApi } from '../api/ride.api';
import { Location } from '../types';

const HomeMap: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { user } = useAppSelector((state) => state.auth);
  const { currentLocation } = useAppSelector((state) => state.location);
  const { pickupLocation, dropoffLocation, fareEstimate, surgeMultiplier } =
    useAppSelector((state) => state.ride);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pickupSearch, setPickupSearch] = useState('');
  const [dropoffSearch, setDropoffSearch] = useState('');
  const [pickupOptions, setPickupOptions] = useState<Location[]>([]);
  const [dropoffOptions, setDropoffOptions] = useState<Location[]>([]);
  const [loading, setLoadingState] = useState(false);
  const [error, setErrorMessage] = useState('');
  const [vehicleType, setVehicleType] = useState<'ECONOMY' | 'COMFORT' | 'PREMIUM'>('ECONOMY');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'WALLET'>('CASH');
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
        if (activeRide) {
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

  // Estimate fare
  const handleEstimateFare = async () => {
    if (!pickupLocation || !dropoffLocation) {
      setErrorMessage('Please select pickup and dropoff locations');
      return;
    }

    setLoadingState(true);
    setErrorMessage('');

    try {
      // Get surge multiplier
      const surgeResponse = await pricingApi.getSurge();
      dispatch(setSurgeMultiplier(surgeResponse.data.multiplier));

      // Get fare estimate
      const estimateResponse = await pricingApi.estimateFare({
        pickup: pickupLocation,
        dropoff: dropoffLocation,
        vehicleType,
      });

      dispatch(setFareEstimate(estimateResponse.data.fare));
    } catch (error: any) {
      setErrorMessage('Failed to estimate fare. Please try again.');
    } finally {
      setLoadingState(false);
    }
  };

  // Request ride
  const handleRequestRide = async () => {
    if (!pickupLocation || !dropoffLocation) {
      setErrorMessage('Please select pickup and dropoff locations');
      return;
    }

    setLoadingState(true);
    setErrorMessage('');

    try {
      const response = await rideApi.createRide({
        pickup: pickupLocation,
        dropoff: dropoffLocation,
        vehicleType,
        paymentMethod,
      });

      dispatch(setCurrentRide(response.data.ride));
      navigate(`/ride/${response.data.ride.id}`);
    } catch (error: any) {
      setErrorMessage(error.response?.data?.error?.message || 'Failed to request ride');
    } finally {
      setLoadingState(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const mapCenter = dropoffLocation || pickupLocation || currentLocation || { lat: 10.762622, lng: 106.660172 };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* App Bar */}
      <AppBar position="static">
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => setSidebarOpen(true)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <DirectionsCar sx={{ mr: 1 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Cab Booking
          </Typography>
          <Typography variant="body2">
            Welcome, {user?.firstName}!
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Drawer anchor="left" open={sidebarOpen} onClose={() => setSidebarOpen(false)}>
        <Box sx={{ width: 250, pt: 2 }}>
          <Box sx={{ px: 2, pb: 2 }}>
            <Typography variant="h6">{user?.firstName} {user?.lastName}</Typography>
            <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
          </Box>
          <List>
            <ListItemButton onClick={() => { navigate('/history'); setSidebarOpen(false); }}>
              <ListItemIcon><History /></ListItemIcon>
              <ListItemText primary="Ride History" />
            </ListItemButton>
            <ListItemButton onClick={() => { navigate('/profile'); setSidebarOpen(false); }}>
              <ListItemIcon><Person /></ListItemIcon>
              <ListItemText primary="Profile" />
            </ListItemButton>
            <ListItemButton onClick={handleLogout}>
              <ListItemIcon><Logout /></ListItemIcon>
              <ListItemText primary="Logout" />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        {/* Map */}
        <MapView center={mapCenter} height="100%">
          {pickupLocation && <PickupMarker location={pickupLocation} />}
          {dropoffLocation && <DropoffMarker location={dropoffLocation} />}
        </MapView>

        {/* Booking Panel */}
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            right: 16,
            maxWidth: 400,
            mx: 'auto',
            p: 2,
            zIndex: 1000,
          }}
        >
          <Typography variant="h6" gutterBottom>
            Book a Ride
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

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
                label="Pickup Location"
                placeholder="Search for pickup location"
                InputProps={{
                  ...params.InputProps,
                  startAdornment: <MyLocation sx={{ mr: 1, color: 'action.active' }} />,
                }}
                sx={{ mb: 2 }}
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
                handleEstimateFare();
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Dropoff Location"
                placeholder="Where to?"
                InputProps={{
                  ...params.InputProps,
                  startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} />,
                }}
                sx={{ mb: 2 }}
              />
            )}
          />

          {/* Fare Estimate */}
          {fareEstimate && (
            <Card variant="outlined" sx={{ mb: 2, bgcolor: '#F5F5F5' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Estimated Fare
                  </Typography>
                  <Typography variant="h5" color="primary" fontWeight="bold">
                    {formatCurrency(fareEstimate)}
                  </Typography>
                </Box>
                {surgeMultiplier > 1 && (
                  <Chip
                    label={`${surgeMultiplier}x Surge Pricing`}
                    size="small"
                    color="warning"
                    sx={{ mt: 1 }}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {/* Vehicle Type */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom>Vehicle Type</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {['ECONOMY', 'COMFORT', 'PREMIUM'].map((type) => (
                <Chip
                  key={type}
                  label={type}
                  onClick={() => setVehicleType(type as any)}
                  color={vehicleType === type ? 'primary' : 'default'}
                  variant={vehicleType === type ? 'filled' : 'outlined'}
                />
              ))}
            </Box>
          </Box>

          {/* Payment Method */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom>Payment Method</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {['CASH', 'CARD', 'WALLET'].map((method) => (
                <Chip
                  key={method}
                  label={method}
                  onClick={() => setPaymentMethod(method as any)}
                  color={paymentMethod === method ? 'secondary' : 'default'}
                  variant={paymentMethod === method ? 'filled' : 'outlined'}
                />
              ))}
            </Box>
          </Box>

          {/* Request Ride Button */}
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleRequestRide}
            disabled={loading || !pickupLocation || !dropoffLocation}
            sx={{ py: 1.5 }}
          >
            {loading ? <CircularProgress size={24} /> : 'Request Ride'}
          </Button>
        </Paper>
      </Box>
    </Box>
  );
};

export default HomeMap;
