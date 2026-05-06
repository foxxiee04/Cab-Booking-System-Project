import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Fade,
  Stack,
  Typography,
} from '@mui/material';
import {
  CheckCircleRounded,
  ErrorRounded,
  DirectionsCarRounded,
  HomeRounded,
  ReplayRounded,
} from '@mui/icons-material';
import { paymentApi } from '../api/payment.api';

type CallbackState = 'processing' | 'success' | 'failed';

const REDIRECT_DELAY_MS = 3000;

const PROVIDER_CONFIG: Record<string, { label: string; accentColor: string; accentGradient: string }> = {
  MOMO: {
    label: 'MoMo',
    accentColor: '#ae2070',
    accentGradient: 'linear-gradient(90deg, #ae2070, #d63384)',
  },
  VNPAY: {
    label: 'VNPay',
    accentColor: '#005baa',
    accentGradient: 'linear-gradient(90deg, #005baa, #0081d5)',
  },
};

const PaymentCallback: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const provider = useMemo(() => {
    const explicit = (params.get('provider') || '').toUpperCase();
    if (explicit === 'MOMO' || explicit === 'VNPAY') {
      return explicit;
    }

    if (params.get('vnp_TmnCode') || params.get('vnp_TxnRef') || params.get('vnp_ResponseCode')) {
      return 'VNPAY';
    }

    return explicit;
  }, [params]);

  const [state, setState] = useState<CallbackState>('processing');
  const [message, setMessage] = useState('Đang xác thực kết quả thanh toán...');
  const [rideId, setRideId] = useState(params.get('rideId') || '');
  const [countdown, setCountdown] = useState(REDIRECT_DELAY_MS / 1000);
  const countdownRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (provider !== 'MOMO' && provider !== 'VNPAY') {
        setState('failed');
        setMessage('Không xác định được cổng thanh toán trả về.');
        return;
      }

      try {
        const response = provider === 'MOMO'
          ? await paymentApi.confirmMomoReturn(params)
          : await paymentApi.confirmVnpayReturn(params);

        if (cancelled) return;

        const resolvedRideId = response.data?.rideId || params.get('rideId') || '';
        if (resolvedRideId) setRideId(resolvedRideId);

        if (response.data?.paid) {
          setState('success');
          setMessage('Thanh toán thành công. Hệ thống đang tìm tài xế cho bạn...');
        } else {
          setState('failed');
          setMessage(response.data?.message || 'Thanh toán chưa thành công hoặc đã bị hủy.');
        }
      } catch (error: any) {
        if (cancelled) return;
        setState('failed');
        setMessage(error?.response?.data?.error?.message || 'Không thể xác thực kết quả thanh toán.');
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [params, provider]);

  // Auto-redirect countdown on success
  useEffect(() => {
    if (state !== 'success' || !rideId) return;

    setCountdown(REDIRECT_DELAY_MS / 1000);

    countdownRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) window.clearInterval(countdownRef.current);
          navigate(`/ride/${rideId}`, { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) window.clearInterval(countdownRef.current);
    };
  }, [navigate, rideId, state]);

  const providerLabel = provider === 'MOMO' ? 'MoMo' : provider === 'VNPAY' ? 'VNPay' : provider;
  const providerCfg = PROVIDER_CONFIG[provider];
  const accentGradient = providerCfg?.accentGradient || 'linear-gradient(90deg, #1976d2, #42a5f5)';
  const accentColor = providerCfg?.accentColor || '#1976d2';

  const statusGradient =
    state === 'success'
      ? 'linear-gradient(90deg, #16a34a, #22c55e)'
      : state === 'failed'
      ? 'linear-gradient(90deg, #dc2626, #f87171)'
      : accentGradient;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#f8fafc',
      }}
    >
      {/* ── App header ── */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)',
          px: 3,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <DirectionsCarRounded sx={{ color: '#fff', fontSize: 20 }} />
        </Box>
        <Box>
          <Typography variant="subtitle1" fontWeight={800} color="#fff" lineHeight={1.2}>
            FoxGo
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
            Xác thực thanh toán
          </Typography>
        </Box>
      </Box>

      {/* ── Main content ── */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
          py: 4,
        }}
      >
        <Fade in timeout={500}>
          <Box
            sx={{
              width: '100%',
              maxWidth: 440,
              bgcolor: 'background.paper',
              borderRadius: 4,
              boxShadow: '0 4px 32px rgba(0,0,0,0.10)',
              overflow: 'hidden',
            }}
          >
            {/* Top accent */}
            <Box sx={{ height: 5, background: statusGradient }} />

            <Stack spacing={3} alignItems="center" textAlign="center" sx={{ p: 4 }}>
              {/* Status icon */}
              <Box
                sx={{
                  width: 88,
                  height: 88,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background:
                    state === 'success'
                      ? 'radial-gradient(circle, #dcfce7, #bbf7d0)'
                      : state === 'failed'
                      ? 'radial-gradient(circle, #fee2e2, #fecaca)'
                      : `radial-gradient(circle, ${accentColor}18, ${accentColor}30)`,
                  boxShadow:
                    state === 'success'
                      ? '0 4px 24px rgba(22,163,74,0.22)'
                      : state === 'failed'
                      ? '0 4px 24px rgba(220,38,38,0.22)'
                      : `0 4px 24px ${accentColor}33`,
                  ...(state === 'processing' && {
                    animation: 'pay-pulse 1.8s ease-in-out infinite',
                    '@keyframes pay-pulse': {
                      '0%, 100%': { boxShadow: `0 4px 20px ${accentColor}33` },
                      '50%': { boxShadow: `0 4px 32px ${accentColor}55` },
                    },
                  }),
                }}
              >
                {state === 'processing' && <CircularProgress size={40} thickness={3} sx={{ color: accentColor }} />}
                {state === 'success' && <CheckCircleRounded sx={{ fontSize: 52, color: '#16a34a' }} />}
                {state === 'failed' && <ErrorRounded sx={{ fontSize: 52, color: '#dc2626' }} />}
              </Box>

              {/* Title + message */}
              <Box>
                <Typography variant="h5" fontWeight={800} gutterBottom>
                  {state === 'processing' && 'Đang xử lý...'}
                  {state === 'success' && 'Thanh toán thành công!'}
                  {state === 'failed' && 'Thanh toán thất bại'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                  {message}
                </Typography>
              </Box>

              {/* Provider */}
              {providerLabel && (
                <Chip
                  label={`Qua ${providerLabel}`}
                  size="small"
                  variant="outlined"
                  color={state === 'success' ? 'success' : state === 'failed' ? 'error' : 'default'}
                  sx={{ fontWeight: 700 }}
                />
              )}

              {/* Ride ID */}
              {rideId && (
                <>
                  <Divider sx={{ width: '100%' }} />
                  <Box sx={{ width: '100%', bgcolor: '#f8fafc', borderRadius: 2, p: 1.75 }}>
                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                      Mã chuyến đi
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={700}
                      sx={{ fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all' }}
                    >
                      {rideId.toUpperCase()}
                    </Typography>
                  </Box>
                </>
              )}

              {/* Countdown */}
              {state === 'success' && rideId && countdown > 0 && (
                <Typography variant="caption" color="text.secondary">
                  Tự động chuyển sang chuyến đi sau{' '}
                  <Box component="span" fontWeight={800} color="success.main">{countdown}s</Box>
                </Typography>
              )}

              {/* Actions */}
              <Stack spacing={1.5} sx={{ width: '100%', pt: 0.5 }}>
                {state === 'success' && rideId && (
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<DirectionsCarRounded />}
                    onClick={() => navigate(`/ride/${rideId}`, { replace: true })}
                    sx={{
                      borderRadius: 3,
                      fontWeight: 700,
                      py: 1.25,
                      background: 'linear-gradient(90deg, #16a34a, #22c55e)',
                      '&:hover': { background: 'linear-gradient(90deg, #15803d, #16a34a)' },
                    }}
                  >
                    Theo dõi chuyến đi
                  </Button>
                )}

                {state === 'failed' && rideId && (
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<ReplayRounded />}
                    onClick={() =>
                      navigate(
                        `/ride/${rideId}?retryPayment=1&failedProvider=${provider || 'UNKNOWN'}`,
                        { replace: true },
                      )
                    }
                    sx={{ borderRadius: 3, fontWeight: 700, py: 1.25 }}
                    color="warning"
                  >
                    Thử lại phương thức khác
                  </Button>
                )}

                {state === 'failed' && rideId && (
                  <Button
                    variant="outlined"
                    size="medium"
                    onClick={() => navigate(`/ride/${rideId}`, { replace: true })}
                    sx={{ borderRadius: 3, fontWeight: 600 }}
                  >
                    Về trang chuyến đi
                  </Button>
                )}

                <Button
                  variant="text"
                  size="medium"
                  startIcon={<HomeRounded />}
                  onClick={() => navigate('/home', { replace: true })}
                  sx={{ borderRadius: 3, color: 'text.secondary', fontWeight: 600 }}
                >
                  Về trang chủ
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Fade>
      </Box>

      {/* ── Footer branding ── */}
      <Box sx={{ textAlign: 'center', py: 2 }}>
        <Typography variant="caption" color="text.disabled">
          FoxGo · Hệ thống đặt xe trực tuyến
        </Typography>
      </Box>
    </Box>
  );
};

export default PaymentCallback;
