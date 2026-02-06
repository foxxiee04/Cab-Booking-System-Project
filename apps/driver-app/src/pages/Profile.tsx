import React, { useEffect, useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Divider,
  Button,
} from '@mui/material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { driverApi } from '../api/driver.api';
import { setProfile } from '../store/driver.slice';
import { useTranslation } from 'react-i18next';

const Profile: React.FC = () => {
  const dispatch = useAppDispatch();
  const { profile } = useAppSelector((state) => state.driver);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await driverApi.getProfile();
      dispatch(setProfile(response.data.driver));
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('errors.loadProfile'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight="bold">
        {t('profile.title')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box sx={{ mt: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {profile && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6">{t('profile.driverProfile')}</Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2">{t('profile.vehicle')}: {profile.vehicleMake} {profile.vehicleModel}</Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {t('profile.plate')}: {profile.licensePlate}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {t('profile.color')}: {profile.vehicleColor}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {t('profile.rating')}: {profile.rating.toFixed(1)} ({profile.totalRides} {t('dashboard.rides')})
            </Typography>
            <Button variant="outlined" sx={{ mt: 2 }} onClick={fetchProfile}>
              {t('profile.refresh')}
            </Button>
          </CardContent>
        </Card>
      )}
    </Container>
  );
};

export default Profile;
