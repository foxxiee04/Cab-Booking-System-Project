import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Typography,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { rideApi } from '../api/ride.api';
import { clearRide, setCurrentRide } from '../store/ride.slice';
import MapView from '../components/map/MapView';
import PickupMarker from '../components/map/PickupMarker';
import DropoffMarker from '../components/map/DropoffMarker';
import DriverMarker from '../components/map/DriverMarker';
import RouteLine from '../components/map/RouteLine';
import {
  formatCurrency,
  formatDate,
  getRideStatusColor,
  getRideStatusLabel,
  getVehicleTypeLabel,
  getPaymentMethodLabel,
} from '../utils/format.utils';
import { useTranslation } from 'react-i18next';

const RideTracking: React.FC = () => {
  const { rideId } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const { currentRide, driver } = useAppSelector((state) => state.ride);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchRide = async () => {
      if (!rideId) return;
      if (currentRide?.id === rideId) return;

      setLoading(true);
      setError('');
      try {
        const response = await rideApi.getRide(rideId);
        dispatch(setCurrentRide(response.data.ride));
      } catch (err: any) {
        setError(err.response?.data?.error?.message || t('errors.loadRide'));
      } finally {
        setLoading(false);
      }
    };

    fetchRide();
  }, [dispatch, rideId, currentRide?.id]);

  const handleCancel = async () => {
    if (!currentRide) return;
    try {
      await rideApi.cancelRide(currentRide.id, 'Customer cancelled');
      dispatch(clearRide());
      navigate('/home');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('errors.cancelRide'));
    }
  };

  const mapCenter = useMemo(() => {
    if (driver?.currentLocation) return driver.currentLocation;
    if (currentRide?.pickup) return currentRide.pickup;
    if (currentRide?.dropoff) return currentRide.dropoff;
    return { lat: 10.762622, lng: 106.660172 };
  }, [driver?.currentLocation, currentRide?.pickup, currentRide?.dropoff]);

  const showRouteToPickup =
    currentRide?.status === 'PENDING' ||
    currentRide?.status === 'ASSIGNED' ||
    currentRide?.status === 'ACCEPTED';

  const showRouteToDropoff = currentRide?.status === 'IN_PROGRESS';

  return (
    <Container sx={{ py: 3 }}>
      <Typography variant="h4" fontWeight="bold">
        {t('rideTracking.title')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mt: 2, height: 420, borderRadius: 2, overflow: 'hidden' }}>
        <MapView center={mapCenter} height="100%">
          {currentRide?.pickup && <PickupMarker location={currentRide.pickup} />}
          {currentRide?.dropoff && <DropoffMarker location={currentRide.dropoff} />}
          {driver && <DriverMarker driver={driver} />}
          {driver?.currentLocation && currentRide?.pickup && showRouteToPickup && (
            <RouteLine from={driver.currentLocation} to={currentRide.pickup} />
          )}
          {driver?.currentLocation && currentRide?.dropoff && showRouteToDropoff && (
            <RouteLine from={driver.currentLocation} to={currentRide.dropoff} color="#4CAF50" />
          )}
        </MapView>
      </Box>

      {loading && (
        <Box sx={{ mt: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {currentRide && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">{t('rideTracking.details')}</Typography>
              <Chip
                label={getRideStatusLabel(currentRide.status)}
                sx={{ bgcolor: getRideStatusColor(currentRide.status), color: '#fff' }}
              />
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="body2" color="text.secondary">
              {t('rideTracking.rideId')}: {currentRide.id}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('rideTracking.requested')}: {formatDate(currentRide.requestedAt)}
            </Typography>

            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2">{t('rideTracking.pickup')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {currentRide.pickup?.address ||
                  (currentRide.pickup ? `${currentRide.pickup.lat}, ${currentRide.pickup.lng}` : t('common.na'))}
              </Typography>
            </Box>

            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2">{t('rideTracking.dropoff')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {currentRide.dropoff?.address ||
                  (currentRide.dropoff ? `${currentRide.dropoff.lat}, ${currentRide.dropoff.lng}` : t('common.na'))}
              </Typography>
            </Box>

            <Box sx={{ mt: 2, display: 'grid', gap: 1 }}>
              <Typography variant="body2">
                {t('rideTracking.vehicle')}: {getVehicleTypeLabel(currentRide.vehicleType)}
              </Typography>
              <Typography variant="body2">
                {t('rideTracking.payment')}: {getPaymentMethodLabel(currentRide.paymentMethod)}
              </Typography>
              <Typography variant="body2">
                {t('rideTracking.fare')}: {currentRide.fare ? formatCurrency(currentRide.fare) : t('common.pending')}
              </Typography>
            </Box>

            {driver && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2">{t('rideTracking.driver')}</Typography>
                <Typography variant="body2">
                  {driver.firstName} {driver.lastName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {driver.vehicleMake} {driver.vehicleModel} • {driver.licensePlate}
                </Typography>
              </Box>
            )}

            {currentRide.status !== 'COMPLETED' && currentRide.status !== 'CANCELLED' && (
              <Button
                variant="outlined"
                color="error"
                sx={{ mt: 3 }}
                onClick={handleCancel}
              >
                {t('rideTracking.cancelRide')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </Container>
  );
};

export default RideTracking;
