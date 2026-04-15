import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Person,
  AccountCircle,
  Lock,
  Phone,
} from '@mui/icons-material';
import { useAppDispatch } from '../store/hooks';
import { setCredentials } from '../store/auth.slice';
import { authApi } from '../api/auth.api';

type Step = 'phone' | 'otp' | 'profile';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resendDelay, setResendDelay] = useState(0);

  useEffect(() => {
    if (resendDelay <= 0) {
      return;
    }

    const timer = setTimeout(() => setResendDelay((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendDelay]);

  const handleStartWithPhone = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const normalizedPhone = phone.replace(/\D/g, '').slice(0, 10);
    setPhone(normalizedPhone);

    if (!/^0\d{9}$/.test(normalizedPhone)) {
      setError('Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0');
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.registerPhoneStart({ phone: normalizedPhone });
      setResendDelay(response.data.resendDelay || 30);
      setSuccess(response.data.message || 'Mã OTP đã được gửi.');
      setStep('otp');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Không thể gửi OTP xác thực.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (otp.length !== 6) {
      setError('Vui lòng nhập đủ 6 chữ số OTP');
      return;
    }

    setLoading(true);
    try {
      await authApi.registerPhoneVerify({ phone, otp });
      setSuccess('Số điện thoại đã được xác thực.');
      setStep('profile');
    } catch (err: any) {
      const message = err.response?.data?.error?.message || 'OTP không hợp lệ hoặc đã hết hạn.';
      setError(message);
      setOtp('');
      if (message.includes('Quá nhiều') || message.includes('hết hạn')) {
        setResendDelay(0);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('Vui lòng nhập họ và tên');
      return;
    }
    if (formData.password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự');
      return;
    }
    if (!/[A-Z]/.test(formData.password)) {
      setError('Mật khẩu phải chứa ít nhất 1 chữ hoa (A-Z)');
      return;
    }
    if (!/[^A-Za-z0-9]/.test(formData.password)) {
      setError('Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt (!@#$%...)');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.registerPhoneComplete({
        phone,
        password: formData.password,
        role: 'CUSTOMER',
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
      });

      if (response.success) {
        dispatch(setCredentials(response.data));
        navigate('/home');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Hoàn tất đăng ký thất bại.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendDelay > 0) {
      return;
    }

    setError('');
    setLoading(true);
    try {
      const response = await authApi.registerPhoneStart({ phone });
      setResendDelay(response.data.resendDelay || 60);
      setOtp('');
      setSuccess(response.data.message || 'Mã OTP đã được gửi lại.');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Không thể gửi lại OTP.');
    } finally {
      setLoading(false);
    }
  };

  const titleByStep: Record<Step, string> = {
    phone: 'Đăng ký khách hàng',
    otp: 'Xác thực OTP',
    profile: 'Tạo tài khoản',
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Container maxWidth="sm">
        <Card
          elevation={10}
          sx={{
            borderRadius: 3,
          }}
        >
          <CardContent sx={{ p: 4 }}>
            <Stack spacing={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Person sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                <Typography variant="h4" fontWeight="bold" gutterBottom>
                  {titleByStep[step]}
                </Typography>
              </Box>

              {error && <Alert severity="error">{error}</Alert>}
              {success && step !== 'otp' && <Alert severity="success">{success}</Alert>}

              {step === 'phone' && (
                <form onSubmit={handleStartWithPhone}>
                  <Stack spacing={0}>
                    <TextField
                      fullWidth
                      label="Số điện thoại"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                      required
                      autoFocus
                      inputMode="numeric"
                      autoComplete="tel"
                      sx={{ mb: 3 }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Phone color="action" />
                          </InputAdornment>
                        ),
                      }}
                    />

                    <Button fullWidth type="submit" variant="contained" size="large" disabled={loading} sx={{ py: 1.5 }}>
                      {loading ? <CircularProgress size={24} /> : 'Tiếp tục'}
                    </Button>

                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
                      Đã có tài khoản?{' '}
                      <Link to="/login" style={{ color: '#1976d2', textDecoration: 'none', fontWeight: 700 }}>
                        Đăng nhập
                      </Link>
                    </Typography>
                  </Stack>
                </form>
              )}

              {step === 'otp' && (
                <form onSubmit={handleVerifyPhoneOtp}>
                  <Stack spacing={0}>
                    <Alert severity="info" sx={{ mb: 2 }}>{success || 'Mã OTP đã được gửi.'}</Alert>

                    <TextField
                      fullWidth
                      label="Mã OTP"
                      value={otp}
                      onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      autoFocus
                      inputMode="numeric"
                      sx={{ mb: 3 }}
                      inputProps={{ style: { letterSpacing: '0.35em', fontSize: '1.1rem', textAlign: 'center' } }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Lock color="action" />
                          </InputAdornment>
                        ),
                      }}
                    />

                    <Button fullWidth type="submit" variant="contained" size="large" disabled={loading} sx={{ py: 1.5 }}>
                      {loading ? <CircularProgress size={24} /> : 'Xác minh'}
                    </Button>

                    <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mt: 2 }}>
                      <Button variant="text" size="small" onClick={() => { setStep('phone'); setOtp(''); setError(''); setSuccess(''); }}>
                        Quay lại
                      </Button>
                      <Button variant="text" size="small" onClick={handleResendOtp} disabled={resendDelay > 0 || loading}>
                        {resendDelay > 0 ? `Gửi lại sau ${resendDelay}s` : 'Gửi lại OTP'}
                      </Button>
                    </Stack>
                  </Stack>
                </form>
              )}

              {step === 'profile' && (
                <form onSubmit={handleCompleteRegister}>
                  <Stack spacing={0}>
                    <TextField fullWidth label="Số điện thoại" value={phone} disabled sx={{ mb: 2 }} />

                    <TextField
                      fullWidth
                      label="Họ"
                      value={formData.lastName}
                      onChange={(event) => setFormData({ ...formData, lastName: event.target.value })}
                      required
                      autoFocus
                      sx={{ mb: 2 }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <AccountCircle color="action" />
                          </InputAdornment>
                        ),
                      }}
                    />

                    <TextField
                      fullWidth
                      label="Tên"
                      value={formData.firstName}
                      onChange={(event) => setFormData({ ...formData, firstName: event.target.value })}
                      required
                      sx={{ mb: 2 }}
                    />

                    <TextField
                      fullWidth
                      label="Mật khẩu"
                      type="password"
                      value={formData.password}
                      onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                      required
                      autoComplete="new-password"
                      sx={{ mb: 2 }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Lock color="action" />
                          </InputAdornment>
                        ),
                      }}
                    />

                    <TextField
                      fullWidth
                      label="Xác nhận mật khẩu"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(event) => setFormData({ ...formData, confirmPassword: event.target.value })}
                      required
                      autoComplete="new-password"
                      sx={{ mb: 3 }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Lock color="action" />
                          </InputAdornment>
                        ),
                      }}
                    />

                    <Button fullWidth type="submit" variant="contained" size="large" disabled={loading} sx={{ py: 1.5 }}>
                      {loading ? <CircularProgress size={24} /> : 'Tạo tài khoản'}
                    </Button>

                    <Button variant="text" size="small" sx={{ mt: 2 }} onClick={() => { setStep('otp'); setError(''); setSuccess(''); }}>
                      Quay lại
                    </Button>
                  </Stack>
                </form>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default Register;