import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Container,
  Typography,
  CircularProgress,
  Alert,
  Divider,
  Button,
} from '@mui/material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { authApi } from '../api/auth.api';
import { updateUser } from '../store/auth.slice';
import { useTranslation } from 'react-i18next';

const Profile: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refreshProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await authApi.getMe();
      if (response.success) {
        dispatch(updateUser(response.data.user));
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('errors.loadProfile'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();
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

      {user && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6">
              {user.firstName} {user.lastName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {user.email}
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2">{t('profile.role')}: {user.role}</Typography>
            {user.phoneNumber && (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {t('profile.phone')}: {user.phoneNumber}
              </Typography>
            )}
            <Button variant="outlined" sx={{ mt: 2 }} onClick={refreshProfile}>
              {t('profile.refresh')}
            </Button>
          </CardContent>
        </Card>
      )}
    </Container>
  );
};

export default Profile;
