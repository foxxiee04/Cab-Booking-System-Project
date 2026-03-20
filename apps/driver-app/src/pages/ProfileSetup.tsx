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

const VEHICLE_MAKE_OPTIONS = [
  'Toyota',
  'Hyundai',
  'Kia',
  'Honda',
  'Mazda',
  'Mitsubishi',
  'VinFast',
  'Ford',
];

const VEHICLE_MODEL_OPTIONS: Record<string, string[]> = {
  Toyota: ['Vios', 'Innova', 'Corolla Cross', 'Avanza Premio'],
  Hyundai: ['Accent', 'Grand i10', 'Elantra', 'Stargazer'],
  Kia: ['Morning', 'Soluto', 'K3', 'Carens'],
  Honda: ['City', 'Civic', 'BR-V', 'CR-V'],
  Mazda: ['Mazda2', 'Mazda3', 'CX-3', 'CX-5'],
  Mitsubishi: ['Attrage', 'Xpander', 'Xforce'],
  VinFast: ['VF e34', 'VF 5', 'VF 6', 'VF 7'],
  Ford: ['EcoSport', 'Territory', 'Everest'],
};

const VEHICLE_COLOR_OPTIONS = [
  'Trắng',
  'Đen',
  'Bạc',
  'Xám',
  'Đỏ',
  'Xanh dương',
  'Xanh lá',
  'Vàng',
];

const ProfileSetup: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const minExpiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    vehicleType: 'ECONOMY' as VehicleType,
    vehicleMake: '',
    vehicleModel: '',
    vehicleColor: '',
    vehicleYear: currentYear,
    licensePlate: '',
    licenseNumber: '',
    licenseExpiryDate: '',
  });
  const vehicleYearOptions = Array.from({ length: currentYear - 2014 + 2 }, (_, index) => currentYear + 1 - index);
  const availableModels = VEHICLE_MODEL_OPTIONS[formData.vehicleMake] || [];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    // vehicleYear comes from a MUI Select so e.target.value is already a number.
    const nextValue = field === 'vehicleYear'
      ? Number(e.target.value)
      : e.target.value;

    setFormData({ ...formData, [field]: nextValue });
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleVehicleMakeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextMake = e.target.value;
    const nextModels = VEHICLE_MODEL_OPTIONS[nextMake] || [];

    setFormData((prev) => ({
      ...prev,
      vehicleMake: nextMake,
      vehicleModel: nextModels.includes(prev.vehicleModel) ? prev.vehicleModel : '',
    }));
    setFieldErrors((prev) => ({ ...prev, vehicleMake: '', vehicleModel: '' }));
  };

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    const normalizedPlate = formData.licensePlate.trim().toUpperCase();
    const normalizedLicense = formData.licenseNumber.trim().toUpperCase();
    const plateRegex = /^\d{2}[A-Z]{1,2}-?\d{4,5}$/;
    // Vietnamese GPLX is exactly 12 digits
    const licenseRegex = /^\d{12}$/

    if (formData.vehicleMake.trim().length < 2) {
      nextErrors.vehicleMake = t('errors.vehicleMakeInvalid');
    }

    if (formData.vehicleModel.trim().length < 2) {
      nextErrors.vehicleModel = t('errors.vehicleModelInvalid');
    }

    if (formData.vehicleColor.trim().length < 2) {
      nextErrors.vehicleColor = t('errors.vehicleColorInvalid');
    }

    if (!Number.isInteger(formData.vehicleYear) || formData.vehicleYear < 1990 || formData.vehicleYear > currentYear + 1) {
      nextErrors.vehicleYear = t('errors.vehicleYearInvalid');
    }

    if (!plateRegex.test(normalizedPlate)) {
      nextErrors.licensePlate = t('errors.licensePlateInvalid');
    }

    if (!licenseRegex.test(normalizedLicense)) {
      nextErrors.licenseNumber = t('errors.licenseNumberInvalid');
    }

    if (!formData.licenseExpiryDate || formData.licenseExpiryDate < minExpiryDate) {
      nextErrors.licenseExpiryDate = t('errors.licenseExpiryPast');
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    try {
      if (!user) {
        throw new Error(t('errors.authRequired'));
      }

      const response = await driverApi.registerDriver(formData);

      if (response.success) {
        dispatch(setProfile(response.data.driver));
        // Show success and inform about approval process
        alert(t('profileSetup.successMessage'));
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
                    select
                    label={t('profileSetup.vehicleMake')}
                    value={formData.vehicleMake}
                    onChange={handleVehicleMakeChange}
                    required
                    error={Boolean(fieldErrors.vehicleMake)}
                    helperText={fieldErrors.vehicleMake}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <DirectionsCar />
                        </InputAdornment>
                      ),
                    }}
                  >
                    {VEHICLE_MAKE_OPTIONS.map((make) => (
                      <MenuItem key={make} value={make}>
                        {make}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    label={t('profileSetup.vehicleModel')}
                    value={formData.vehicleModel}
                    onChange={handleChange('vehicleModel')}
                    required
                    disabled={!formData.vehicleMake}
                    error={Boolean(fieldErrors.vehicleModel)}
                    helperText={fieldErrors.vehicleModel || (!formData.vehicleMake ? 'Chọn hãng xe trước' : '')}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <DirectionsCar />
                        </InputAdornment>
                      ),
                    }}
                  >
                    {availableModels.map((model) => (
                      <MenuItem key={model} value={model}>
                        {model}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                {/* Vehicle Color & License Plate */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    label={t('profileSetup.vehicleColor')}
                    value={formData.vehicleColor}
                    onChange={handleChange('vehicleColor')}
                    required
                    error={Boolean(fieldErrors.vehicleColor)}
                    helperText={fieldErrors.vehicleColor}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <ColorLens />
                        </InputAdornment>
                      ),
                    }}
                  >
                    {VEHICLE_COLOR_OPTIONS.map((color) => (
                      <MenuItem key={color} value={color}>
                        {color}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    label={t('profileSetup.vehicleYear')}
                    value={formData.vehicleYear}
                    onChange={handleChange('vehicleYear')}
                    required
                    error={Boolean(fieldErrors.vehicleYear)}
                    helperText={fieldErrors.vehicleYear}
                  >
                    {vehicleYearOptions.map((year) => (
                      <MenuItem key={year} value={year}>
                        {year}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label={t('profileSetup.licensePlate')}
                    value={formData.licensePlate}
                    onChange={handleChange('licensePlate')}
                    required
                    error={Boolean(fieldErrors.licensePlate)}
                    helperText={fieldErrors.licensePlate}
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
                    error={Boolean(fieldErrors.licenseNumber)}
                    helperText={fieldErrors.licenseNumber}
                    placeholder="123456789012"
                    inputProps={{ maxLength: 12, inputMode: 'numeric' }}
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
                    error={Boolean(fieldErrors.licenseExpiryDate)}
                    helperText={fieldErrors.licenseExpiryDate}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ min: minExpiryDate }}
                  />
                </Grid>
              </Grid>

              <Alert severity="info" sx={{ mt: 3 }}>
                <Typography variant="body2">
                  {t('profileSetup.info')}
                </Typography>
              </Alert>

              <Alert severity="success" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  {t('profileSetup.vehiclePhotoHint')}
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
