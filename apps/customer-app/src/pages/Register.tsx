import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Container,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  CircularProgress,
  Grid,
} from '@mui/material';
import { Visibility, VisibilityOff, DirectionsCar } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { authApi } from '../api/auth.api';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const validateForm = (): string | null => {
    if (
      !formData.email ||
      !formData.password ||
      !formData.firstName ||
      !formData.lastName ||
      !formData.phoneNumber
    ) {
      return t('errors.fillRequired');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return t('errors.invalidEmail');
    }

    if (formData.password.length < 8) {
      return t('errors.passwordMin');
    }

    if (!/[A-Z]/.test(formData.password)) {
      return t('errors.passwordUpper');
    }

    if (!/[a-z]/.test(formData.password)) {
      return t('errors.passwordLower');
    }

    if (!/[0-9]/.test(formData.password)) {
      return t('errors.passwordNumber');
    }

    if (formData.password !== formData.confirmPassword) {
      return t('errors.passwordMismatch');
    }

    const phoneRegex = /^[0-9]{10,15}$/;
    if (!phoneRegex.test(formData.phoneNumber)) {
      return t('errors.phoneInvalid');
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const response = await authApi.register({
        email: formData.email,
        password: formData.password,
        phone: formData.phoneNumber,
        role: 'CUSTOMER',
        firstName: formData.firstName,
        lastName: formData.lastName,
      });

      if (response.success) {
        setSuccess(t('errors.registerSuccess'));
        navigate('/login');
      }
    } catch (err: any) {
      const message = err.response?.data?.error?.message || t('errors.registerFailed');
      setError(message);
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
        background: 'linear-gradient(135deg, #2E7D32 0%, #1976D2 100%)',
        py: 4,
      }}
    >
      <Container maxWidth="md">
        <Card elevation={4}>
          <CardContent sx={{ p: 4 }}>
            {/* Logo */}
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <DirectionsCar sx={{ fontSize: 50, color: 'primary.main' }} />
              <Typography variant="h4" fontWeight="bold" color="primary" mt={1}>
                {t('register.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={1}>
                {t('register.subtitle')}
              </Typography>
            </Box>

            {/* Error Alert */}
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            {success && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {success}
              </Alert>
            )}

            {/* Registration Form */}
            <form onSubmit={handleSubmit}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label={t('register.firstName')}
                    value={formData.firstName}
                    onChange={handleChange('firstName')}
                    required
                    autoComplete="given-name"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label={t('register.lastName')}
                    value={formData.lastName}
                    onChange={handleChange('lastName')}
                    required
                    autoComplete="family-name"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label={t('register.email')}
                    type="email"
                    value={formData.email}
                    onChange={handleChange('email')}
                    required
                    autoComplete="email"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label={t('register.phone')}
                    value={formData.phoneNumber}
                    onChange={handleChange('phoneNumber')}
                    autoComplete="tel"
                    placeholder="0123456789"
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label={t('register.password')}
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleChange('password')}
                    required
                    autoComplete="new-password"
                    helperText={t('register.passwordHelp')}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label={t('register.confirmPassword')}
                    type={showPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleChange('confirmPassword')}
                    required
                    autoComplete="new-password"
                  />
                </Grid>
              </Grid>

              <Button
                fullWidth
                type="submit"
                variant="contained"
                size="large"
                disabled={loading}
                sx={{ mt: 3, mb: 2, py: 1.5 }}
              >
                {loading ? <CircularProgress size={24} /> : t('register.createAccount')}
              </Button>

              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {t('register.haveAccount')}{' '}
                  <Link
                    to="/login"
                    style={{ color: '#2E7D32', textDecoration: 'none', fontWeight: 600 }}
                  >
                    {t('register.signIn')}
                  </Link>
                </Typography>
              </Box>
            </form>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default Register;
