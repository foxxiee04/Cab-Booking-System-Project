import React, { useEffect, useState } from 'react';
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
  Switch,
  Card,
  CardContent,
  Chip,
  Alert,
} from '@mui/material';
import {
  Menu as MenuIcon,
  DriveEta,
  AttachMoney,
  History,
  Person,
  Logout,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logout } from '../store/auth.slice';
import {
  setProfile,
  setOnlineStatus,
  setCurrentLocation,
} from '../store/driver.slice';
import { clearPendingRide, setCurrentRide } from '../store/ride.slice';
import MapView from '../components/map/MapView';
import DriverMarker from '../components/map/DriverMarker';
import RideRequestModal from '../components/ride-request/RideRequestModal';
import { driverApi } from '../api/driver.api';
import { rideApi } from '../api/ride.api';
import { driverSocketService } from '../socket/driver.socket';
import { watchPosition, clearWatch } from '../utils/map.utils';
import { formatCurrency } from '../utils/format.utils';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { user, accessToken } = useAppSelector((state) => state.auth);
  const { profile, isOnline, currentLocation, earnings } = useAppSelector(
    (state) => state.driver
  );
  const { pendingRide, timeoutSeconds } = useAppSelector(
    (state) => state.ride
  );

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch driver profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await driverApi.getProfile();
        dispatch(setProfile(response.data.driver));

        // Fetch earnings
        await driverApi.getEarnings();
      } catch (error: any) {
        console.error('Failed to fetch profile:', error);
        if (error.response?.status === 404) {
          // Driver profile not set up
          navigate('/profile-setup');
        }
      }
    };

    fetchProfile();
  }, [dispatch, navigate]);

  // Connect socket when online
  useEffect(() => {
    if (isOnline && accessToken) {
      driverSocketService.connect(accessToken);
    } else {
      driverSocketService.disconnect();
    }

    return () => {
      driverSocketService.disconnect();
    };
  }, [isOnline, accessToken]);

  // Watch location when online
  useEffect(() => {
    if (isOnline && !watchId) {
      const id = watchPosition(
        (location) => {
          dispatch(setCurrentLocation(location));
          // Send location to server via socket
          driverSocketService.updateLocation(location);
          // Also update via API
          driverApi.updateLocation(location).catch(console.error);
        },
        (error) => {
          console.error('Location error:', error);
          setError('Failed to get location. Please enable GPS.');
        }
      );
      setWatchId(id);
    }

    return () => {
      if (watchId) {
        clearWatch(watchId);
        setWatchId(null);
      }
    };
  }, [isOnline, watchId, dispatch]);

  // Check for active ride on mount
  useEffect(() => {
    const checkActiveRide = async () => {
      try {
        const response = await rideApi.getActiveRide();
        if (response.data.ride) {
          dispatch(setCurrentRide(response.data.ride));
          navigate('/active-ride');
        }
      } catch (error) {
        console.error('Failed to check active ride:', error);
      }
    };

    checkActiveRide();
  }, [dispatch, navigate]);

  // Handle go online/offline
  const handleToggleOnline = async () => {
    setLoading(true);
    try {
      if (isOnline) {
        await driverApi.goOffline();
        dispatch(setOnlineStatus(false));
      } else {
        await driverApi.goOnline();
        dispatch(setOnlineStatus(true));
      }
    } catch (error: any) {
      setError(error.response?.data?.error?.message || 'Failed to change status');
    } finally {
      setLoading(false);
    }
  };

  // Handle accept ride
  const handleAcceptRide = async () => {
    if (!pendingRide) return;

    setLoading(true);
    try {
      const response = await rideApi.acceptRide(pendingRide.id);
      dispatch(setCurrentRide(response.data.ride));
      dispatch(clearPendingRide());
      navigate('/active-ride');
    } catch (error: any) {
      setError(error.response?.data?.error?.message || 'Failed to accept ride');
      dispatch(clearPendingRide());
    } finally {
      setLoading(false);
    }
  };

  // Handle reject ride
  const handleRejectRide = async () => {
    if (!pendingRide) return;

    try {
      await rideApi.rejectRide(pendingRide.id);
      dispatch(clearPendingRide());
    } catch (error) {
      console.error('Failed to reject ride:', error);
      dispatch(clearPendingRide());
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      if (isOnline) {
        await driverApi.goOffline();
      }
      dispatch(logout());
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const mapCenter = currentLocation || { lat: 10.762622, lng: 106.660172 };

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
          <DriveEta sx={{ mr: 1 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Driver Dashboard
          </Typography>
          <Chip
            label={isOnline ? 'ONLINE' : 'OFFLINE'}
            color={isOnline ? 'success' : 'default'}
            size="small"
            sx={{ mr: 2 }}
          />
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Drawer anchor="left" open={sidebarOpen} onClose={() => setSidebarOpen(false)}>
        <Box sx={{ width: 250, pt: 2 }}>
          <Box sx={{ px: 2, pb: 2 }}>
            <Typography variant="h6">
              {user?.firstName} {user?.lastName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {profile?.vehicleMake} {profile?.vehicleModel}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ⭐ {(profile?.rating ?? 0).toFixed(1)} • {profile?.totalRides ?? 0} rides
            </Typography>
          </Box>
          <List>
            <ListItemButton onClick={() => { navigate('/earnings'); setSidebarOpen(false); }}>
              <ListItemIcon><AttachMoney /></ListItemIcon>
              <ListItemText primary="Earnings" />
            </ListItemButton>
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
          {currentLocation && <DriverMarker location={currentLocation} />}
        </MapView>

        {/* Online/Offline Toggle */}
        <Card
          elevation={3}
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            right: 16,
            maxWidth: 400,
            mx: 'auto',
            zIndex: 1000,
          }}
        >
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">
                {isOnline ? 'You are Online' : 'You are Offline'}
              </Typography>
              <Switch
                checked={isOnline}
                onChange={handleToggleOnline}
                disabled={loading}
                color="success"
              />
            </Box>
            {isOnline && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Ready to accept rides
              </Typography>
            )}
            {!isOnline && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Go online to start accepting rides
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* Earnings Card */}
        {earnings && (
          <Card
            elevation={3}
            sx={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              zIndex: 1000,
            }}
          >
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Today's Earnings
              </Typography>
              <Typography variant="h5" color="success.main" fontWeight="bold">
                {formatCurrency(earnings.today)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {profile?.totalRides || 0} rides completed
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Error Alert */}
        {error && (
          <Alert
            severity="error"
            onClose={() => setError('')}
            sx={{
              position: 'absolute',
              top: 100,
              left: 16,
              right: 16,
              maxWidth: 400,
              mx: 'auto',
              zIndex: 1000,
            }}
          >
            {error}
          </Alert>
        )}
      </Box>

      {/* Ride Request Modal */}
      {pendingRide && (
        <RideRequestModal
          ride={pendingRide}
          timeoutSeconds={timeoutSeconds}
          open={!!pendingRide}
          onAccept={handleAcceptRide}
          onReject={handleRejectRide}
          loading={loading}
        />
      )}
    </Box>
  );
};

export default Dashboard;
