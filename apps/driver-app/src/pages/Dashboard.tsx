import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Switch,
  Card,
  CardContent,
  Chip,
  Alert,
  FormControlLabel,
  Typography,
  Paper,
  Grid,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logout } from '../store/auth.slice';
import {
  setProfile,
  setOnlineStatus,
  setCurrentLocation,
} from '../store/driver.slice';
import { clearPendingRide, setCurrentRide } from '../store/ride.slice';
import NavigationBar from '../components/common/NavigationBar';
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
  const { t } = useTranslation();

  const { user, accessToken } = useAppSelector((state) => state.auth);
  const { profile, isOnline, currentLocation, earnings } = useAppSelector(
    (state) => state.driver
  );
  const { pendingRide, timeoutSeconds } = useAppSelector(
    (state) => state.ride
  );

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);

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
          setError(t('dashboard.gpsError'));
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
    setError('');
    try {
      if (isOnline) {
        await driverApi.goOffline();
        dispatch(setOnlineStatus(false));
      } else {
        await driverApi.goOnline();
        dispatch(setOnlineStatus(true));
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || t('dashboard.statusChangeFailed');
      setError(errorMessage);
      
      // Check if error is due to approval status
      if (errorMessage.includes('approved') || errorMessage.includes('PENDING')) {
        setError(t('dashboard.needApproval'));
      }
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
      setError(error.response?.data?.error?.message || t('dashboard.acceptRideFailed'));
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
      {/* Navigation Bar */}
      <NavigationBar title={t('dashboard.title')} />

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, position: 'relative', mt: 8 }}>
        {/* Map */}
        <MapView center={mapCenter} height="100%">
          {currentLocation && <DriverMarker location={currentLocation} />}
        </MapView>

        {/* Online/Offline Toggle */}
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            right: 16,
            maxWidth: 400,
            mx: 'auto',
            zIndex: 1000,
            borderRadius: 3,
          }}
        >
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs>
                <Typography variant="h6">
                  {isOnline ? t('dashboard.youOnline') : t('dashboard.youOffline')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {isOnline
                    ? t('dashboard.readyToAccept')
                    : t('dashboard.goOnlineHint')}
                </Typography>
              </Grid>
              <Grid item>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(isOnline)}
                      onChange={handleToggleOnline}
                      disabled={loading}
                      color="success"
                    />
                  }
                  label=""
                />
              </Grid>
            </Grid>
            {profile && (
              <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={`⭐ ${(profile.rating ?? 0).toFixed(1)}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
                <Chip
                  label={`${profile.totalRides ?? 0} rides`}
                  size="small"
                  variant="outlined"
                />
              </Box>
            )}
          </CardContent>
        </Paper>

        {/* Earnings Card */}
        {earnings && (
          <Paper
            elevation={3}
            sx={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              zIndex: 1000,
              borderRadius: 3,
            }}
          >
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                {t('dashboard.todayEarnings')}
              </Typography>
              <Typography variant="h5" color="success.main" fontWeight="bold">
                {formatCurrency(earnings.today)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('dashboard.ridesCompleted', { count: profile?.totalRides || 0 })}
              </Typography>
            </CardContent>
          </Paper>
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
