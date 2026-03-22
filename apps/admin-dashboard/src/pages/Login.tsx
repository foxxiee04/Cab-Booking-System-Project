import React, { useState, useEffect } from 'react';
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
  InputAdornment,
  Divider,
} from '@mui/material';
import { AdminPanelSettings, Phone, Lock } from '@mui/icons-material';
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

  useEffect(() => {
    if (resendDelay <= 0) return;
    const timer = setTimeout(() => setResendDelay((d) => d - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendDelay]);

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

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otp.length !== 6) { setError('Vui lòng nhập đủ 6 chữ số OTP'); return; }
    setLoading(true);
    try {
      const response = await authApi.verifyOtp({ phone, otp });
      if (response.success) {
        if (response.data.user.role !== 'ADMIN') {
          setError('Tài khoản này không có quyền truy cập trang quản trị.');
          return;
        }
        dispatch(setCredentials(response.data));
        navigate('/dashboard');
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
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Container maxWidth="sm">
        <Card elevation={10} sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <AdminPanelSettings sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                {step === 'phone' ? 'Quản trị viên' : `OTP gửi đến ${phone}`}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {step === 'phone' ? 'Đăng nhập bằng số điện thoại quản trị' : 'Nhập mã 6 chữ số để tiếp tục'}
              </Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {step === 'phone' && (
              <form onSubmit={handleSendOtp}>
                <TextField
                  fullWidth
                  label="Số điện thoại"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="0912345678"
                  required
                  autoFocus
                  inputMode="numeric"
                  sx={{ mb: 3 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Phone />
                      </InputAdornment>
                    ),
                  }}
                />
                <Button fullWidth type="submit" variant="contained" size="large" disabled={loading} sx={{ py: 1.5 }}>
                  {loading ? <CircularProgress size={24} /> : 'Gửi mã OTP'}
                </Button>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={handleVerifyOtp}>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Mã OTP đã gửi đến <strong>{phone}</strong>. Hiệu lực 5 phút.
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
                  inputProps={{ style: { letterSpacing: '0.3em', fontSize: '1.3rem', textAlign: 'center' } }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock />
                      </InputAdornment>
                    ),
                  }}
                />
                <Button fullWidth type="submit" variant="contained" size="large" disabled={loading} sx={{ py: 1.5, mb: 2 }}>
                  {loading ? <CircularProgress size={24} /> : 'Xác minh & Đăng nhập'}
                </Button>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button variant="text" size="small" onClick={() => { setStep('phone'); setOtp(''); setError(''); }}>
                    ← Đổi số điện thoại
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

export default Login;
