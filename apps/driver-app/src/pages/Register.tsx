import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  InputAdornment,
  Divider,
} from '@mui/material';
import { DriveEta, Phone, Lock, Person } from '@mui/icons-material';
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
    if (resendDelay <= 0) return;
    const timer = setTimeout(() => setResendDelay((d) => d - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendDelay]);

  const handleStartWithPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const normalizedPhone = phone.replace(/\D/g, '').slice(0, 10);
    setPhone(normalizedPhone);

    if (!/^0\d{9}$/.test(normalizedPhone)) {
      setError('Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.registerPhoneStart({ phone: normalizedPhone });
      setResendDelay(res.data?.resendDelay || 30);
      setSuccess('');
      setStep('otp');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Không thể gửi OTP xác thực.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otp.length !== 6) {
      setError('Vui lòng nhập đủ 6 chữ số OTP');
      return;
    }

    setLoading(true);
    try {
      await authApi.registerPhoneVerify({ phone, otp });
      setSuccess('Số điện thoại đã được xác thực. Vui lòng điền thông tin tài khoản tài xế.');
      setStep('profile');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'OTP không hợp lệ hoặc đã hết hạn.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('Vui lòng nhập họ và tên');
      return;
    }
    if (formData.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
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
        role: 'DRIVER',
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
      });

      if (response.success && response.data) {
        dispatch(setCredentials(response.data));
        navigate('/profile-setup');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Hoàn tất đăng ký thất bại.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendDelay > 0) return;
    setError('');
    setLoading(true);
    try {
      const res = await authApi.registerPhoneStart({ phone });
      setResendDelay(res.data?.resendDelay || 60);
      setOtp('');
      setSuccess('');
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
        background: 'linear-gradient(135deg, #1976d2 0%, #2e7d32 100%)',
        py: 3,
      }}
    >
      <Container maxWidth="sm">
        <Card elevation={6} sx={{ borderRadius: 4 }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <DriveEta sx={{ fontSize: 56, color: 'primary.main' }} />
              <Typography variant="h3" fontWeight="bold" color="text.primary" mt={1} sx={{ fontSize: { xs: '2rem', sm: '2.5rem' } }}>
                {step === 'phone' && 'Đăng ký Tài Xế'}
                {step === 'otp' && 'Xác minh SĐT'}
                {step === 'profile' && 'Thông tin tài xế'}
              </Typography>
              <Typography variant="h6" color="text.secondary" mt={1}>
                {step === 'phone' && 'Bước 1: Nhập số điện thoại để nhận OTP'}
                {step === 'otp' && `Bước 2: Xác minh OTP gửi đến ${phone}`}
                {step === 'profile' && 'Bước 3: Hoàn tất hồ sơ tài khoản'}
              </Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
            {success && step !== 'otp' && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}

            {step === 'phone' && (
              <form onSubmit={handleStartWithPhone}>
                <TextField
                  fullWidth
                  label="Số điện thoại"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="0912345678"
                  required
                  autoFocus
                  inputMode="numeric"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Phone color="action" />
                      </InputAdornment>
                    ),
                  }}
                  helperText="10 chữ số, bắt đầu bằng 0"
                />

                <Button fullWidth type="submit" variant="contained" size="large" disabled={loading} sx={{ mt: 3, mb: 2, py: 1.8, fontSize: '1.2rem', fontWeight: 600, borderRadius: 2 }}>
                  {loading ? <CircularProgress size={28} color="inherit" /> : 'Gửi OTP xác thực'}
                </Button>

                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body1" color="text.secondary">
                    Đã có tài khoản?{' '}
                    <Link to="/login" style={{ color: '#1976d2', textDecoration: 'none', fontWeight: 600 }}>
                      Đăng nhập
                    </Link>
                  </Typography>
                </Box>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={handleVerifyPhoneOtp}>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Mã OTP đã được gửi đến <strong>{phone}</strong>. Mã có hiệu lực trong 5 phút.
                </Alert>

                <TextField
                  fullWidth
                  label="Mã OTP (6 chữ số)"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="______"
                  required
                  autoFocus
                  inputMode="numeric"
                  sx={{ mb: 3 }}
                  inputProps={{ style: { letterSpacing: '0.35em', fontSize: '1.3rem', textAlign: 'center' } }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock color="action" />
                      </InputAdornment>
                    ),
                  }}
                />

                <Button fullWidth type="submit" variant="contained" size="large" disabled={loading} sx={{ mb: 2, py: 1.8, fontSize: '1.1rem', fontWeight: 600, borderRadius: 2 }}>
                  {loading ? <CircularProgress size={28} color="inherit" /> : 'Xác minh số điện thoại'}
                </Button>

                <Divider sx={{ mb: 2 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button variant="text" size="small" onClick={() => { setStep('phone'); setOtp(''); setError(''); setSuccess(''); }}>
                    ← Quay lại
                  </Button>
                  <Button variant="text" size="small" onClick={handleResendOtp} disabled={resendDelay > 0 || loading}>
                    {resendDelay > 0 ? `Gửi lại (${resendDelay}s)` : 'Gửi lại OTP'}
                  </Button>
                </Box>
              </form>
            )}

            {step === 'profile' && (
              <form onSubmit={handleCompleteRegister}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Họ"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      required
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Person color="action" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Tên"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      required
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Mật khẩu"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Lock color="action" />
                          </InputAdornment>
                        ),
                      }}
                      helperText="Ít nhất 6 ký tự"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Xác nhận mật khẩu"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      required
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Lock color="action" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                </Grid>

                <Button fullWidth type="submit" variant="contained" size="large" disabled={loading} sx={{ mt: 3, mb: 2, py: 1.8, fontSize: '1.2rem', fontWeight: 600, borderRadius: 2 }}>
                  {loading ? <CircularProgress size={28} color="inherit" /> : 'Hoàn tất đăng ký'}
                </Button>

                <Button variant="text" size="small" onClick={() => { setStep('otp'); setError(''); setSuccess(''); }}>
                  ← Quay lại bước OTP
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default Register;