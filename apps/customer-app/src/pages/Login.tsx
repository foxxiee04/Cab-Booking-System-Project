import React, { useState, useEffect } from 'react';
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
  CircularProgress,
  Divider,
} from '@mui/material';
import { DirectionsCar, Phone, Lock } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '../store/hooks';
import { setCredentials } from '../store/auth.slice';
import { authApi } from '../api/auth.api';

type Step = 'phone' | 'otp';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendDelay, setResendDelay] = useState(0);

  // Countdown for resend OTP delay
  useEffect(() => {
    if (resendDelay <= 0) return;
    const timer = setTimeout(() => setResendDelay((d) => d - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendDelay]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
  };

  /** Step 1: Request OTP */
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!/^0\d{9}$/.test(phone)) {
      setError('Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.sendOtp({ phone });
      setResendDelay(res.data.resendDelay || 30);
      setStep('otp');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Không thể gửi OTP. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  /** Step 2: Verify OTP and login */
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otp.length !== 6) {
      setError('Vui lòng nhập đủ 6 chữ số OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.verifyOtp({ phone, otp });
      if (response.success) {
        dispatch(setCredentials(response.data));
        navigate('/home');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'OTP không hợp lệ hoặc đã hết hạn.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendDelay > 0) return;
    setError('');
    setLoading(true);
    try {
      const res = await authApi.sendOtp({ phone });
      setResendDelay(res.data.resendDelay || 60);
      setOtp('');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Không thể gửi lại OTP.');
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
      }}
    >
      <Container maxWidth="sm">
        <Card elevation={4}>
          <CardContent sx={{ p: 4 }}>
            {/* Logo */}
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <DirectionsCar sx={{ fontSize: 60, color: 'primary.main' }} />
              <Typography variant="h4" fontWeight="bold" color="primary" mt={1}>
                {t('app.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={1}>
                {step === 'phone' ? 'Đăng nhập bằng số điện thoại' : `Nhập mã OTP gửi đến ${phone}`}
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {/* Step 1: Phone input */}
            {step === 'phone' && (
              <form onSubmit={handleSendOtp}>
                <TextField
                  fullWidth
                  label="Số điện thoại"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="0912345678"
                  required
                  autoFocus
                  inputMode="numeric"
                  sx={{ mb: 3 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Phone color="action" />
                      </InputAdornment>
                    ),
                  }}
                  helperText="Nhập số điện thoại 10 chữ số (VD: 0912345678)"
                />

                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading}
                  sx={{ mb: 2, py: 1.5 }}
                >
                  {loading ? <CircularProgress size={24} /> : 'Gửi mã OTP'}
                </Button>

                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Chưa có tài khoản?{' '}
                    <Link to="/register" style={{ color: '#2E7D32', textDecoration: 'none', fontWeight: 600 }}>
                      Đăng ký ngay
                    </Link>
                  </Typography>
                </Box>
              </form>
            )}

            {/* Step 2: OTP input */}
            {step === 'otp' && (
              <form onSubmit={handleVerifyOtp}>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Mã OTP đã được gửi đến <strong>{phone}</strong>. Mã có hiệu lực trong 5 phút.
                </Alert>

                <TextField
                  fullWidth
                  label="Mã OTP (6 chữ số)"
                  value={otp}
                  onChange={handleOtpChange}
                  placeholder="______"
                  required
                  autoFocus
                  inputMode="numeric"
                  sx={{ mb: 3 }}
                  inputProps={{ style: { letterSpacing: '0.3em', fontSize: '1.3rem', textAlign: 'center' } }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock color="action" />
                      </InputAdornment>
                    ),
                  }}
                />

                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading}
                  sx={{ mb: 2, py: 1.5 }}
                >
                  {loading ? <CircularProgress size={24} /> : 'Xác minh OTP'}
                </Button>

                <Divider sx={{ mb: 2 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
                  >
                    ← Đổi số điện thoại
                  </Button>
                  <Button
                    variant="text"
                    size="small"
                    onClick={handleResendOtp}
                    disabled={resendDelay > 0 || loading}
                  >
                    {resendDelay > 0 ? `Gửi lại (${resendDelay}s)` : 'Gửi lại OTP'}
                  </Button>
                </Box>
              </form>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default Login;

