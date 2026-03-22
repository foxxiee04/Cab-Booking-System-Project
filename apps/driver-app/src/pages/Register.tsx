import React, { useState, useEffect } from 'react';
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
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '../store/hooks';
import { setCredentials } from '../store/auth.slice';
import { authApi } from '../api/auth.api';

type Step = 'form' | 'otp';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>('form');
  const [formData, setFormData] = useState({ firstName: '', lastName: '', phone: '' });
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resendDelay, setResendDelay] = useState(0);

  useEffect(() => {
    if (resendDelay <= 0) return;
    const timer = setTimeout(() => setResendDelay((d) => d - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendDelay]);

  const handleChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = field === 'phone' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value;
    setFormData({ ...formData, [field]: value });
  };

  const handleRegisterAndSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('Vui lòng nhập họ và tên');
      return;
    }
    if (!/^0\d{9}$/.test(formData.phone)) {
      setError('Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0');
      return;
    }
    setLoading(true);
    try {
      await authApi.register({ phone: formData.phone, role: 'DRIVER', firstName: formData.firstName.trim(), lastName: formData.lastName.trim() });
      const otpRes = await authApi.sendOtp({ phone: formData.phone });
      setResendDelay(otpRes.data.resendDelay || 30);
      setSuccess('Tài khoản đã được tạo! Nhập OTP để xác minh.');
      setStep('otp');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otp.length !== 6) { setError('Vui lòng nhập đủ 6 chữ số OTP'); return; }
    setLoading(true);
    try {
      const response = await authApi.verifyOtp({ phone: formData.phone, otp });
      if (response.success) {
        dispatch(setCredentials(response.data));
        navigate('/profile-setup');
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
      const res = await authApi.sendOtp({ phone: formData.phone });
      setResendDelay(res.data.resendDelay || 60);
      setOtp('');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Không thể gửi lại OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', py: 4 }}>
      <Container maxWidth="sm">
        <Card elevation={10} sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <DriveEta sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                {step === 'form' ? 'Đăng ký Tài Xế' : 'Xác minh số điện thoại'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {step === 'form' ? 'Tạo tài khoản tài xế ngay hôm nay' : `Nhập mã OTP gửi đến ${formData.phone}`}
              </Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

            {step === 'form' && (
              <form onSubmit={handleRegisterAndSendOtp}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth label="Họ" value={formData.lastName} onChange={handleChange('lastName')} required
                      InputProps={{ startAdornment: <InputAdornment position="start"><Person /></InputAdornment> }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth label="Tên" value={formData.firstName} onChange={handleChange('firstName')} required autoFocus
                      InputProps={{ startAdornment: <InputAdornment position="start"><Person /></InputAdornment> }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth label="Số điện thoại" value={formData.phone} onChange={handleChange('phone')}
                      placeholder="0912345678" required inputMode="numeric"
                      InputProps={{ startAdornment: <InputAdornment position="start"><Phone /></InputAdornment> }}
                      helperText="10 chữ số, bắt đầu bằng 0"
                    />
                  </Grid>
                </Grid>
                <Button fullWidth type="submit" variant="contained" size="large" disabled={loading} sx={{ py: 1.5, mt: 3 }}>
                  {loading ? <CircularProgress size={24} /> : 'Đăng ký & Gửi OTP'}
                </Button>
                <Box sx={{ textAlign: 'center', mt: 3 }}>
                  <Typography variant="body2">
                    Đã có tài khoản?{' '}
                    <Link to="/login" style={{ color: '#1976D2', textDecoration: 'none' }}>Đăng nhập</Link>
                  </Typography>
                </Box>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={handleVerifyOtp}>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Mã OTP đã gửi đến <strong>{formData.phone}</strong>. Hiệu lực 5 phút.
                </Alert>
                <TextField
                  fullWidth label="Mã OTP (6 chữ số)" value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="______" required autoFocus inputMode="numeric" sx={{ mb: 3 }}
                  inputProps={{ style: { letterSpacing: '0.3em', fontSize: '1.3rem', textAlign: 'center' } }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Lock /></InputAdornment> }}
                />
                <Button fullWidth type="submit" variant="contained" size="large" disabled={loading} sx={{ py: 1.5, mb: 2 }}>
                  {loading ? <CircularProgress size={24} /> : 'Xác minh & Đăng nhập'}
                </Button>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button variant="text" size="small" onClick={() => { setStep('form'); setOtp(''); setError(''); setSuccess(''); }}>
                    ← Quay lại
                  </Button>
                  <Button variant="text" size="small" onClick={handleResendOtp} disabled={resendDelay > 0 || loading}>
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

export default Register;

