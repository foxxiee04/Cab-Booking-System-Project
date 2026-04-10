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
          setMessage('Thanh toán thành công! Hệ thống đang tìm tài xế cho bạn...');
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
  const processingGradient = providerCfg?.accentGradient || 'linear-gradient(90deg, #1976d2, #42a5f5)';
  const processingColor = providerCfg?.accentColor || '#1976d2';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          state === 'success'
            ? 'linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 50%, #e3f2fd 100%)'
            : state === 'failed'
            ? 'linear-gradient(135deg, #fce4ec 0%, #fff3e0 100%)'
            : 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)',
        px: 2,
      }}
    >
      <Fade in timeout={500}>
        <Box
          sx={{
            width: '100%',
            maxWidth: 420,
            bgcolor: 'background.paper',
            borderRadius: 5,
            boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
            overflow: 'hidden',
          }}
        >
          {/* Top accent bar */}
          <Box
            sx={{
              height: 6,
              background:
                state === 'success'
                  ? 'linear-gradient(90deg, #43a047, #66bb6a)'
                  : state === 'failed'
                  ? 'linear-gradient(90deg, #e53935, #ef9a9a)'
                  : processingGradient,
            }}
          />

          <Stack spacing={3} alignItems="center" textAlign="center" sx={{ p: 4 }}>
            {/* Icon */}
            <Box
              sx={{
                width: 88,
                height: 88,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor:
                  state === 'success'
                    ? 'success.50'
                    : state === 'failed'
                    ? 'error.50'
                    : 'primary.50',
                background:
                  state === 'success'
                    ? 'radial-gradient(circle, #e8f5e9, #c8e6c9)'
                    : state === 'failed'
                    ? 'radial-gradient(circle, #ffebee, #ffcdd2)'
                    : `radial-gradient(circle, ${processingColor}18, ${processingColor}30)`,
                boxShadow:
                  state === 'success'
                    ? '0 4px 20px rgba(67,160,71,0.25)'
                    : state === 'failed'
                    ? '0 4px 20px rgba(229,57,53,0.25)'
                    : `0 4px 20px ${processingColor}33`,
                ...(state === 'processing' && {
                  animation: 'callback-pulse 1.8s ease-in-out infinite',
                  '@keyframes callback-pulse': {
                    '0%, 100%': { boxShadow: `0 4px 20px ${processingColor}33` },
                    '50%': { boxShadow: `0 4px 32px ${processingColor}55` },
                  },
                }),
              }}
            >
              {state === 'processing' && <CircularProgress size={40} thickness={3} sx={{ color: processingColor }} />}
              {state === 'success' && (
                <CheckCircleRounded sx={{ fontSize: 52, color: 'success.main' }} />
              )}
              {state === 'failed' && (
                <ErrorRounded sx={{ fontSize: 52, color: 'error.main' }} />
              )}
            </Box>

            {/* Title */}
            <Box>
              <Typography variant="h5" fontWeight={800} gutterBottom>
                {state === 'processing' && 'Đang xử lý...'}
                {state === 'success' && 'Thanh toán thành công!'}
                {state === 'failed' && 'Thanh toán thất bại'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                {message}
              </Typography>
            </Box>

            {/* Provider chip */}
            {providerLabel && (
              <Chip
                label={`Qua ${providerLabel}`}
                size="small"
                variant="outlined"
                color={state === 'success' ? 'success' : state === 'failed' ? 'error' : 'default'}
                sx={{ fontWeight: 600 }}
              />
            )}

            {/* Ride ID */}
            {rideId && (
              <>
                <Divider sx={{ width: '100%' }} />
                <Box sx={{ width: '100%', bgcolor: 'grey.50', borderRadius: 2, p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    Mã chuyến đi
                  </Typography>
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      color: 'text.primary',
                      wordBreak: 'break-all',
                    }}
                  >
                    {rideId}
                  </Typography>
                </Box>
              </>
            )}

            {/* Countdown on success */}
            {state === 'success' && rideId && countdown > 0 && (
              <Typography variant="caption" color="text.secondary">
                Tự động chuyển sang trang chuyến đi sau{' '}
                <Box component="span" fontWeight={700} color="success.main">
                  {countdown}s
                </Box>
              </Typography>
            )}

            {/* Actions */}
            <Stack spacing={1.5} sx={{ width: '100%', pt: 1 }}>
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
                    background: 'linear-gradient(90deg, #43a047, #66bb6a)',
                    '&:hover': { background: 'linear-gradient(90deg, #388e3c, #43a047)' },
                  }}
                >
                  Xem chuyến đi ngay
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
                  Thử phương thức khác
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
                sx={{ borderRadius: 3, color: 'text.secondary' }}
              >
                Về trang chủ
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Fade>
    </Box>
  );
};

export default PaymentCallback;
