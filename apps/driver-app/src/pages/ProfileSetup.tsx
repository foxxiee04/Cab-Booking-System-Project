import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Grid,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import {
  DirectionsCar,
  Badge,
  ColorLens,
  LocalOffer,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setProfile } from '../store/driver.slice';
import { driverApi } from '../api/driver.api';
import { VehicleType } from '../types';
import { useTranslation } from 'react-i18next';

const ProfileSetup: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    vehicleType: 'ECONOMY' as VehicleType,
    vehicleMake: '',
    vehicleModel: '',
    vehicleColor: '',
    licensePlate: '',
    licenseNumber: '',
    licenseExpiryDate: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!user) {
        throw new Error(t('errors.authRequired'));
      }

      const response = await driverApi.registerDriver(formData);

      if (response.success) {
        dispatch(setProfile(response.data.driver));
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('errors.profileSetupFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #1976D2 0%, #2E7D32 100%)',
        py: 4,
      }}
    >
      <Container maxWidth="md">
        <Card elevation={10} sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 4 }}>
            {/* Header */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <DirectionsCar sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                {t('profileSetup.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('profileSetup.subtitle')}
              </Typography>
            </Box>

            {/* Error message */}
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {/* Profile form */}
            <form onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                {/* Vehicle Type */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    select
                    label={t('profileSetup.vehicleType')}
                    value={formData.vehicleType}
                    onChange={handleChange('vehicleType')}
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <DirectionsCar />
                        </InputAdornment>
                      ),
                    }}
                  >
                    <MenuItem value="ECONOMY">{t('vehicle.ECONOMY')} (4 chỗ)</MenuItem>
                    <MenuItem value="COMFORT">{t('vehicle.COMFORT')} (4 chỗ, cao cấp)</MenuItem>
                    <MenuItem value="PREMIUM">{t('vehicle.PREMIUM')} (sang trọng)</MenuItem>
                  </TextField>
                </Grid>

                {/* Vehicle Make & Model */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label={t('profileSetup.vehicleMake')}
                    value={formData.vehicleMake}
                    onChange={handleChange('vehicleMake')}
                    required
                    placeholder="VD: Toyota, Honda, Hyundai"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <DirectionsCar />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label={t('profileSetup.vehicleModel')}
                    value={formData.vehicleModel}
                    onChange={handleChange('vehicleModel')}
                    required
                    placeholder="VD: Vios, City, Accent"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <DirectionsCar />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                {/* Vehicle Color & License Plate */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label={t('profileSetup.vehicleColor')}
                    value={formData.vehicleColor}
                    onChange={handleChange('vehicleColor')}
                    required
                    placeholder="VD: Trắng, Bạc, Đen"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <ColorLens />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label={t('profileSetup.licensePlate')}
                    value={formData.licensePlate}
                    onChange={handleChange('licensePlate')}
                    required
                    placeholder="VD: 29A-12345"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LocalOffer />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                {/* Driver License Number */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label={t('profileSetup.licenseNumber')}
                    value={formData.licenseNumber}
                    onChange={handleChange('licenseNumber')}
                    required
                    placeholder="Số giấy phép lái xe"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Badge />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                {/* License Expiry Date */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label={t('profileSetup.licenseExpiry')}
                    type="date"
                    value={formData.licenseExpiryDate}
                    onChange={handleChange('licenseExpiryDate')}
                    required
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>

              <Alert severity="info" sx={{ mt: 3 }}>
                <Typography variant="body2">
                  {t('profileSetup.info')}
                </Typography>
              </Alert>

              <Button
                fullWidth
                type="submit"
                variant="contained"
                size="large"
                disabled={loading}
                sx={{ py: 1.5, mt: 3 }}
              >
                {loading ? <CircularProgress size={24} /> : t('profileSetup.submit')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default ProfileSetup;
