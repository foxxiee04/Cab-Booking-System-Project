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
  Snackbar,
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
import { DriverRegistration, VehicleType } from '../types';
import { useTranslation } from 'react-i18next';

const VEHICLE_OPTIONS_BY_TYPE: Record<VehicleType, Record<string, string[]>> = {
  MOTORBIKE: {
    Honda: ['Wave Alpha', 'Winner X', 'Blade'],
    Yamaha: ['Sirius', 'Exciter', 'Jupiter'],
    Suzuki: ['Raider', 'Axelo'],
    SYM: ['Elegant', 'Galaxy'],
  },
  SCOOTER: {
    Honda: ['Vision', 'Air Blade', 'Lead', 'SH Mode'],
    Yamaha: ['Janus', 'FreeGo', 'Grande'],
    Piaggio: ['Liberty', 'Medley'],
    VinFast: ['Evo200', 'Klara S2'],
  },
  CAR_4: {
    Toyota: ['Vios', 'Corolla Altis', 'Yaris Cross'],
    Hyundai: ['Accent', 'Elantra'],
    Kia: ['K3', 'Seltos'],
    Honda: ['City', 'Civic'],
    Mazda: ['Mazda2', 'Mazda3'],
    VinFast: ['VF e34', 'VF 6'],
  },
  CAR_7: {
    Toyota: ['Innova', 'Fortuner'],
    Hyundai: ['Stargazer', 'Santa Fe'],
    Mitsubishi: ['Xpander', 'Pajero Sport'],
    Ford: ['Everest', 'Tourneo'],
    Kia: ['Carens', 'Sorento'],
  },
};

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  MOTORBIKE: 'Xe máy (số)',
  SCOOTER: 'Xe ga',
  CAR_4: 'Ô tô 4 chỗ',
  CAR_7: 'Ô tô 7 chỗ',
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

const formatLicenseNumberInput = (rawValue: string) => {
  const digits = rawValue.replace(/\D/g, '').slice(0, 12);
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
};

const ProfileSetup: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const minExpiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const [formData, setFormData] = useState({
    vehicleType: 'CAR_4' as VehicleType,
    vehicleMake: '',
    vehicleModel: '',
    vehicleColor: '',
    vehicleYear: currentYear,
    licensePlate: '',
    licenseNumber: '',
    licenseExpiryDate: '',
  });
  const vehicleYearOptions = Array.from({ length: currentYear - 2014 + 2 }, (_, index) => currentYear + 1 - index);
  const availableMakes = Object.keys(VEHICLE_OPTIONS_BY_TYPE[formData.vehicleType]);
  const availableModels = VEHICLE_OPTIONS_BY_TYPE[formData.vehicleType][formData.vehicleMake] || [];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    // vehicleYear comes from a MUI Select so e.target.value is already a number.
    const nextValue = field === 'vehicleYear'
      ? Number(e.target.value)
      : field === 'licenseNumber'
        ? formatLicenseNumberInput(e.target.value)
      : e.target.value;

    setFormData({ ...formData, [field]: nextValue });
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleVehicleMakeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextMake = e.target.value;
    const nextModels = VEHICLE_OPTIONS_BY_TYPE[formData.vehicleType][nextMake] || [];

    setFormData((prev) => ({
      ...prev,
      vehicleMake: nextMake,
      vehicleModel: nextModels.includes(prev.vehicleModel) ? prev.vehicleModel : '',
    }));
    setFieldErrors((prev) => ({ ...prev, vehicleMake: '', vehicleModel: '' }));
  };

  const handleVehicleTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextType = e.target.value as DriverRegistration['vehicleType'];
    const makes = Object.keys(VEHICLE_OPTIONS_BY_TYPE[nextType]);
    const firstMake = makes[0] || '';
    const modelsForFirstMake = VEHICLE_OPTIONS_BY_TYPE[nextType][firstMake] || [];

    setFormData((prev) => ({
      ...prev,
      vehicleType: nextType,
      vehicleMake: makes.includes(prev.vehicleMake) ? prev.vehicleMake : firstMake,
      vehicleModel: makes.includes(prev.vehicleMake)
        ? (VEHICLE_OPTIONS_BY_TYPE[nextType][prev.vehicleMake] || []).includes(prev.vehicleModel)
          ? prev.vehicleModel
          : (VEHICLE_OPTIONS_BY_TYPE[nextType][prev.vehicleMake] || [])[0] || ''
        : modelsForFirstMake[0] || '',
    }));

    setFieldErrors((prev) => ({ ...prev, vehicleType: '', vehicleMake: '', vehicleModel: '' }));
  };

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    const normalizedPlate = formData.licensePlate.trim().toUpperCase();
    const normalizedLicense = formData.licenseNumber.trim();
    const licenseDigits = normalizedLicense.replace(/\s+/g, '');
    const plateRegex = /^\d{2}[A-Z]{1,2}-?\d{4,5}$/;
    const licenseRegex = /^\d{3}\s\d{3}\s\d{3}\s\d{3}$/;

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

    if (!licenseRegex.test(normalizedLicense) || licenseDigits.length !== 12) {
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

      const payload: DriverRegistration = {
        ...formData,
        licenseNumber: formData.licenseNumber.replace(/\s+/g, ''),
      };

      const response = await driverApi.registerDriver(payload);

      if (response.success) {
        dispatch(setProfile(response.data.driver));
        setSnackbarOpen(true);
        setTimeout(() => navigate('/dashboard'), 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('errors.profileSetupFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
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
                    onChange={handleVehicleTypeChange}
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <DirectionsCar />
                        </InputAdornment>
                      ),
                    }}
                  >
                    <MenuItem value="MOTORBIKE">{VEHICLE_TYPE_LABELS.MOTORBIKE}</MenuItem>
                    <MenuItem value="SCOOTER">{VEHICLE_TYPE_LABELS.SCOOTER}</MenuItem>
                    <MenuItem value="CAR_4">{VEHICLE_TYPE_LABELS.CAR_4}</MenuItem>
                    <MenuItem value="CAR_7">{VEHICLE_TYPE_LABELS.CAR_7}</MenuItem>
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
                    {availableMakes.map((make) => (
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
                    placeholder="052 042 424 424"
                    inputProps={{ maxLength: 15, inputMode: 'numeric' }}
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

    <Snackbar
      open={snackbarOpen}
      autoHideDuration={3000}
      onClose={() => setSnackbarOpen(false)}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        onClose={() => setSnackbarOpen(false)}
        severity="success"
        variant="filled"
        sx={{ width: '100%', borderRadius: 3 }}
      >
        {t('profileSetup.successMessage')}
      </Alert>
    </Snackbar>
    </>
  );
};

export default ProfileSetup;
