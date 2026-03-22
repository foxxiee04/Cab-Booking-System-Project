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
  InputAdornment,
  Divider,
} from '@mui/material';
import { DriveEta, Phone, Lock } from '@mui/icons-material';
import { authApi } from '../api/auth.api';

type Step = 'phone' | 'otp' | 'done';

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resendDelay, setResendDelay] = useState(0);

  useEffect(() => {
    if (resendDelay <= 0) return;
    const timer = setTimeout(() => setResendDelay((d) => d - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendDelay]);

  /** Step 1: Send OTP */
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^0\d{9}$/.test(phone)) {
      setError('Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.forgotPassword({ phone });
      setResendDelay(res.data.resendDelay || 30);
      setInfo(res.data.message || 'OTP đã gửi tới +84****xxx');
      setStep('otp');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Không thể gửi OTP. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  /** Step 2: Verify OTP + set new password */
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otp.length !== 6) {
      setError('Vui lòng nhập đủ 6 chữ số OTP');
      return;
    }
    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setError('Mật khẩu phải chứa ít nhất 1 chữ hoa (A-Z)');
      return;
    }
    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      setError('Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt (!@#$%...)');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword({ phone, otp, newPassword });
      setStep('done');
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Đặt lại mật khẩu thất bại.';
      setError(msg);
      setOtp('');
      if (msg.includes('Quá nhiều') || msg.includes('hết hạn')) {
        setResendDelay(0);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendDelay > 0) return;
    setError('');
    setLoading(true);
    try {
      const res = await authApi.forgotPassword({ phone });
      setResendDelay(res.data.resendDelay || 60);
      setOtp('');
      setInfo(res.data.message || 'OTP đã gửi tới +84****xxx');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Không thể gửi lại OTP.');
    } finally {
      setLoading(false);
    }
  };

  const stepTitle = step === 'phone'
    ? 'Quên mật khẩu'
    : step === 'otp'
    ? 'Nhập OTP & mật khẩu mới'
    : 'Đặt lại thành công';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #1976D2 0%, #2E7D32 100%)',
      }}
    >
      <Container maxWidth="sm">
        <Card elevation={10} sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <DriveEta sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                {stepTitle}
              </Typography>
              {step === 'phone' && (
                <Typography variant="body2" color="text.secondary">
                  Nhập số điện thoại để nhận OTP đặt lại mật khẩu
                </Typography>
              )}
              {step === 'otp' && (
                <Typography variant="body2" color="text.secondary">
                  Nhập OTP để xác nhận và đặt lại mật khẩu mới.
                </Typography>
              )}
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {info && <Alert severity="info" sx={{ mb: 2 }}>{info}</Alert>}

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
                  helperText="10 chữ số, bắt đầu bằng 0"
                />
                <Button fullWidth type="submit" variant="contained" size="large" disabled={loading} sx={{ py: 1.5, mb: 2 }}>
                  {loading ? <CircularProgress size={24} /> : 'Gửi OTP đặt lại mật khẩu'}
                </Button>
                <Box sx={{ textAlign: 'center' }}>
                  <Link to="/login" style={{ color: '#1976D2', textDecoration: 'none', fontSize: '0.875rem' }}>
                    ← Quay lại đăng nhập
                  </Link>
                </Box>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={handleResetPassword}>
                <TextField
                  fullWidth
                  label="Mã OTP (6 chữ số)"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="______"
                  required
                  autoFocus
                  inputMode="numeric"
                  sx={{ mb: 2 }}
                  inputProps={{ style: { letterSpacing: '0.3em', fontSize: '1.3rem', textAlign: 'center' } }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock />
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  fullWidth
                  label="Mật khẩu mới"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  sx={{ mb: 2 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock />
                      </InputAdornment>
                    ),
                  }}
                  helperText="Ít nhất 8 ký tự, 1 chữ hoa, 1 ký tự đặc biệt"
                />
                <TextField
                  fullWidth
                  label="Xác nhận mật khẩu mới"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  sx={{ mb: 3 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock />
                      </InputAdornment>
                    ),
                  }}
                />
                <Button fullWidth type="submit" variant="contained" size="large" disabled={loading} sx={{ py: 1.5, mb: 2 }}>
                  {loading ? <CircularProgress size={24} /> : 'Đặt lại mật khẩu'}
                </Button>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button variant="text" size="small" onClick={() => { setStep('phone'); setOtp(''); setError(''); setInfo(''); }}>
                    ← Quay lại
                  </Button>
                  <Button variant="text" size="small" onClick={handleResendOtp} disabled={resendDelay > 0 || loading}>
                    {resendDelay > 0 ? `Gửi lại (${resendDelay}s)` : 'Gửi lại OTP'}
                  </Button>
                </Box>
              </form>
            )}

            {step === 'done' && (
              <Box sx={{ textAlign: 'center' }}>
                <Alert severity="success" sx={{ mb: 3 }}>
                  Mật khẩu đã được đặt lại thành công! Vui lòng đăng nhập bằng mật khẩu mới.
                </Alert>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={() => navigate('/login')}
                  sx={{ py: 1.5 }}
                >
                  Đăng nhập ngay
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default ForgotPassword;
