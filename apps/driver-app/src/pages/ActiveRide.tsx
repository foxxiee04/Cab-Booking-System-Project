import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Card,
  CardContent,
  Button,
  Chip,
  Alert,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import { ArrowBack, Phone } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updateRideStatus, clearCurrentRide } from '../store/ride.slice';
import MapView from '../components/map/MapView';
import DriverMarker from '../components/map/DriverMarker';
import PickupMarker from '../components/map/PickupMarker';
import DropoffMarker from '../components/map/DropoffMarker';
import RouteLine from '../components/map/RouteLine';
import { rideApi } from '../api/ride.api';
import { formatCurrency, getRideStatusLabel } from '../utils/format.utils';

const ActiveRide: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { currentLocation } = useAppSelector((state) => state.driver);
  const { currentRide } = useAppSelector((state) => state.ride);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleStartRide = async () => {
    if (!currentRide) return;

    setLoading(true);
    try {
      const response = await rideApi.startRide(currentRide.id);
      dispatch(updateRideStatus(response.data.ride.status));
    } catch (error: any) {
      setError(error.response?.data?.error?.message || 'Failed to start ride');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRide = async () => {
    if (!currentRide) return;

    setLoading(true);
    try {
      await rideApi.completeRide(currentRide.id);
      dispatch(clearCurrentRide());
      navigate('/dashboard');
    } catch (error: any) {
      setError(error.response?.data?.error?.message || 'Failed to complete ride');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRide = async () => {
    if (!currentRide || !window.confirm('Are you sure you want to cancel this ride?')) return;

    setLoading(true);
    try {
      await rideApi.cancelRide(currentRide.id, 'Driver cancelled');
      dispatch(clearCurrentRide());
      navigate('/dashboard');
    } catch (error: any) {
      setError(error.response?.data?.error?.message || 'Failed to cancel ride');
    } finally {
      setLoading(false);
    }
  };

  if (!currentRide) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <Typography>No active ride</Typography>
      </Box>
    );
  }

  const mapCenter = currentLocation || currentRide.pickupLocation;
  const steps = ['Assigned', 'Accepted', 'Pickup', 'In Progress', 'Completed'];
  const activeStep = steps.indexOf(getRideStatusLabel(currentRide.status));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/dashboard')}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Active Ride
          </Typography>
          <Chip label={getRideStatusLabel(currentRide.status)} color="primary" />
        </Toolbar>
      </AppBar>

      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        <MapView center={mapCenter} height="100%">
          {currentLocation && <DriverMarker location={currentLocation} />}
          <PickupMarker location={currentRide.pickupLocation} />
          <DropoffMarker location={currentRide.dropoffLocation} />
          {currentLocation && currentRide.status === 'ACCEPTED' && (
            <RouteLine start={currentLocation} end={currentRide.pickupLocation} />
          )}
          {currentLocation && currentRide.status === 'IN_PROGRESS' && (
            <RouteLine start={currentLocation} end={currentRide.dropoffLocation} />
          )}
        </MapView>

        {error && (
          <Alert severity="error" sx={{ position: 'absolute', top: 16, left: 16, right: 16, zIndex: 1000 }}>
            {error}
          </Alert>
        )}

        <Card
          elevation={3}
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            right: 16,
            zIndex: 1000,
          }}
        >
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {currentRide.customer?.firstName} {currentRide.customer?.lastName}
            </Typography>

            {currentRide.customer?.phoneNumber && (
              <Button
                startIcon={<Phone />}
                variant="outlined"
                size="small"
                href={`tel:${currentRide.customer.phoneNumber}`}
                sx={{ mb: 2 }}
              >
                Call Customer
              </Button>
            )}

            <Stepper activeStep={activeStep} sx={{ mb: 2 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="body2">Fare</Typography>
              <Typography variant="h6" color="success.main">
                {formatCurrency(currentRide.fare)}
              </Typography>
            </Box>

            {currentRide.status === 'ACCEPTED' && (
              <Button
                fullWidth
                variant="contained"
                onClick={handleStartRide}
                disabled={loading}
                sx={{ mb: 1 }}
              >
                Arrived - Start Ride
              </Button>
            )}

            {currentRide.status === 'IN_PROGRESS' && (
              <Button
                fullWidth
                variant="contained"
                color="success"
                onClick={handleCompleteRide}
                disabled={loading}
                sx={{ mb: 1 }}
              >
                Complete Ride
              </Button>
            )}

            {currentRide.status !== 'IN_PROGRESS' && (
              <Button
                fullWidth
                variant="outlined"
                color="error"
                onClick={handleCancelRide}
                disabled={loading}
              >
                Cancel Ride
              </Button>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default ActiveRide;
