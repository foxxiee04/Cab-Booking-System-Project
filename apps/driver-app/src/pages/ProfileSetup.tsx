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
  Description,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setProfile } from '../store/driver.slice';
import { driverApi } from '../api/driver.api';
import { VehicleType } from '../types';

const ProfileSetup: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const [formData, setFormData] = useState({
    vehicleType: 'ECONOMY' as VehicleType,
    vehicleMake: '',
    vehicleModel: '',
    vehicleColor: '',
    licensePlate: '',
    licenseNumber: '',
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
        throw new Error('User not authenticated');
      }

      const response = await driverApi.registerDriver({
        userId: user.id,
        ...formData,
      });

      if (response.success) {
        dispatch(setProfile(response.data.driver));
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Profile setup failed');
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
                Complete Your Profile
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tell us about your vehicle to start accepting rides
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
                    label="Vehicle Type"
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
                    <MenuItem value="ECONOMY">Economy (4 seats)</MenuItem>
                    <MenuItem value="COMFORT">Comfort (4 seats, premium)</MenuItem>
                    <MenuItem value="PREMIUM">Premium (luxury)</MenuItem>
                  </TextField>
                </Grid>

                {/* Vehicle Make & Model */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Vehicle Make"
                    value={formData.vehicleMake}
                    onChange={handleChange('vehicleMake')}
                    required
                    placeholder="e.g., Toyota, Honda, Hyundai"
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
                    label="Vehicle Model"
                    value={formData.vehicleModel}
                    onChange={handleChange('vehicleModel')}
                    required
                    placeholder="e.g., Vios, City, Accent"
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
                    label="Vehicle Color"
                    value={formData.vehicleColor}
                    onChange={handleChange('vehicleColor')}
                    required
                    placeholder="e.g., White, Silver, Black"
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
                    label="License Plate"
                    value={formData.licensePlate}
                    onChange={handleChange('licensePlate')}
                    required
                    placeholder="e.g., 29A-12345"
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
                    label="Driver License Number"
                    value={formData.licenseNumber}
                    onChange={handleChange('licenseNumber')}
                    required
                    placeholder="Your driving license number"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Badge />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
              </Grid>

              <Alert severity="info" sx={{ mt: 3 }}>
                <Typography variant="body2">
                  All information will be verified before you can accept rides.
                  Make sure all details are accurate.
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
                {loading ? <CircularProgress size={24} /> : 'Complete Profile'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default ProfileSetup;
