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
  AccountBalanceWalletRounded,
  ErrorRounded,
  HomeRounded,
  ReplayRounded,
  DirectionsCarRounded,
} from '@mui/icons-material';
import { useAppDispatch } from '../store/hooks';
import { showNotification } from '../store/ui.slice';
import { walletApi } from '../api/wallet.api';
import { formatCurrency } from '../utils/format.utils';

type CallbackState = 'processing' | 'success' | 'failed';

const REDIRECT_DELAY_SECONDS = 3;

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

const detectProvider = (params: URLSearchParams, fallbackProvider: string): string => {
  const explicit = (params.get('provider') || fallbackProvider || '').toUpperCase();
  if (explicit === 'MOMO' || explicit === 'VNPAY') {
    return explicit;
  }

  if (params.get('vnp_TmnCode') || params.get('vnp_TxnRef') || params.get('vnp_ResponseCode')) {
    return 'VNPAY';
  }

  if (params.get('resultCode') || params.get('orderId') || params.get('requestId') || params.get('transId')) {
    return 'MOMO';
  }

  return explicit;
};

const clearPendingTopUp = () => {
  sessionStorage.removeItem('wallet:pendingTopUpId');
  sessionStorage.removeItem('wallet:pendingTopUpProvider');
};

export default function WalletTopUpReturn() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const fallbackTopUpId = params.get('topUpId') || sessionStorage.getItem('wallet:pendingTopUpId') || '';
  const provider = useMemo(
    () => detectProvider(params, sessionStorage.getItem('wallet:pendingTopUpProvider') || ''),
    [params],
  );

  const [state, setState] = useState<CallbackState>('processing');
  const [message, setMessage] = useState('Đang xác thực kết quả nạp ví...');
  const [topUpId, setTopUpId] = useState(fallbackTopUpId);
  const [amount, setAmount] = useState<number | null>(null);
  const [newBalance, setNewBalance] = useState<number | null>(null);
  const [activated, setActivated] = useState(false);
  const [countdown, setCountdown] = useState(REDIRECT_DELAY_SECONDS);
  const countdownRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const resolveFromStatus = async () => {
      if (!fallbackTopUpId) {
        throw new Error('Không tìm thấy giao dịch nạp ví đang chờ xử lý.');
      }

      const response = await walletApi.getTopUpStatus(fallbackTopUpId);
      return {
        topUpId: response.data.data.topUpId,
        paid: response.data.data.status === 'COMPLETED',
        status: response.data.data.status,
        amount: response.data.data.amount,
        provider: response.data.data.provider,
        newBalance: undefined,
        activated: false,
        initialActivationCompleted: undefined,
        warningThresholdReached: undefined,
        message:
          response.data.data.status === 'COMPLETED'
            ? 'Nạp tiền thành công. Số dư ví của bạn đã được cập nhật.'
            : 'Giao dịch nạp ví chưa hoàn tất hoặc đã thất bại.',
      };
    };

    const run = async () => {
      try {
        let payload;
        const callbackParams = new URLSearchParams(params.toString());

        if (fallbackTopUpId && !callbackParams.get('topUpId')) {
          callbackParams.set('topUpId', fallbackTopUpId);
        }
        if (provider && !callbackParams.get('provider')) {
          callbackParams.set('provider', provider);
        }

        if (provider === 'MOMO' && (params.get('resultCode') || params.get('orderId') || params.get('requestId'))) {
          payload = (await walletApi.confirmMomoReturn(callbackParams)).data;
        } else if (provider === 'VNPAY' && (params.get('vnp_TmnCode') || params.get('vnp_ResponseCode') || params.get('vnp_TxnRef'))) {
          payload = (await walletApi.confirmVnpayReturn(callbackParams)).data;
        } else {
          payload = await resolveFromStatus();
        }

        if (cancelled) {
          return;
        }

        const resolvedTopUpId = payload.topUpId || fallbackTopUpId;
        if (resolvedTopUpId) {
          setTopUpId(resolvedTopUpId);
        }
        if (typeof payload.amount === 'number') {
          setAmount(payload.amount);
        }
        if (typeof payload.newBalance === 'number') {
          setNewBalance(payload.newBalance);
        }
        setActivated(Boolean(payload.activated));

        if (payload.paid || payload.status === 'COMPLETED') {
          const successMessage = payload.message || (
            payload.activated
              ? 'Nạp ví thành công'
              : (payload.initialActivationCompleted === false && typeof payload.newBalance === 'number' && payload.newBalance < 300_000
                ? 'Nạp ví thành công nhưng tài khoản vẫn chưa được kích hoạt. Vui lòng đạt mốc 300.000 đ để bật nhận cuốc.'
                : payload.warningThresholdReached
                  ? 'Nạp ví thành công. Tài khoản vẫn hoạt động nhưng số dư còn thấp, bạn nên nạp thêm để tránh bị khóa nhận cuốc.'
                : 'Nạp tiền thành công. Hệ thống đang cập nhật lại số dư ví cho bạn.')
          );
          clearPendingTopUp();
          setState('success');
          setMessage(successMessage);
          dispatch(showNotification({
            type: 'success',
            title: payload.activated ? 'Tài khoản đã kích hoạt' : 'Nạp ví thành công',
            message: successMessage,
            persistMs: 6000,
          }));
          return;
        }

        clearPendingTopUp();
        setState('failed');
        setMessage(payload.message || 'Giao dịch nạp ví chưa thành công hoặc đã bị hủy.');
        dispatch(showNotification({
          type: 'error',
          title: 'Nạp ví thất bại',
          message: payload.message || 'Giao dịch nạp ví chưa thành công hoặc đã bị hủy.',
          persistMs: 6000,
        }));
      } catch (error: any) {
        if (cancelled) {
          return;
        }

        try {
          const fallbackStatus = await resolveFromStatus();
          if (cancelled) {
            return;
          }

          setTopUpId(fallbackStatus.topUpId || fallbackTopUpId);
          setAmount(fallbackStatus.amount ?? null);

          if (fallbackStatus.paid) {
            clearPendingTopUp();
            setState('success');
            setMessage(fallbackStatus.message);
            dispatch(showNotification({
              type: 'success',
              title: 'Nạp ví thành công',
              message: fallbackStatus.message,
              persistMs: 6000,
            }));
            return;
          }
        } catch {
          // Ignore secondary lookup failure and surface the original error.
        }

        clearPendingTopUp();
        setState('failed');
        setMessage(error?.response?.data?.error?.message || 'Không thể xác thực kết quả nạp ví.');
        dispatch(showNotification({
          type: 'error',
          title: 'Nạp ví thất bại',
          message: error?.response?.data?.error?.message || 'Không thể xác thực kết quả nạp ví.',
          persistMs: 6000,
        }));
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [dispatch, fallbackTopUpId, params, provider]);

  useEffect(() => {
    if (state !== 'success') {
      return;
    }

    setCountdown(REDIRECT_DELAY_SECONDS);

    countdownRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) {
            window.clearInterval(countdownRef.current);
          }
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) {
        window.clearInterval(countdownRef.current);
      }
    };
  }, [state]);

  useEffect(() => {
    if (state === 'success' && countdown === 0) {
      navigate('/wallet', { replace: true });
    }
  }, [countdown, navigate, state]);

  const providerLabel = provider === 'MOMO' ? 'MoMo' : provider === 'VNPAY' ? 'VNPay' : provider;
  const providerCfg = PROVIDER_CONFIG[provider];
  const processingGradient = providerCfg?.accentGradient || 'linear-gradient(90deg, #1e40af, #3b82f6)';
  const processingColor = providerCfg?.accentColor || '#1e40af';

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
            FoxGo Driver
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
            Xác thực nạp ví
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
          <Box
            sx={{
              height: 5,
              background:
                state === 'success'
                  ? 'linear-gradient(90deg, #43a047, #66bb6a)'
                  : state === 'failed'
                  ? 'linear-gradient(90deg, #e53935, #ef9a9a)'
                  : processingGradient,
            }}
          />

          <Stack spacing={3} alignItems="center" textAlign="center" sx={{ p: 4 }}>
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
                    animation: 'topup-pulse 1.8s ease-in-out infinite',
                    '@keyframes topup-pulse': {
                      '0%, 100%': { boxShadow: `0 4px 20px ${processingColor}33` },
                      '50%': { boxShadow: `0 4px 32px ${processingColor}55` },
                    },
                  }),
                }}
              >
                {state === 'processing' && (
                  <CircularProgress size={40} thickness={3} sx={{ color: processingColor }} />
                )}
                {state === 'success' && (
                  <CheckCircleRounded sx={{ fontSize: 52, color: 'success.main' }} />
                )}
                {state === 'failed' && (
                  <ErrorRounded sx={{ fontSize: 52, color: 'error.main' }} />
                )}
              </Box>

              <Box>
                <Typography variant="h5" fontWeight={800} gutterBottom>
                  {state === 'processing' && 'Đang xử lý nạp ví...'}
                  {state === 'success' && 'Nạp ví thành công!'}
                  {state === 'failed' && 'Nạp ví thất bại'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  {message}
                </Typography>
              </Box>

              {providerLabel && (
                <Chip
                  label={`Qua ${providerLabel}`}
                  size="small"
                  variant="outlined"
                  color={state === 'success' ? 'success' : state === 'failed' ? 'error' : 'default'}
                  sx={{ fontWeight: 700 }}
                />
              )}

              {(topUpId || amount !== null) && (
                <>
                  <Divider sx={{ width: '100%' }} />
                  <Box sx={{ width: '100%', bgcolor: 'grey.50', borderRadius: 2, p: 1.75 }}>
                    <Stack spacing={1.25}>
                      {amount !== null && (
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <AccountBalanceWalletRounded color="primary" fontSize="small" />
                            <Typography variant="body2" color="text.secondary">Số tiền nạp</Typography>
                          </Stack>
                          <Typography variant="body1" fontWeight={800} color="success.main">
                            {formatCurrency(amount)}
                          </Typography>
                        </Stack>
                      )}
                      {newBalance !== null && state === 'success' && (
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                          <Typography variant="body2" color="text.secondary">Số dư mới</Typography>
                          <Typography variant="body1" fontWeight={800} color="primary.main">
                            {formatCurrency(newBalance)}
                          </Typography>
                        </Stack>
                      )}
                      {activated && state === 'success' && (
                        <Chip color="success" label="Tài khoản tài xế đã được kích hoạt"
                          sx={{ fontWeight: 700, alignSelf: 'flex-start' }} />
                      )}
                      {topUpId && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                            Mã giao dịch nạp ví
                          </Typography>
                          <Typography variant="body2" fontWeight={700}
                            sx={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.8rem' }}>
                            {topUpId}
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  </Box>
                </>
              )}

              {state === 'success' && countdown > 0 && (
                <Typography variant="caption" color="text.secondary">
                  Tự động quay về ví sau{' '}
                  <Box component="span" fontWeight={700} color="success.main">
                    {countdown}s
                  </Box>
                </Typography>
              )}

              <Stack spacing={1.5} sx={{ width: '100%', pt: 1 }}>
                {state === 'success' && (
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => navigate('/wallet', { replace: true })}
                    sx={{
                      borderRadius: 3,
                      fontWeight: 700,
                      py: 1.25,
                      background: 'linear-gradient(90deg, #43a047, #66bb6a)',
                      '&:hover': { background: 'linear-gradient(90deg, #388e3c, #43a047)' },
                    }}
                  >
                    Về ví ngay
                  </Button>
                )}

                {state === 'failed' && (
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<ReplayRounded />}
                    onClick={() => navigate('/wallet', { replace: true })}
                    sx={{ borderRadius: 3, fontWeight: 700, py: 1.25 }}
                    color="warning"
                  >
                    Quay lại ví để thử lại
                  </Button>
                )}

                <Button
                  variant="text"
                  size="medium"
                  startIcon={<HomeRounded />}
                  onClick={() => navigate('/dashboard', { replace: true })}
                  sx={{ borderRadius: 3, color: 'text.secondary', fontWeight: 600 }}
                >
                  Về dashboard
                </Button>
              </Stack>
          </Stack>
        </Box>
      </Fade>
      </Box>

      {/* ── Footer branding ── */}
      <Box sx={{ textAlign: 'center', py: 2 }}>
        <Typography variant="caption" color="text.disabled">
          FoxGo Driver · Ví tài xế
        </Typography>
      </Box>
    </Box>
  );
}
