import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import {
  CheckCircleRounded,
  ErrorRounded,
  HourglassTopRounded,
} from '@mui/icons-material';
import { walletApi } from '../api/wallet.api';
import { formatCurrency } from '../utils/format.utils';

type Phase = 'polling' | 'success' | 'failed' | 'timeout';

const MAX_POLLS = 20;        // up to 20 × 1.5 s = 30 s
const POLL_INTERVAL_MS = 1500;

export default function WalletTopUpReturn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const topUpId  = searchParams.get('topUpId')  || sessionStorage.getItem('wallet:pendingTopUpId') || '';
  const provider = (searchParams.get('provider') ?? sessionStorage.getItem('wallet:pendingTopUpProvider') ?? '').toUpperCase();

  const [phase, setPhase]   = useState<Phase>('polling');
  const [amount, setAmount] = useState<number | null>(null);
  const pollCount           = useRef(0);

  useEffect(() => {
    if (!topUpId) {
      setPhase('failed');
      return;
    }

    // Clean up sessionStorage now that we have the topUpId
    sessionStorage.removeItem('wallet:pendingTopUpId');
    sessionStorage.removeItem('wallet:pendingTopUpProvider');

    const poll = async () => {
      try {
        const res = await walletApi.getTopUpStatus(topUpId);
        const { status, amount: amt } = res.data.data;
        setAmount(amt);

        if (status === 'COMPLETED') {
          setPhase('success');
          return;
        }
        if (status === 'FAILED') {
          setPhase('failed');
          return;
        }

        // Still PENDING
        pollCount.current += 1;
        if (pollCount.current >= MAX_POLLS) {
          setPhase('timeout');
          return;
        }
        setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        pollCount.current += 1;
        if (pollCount.current >= MAX_POLLS) {
          setPhase('timeout');
          return;
        }
        setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    poll();
  }, [topUpId]);

  const providerLabel = provider === 'MOMO' ? 'MoMo' : provider === 'VNPAY' ? 'VNPay' : provider;

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card
        elevation={0}
        sx={{ maxWidth: 380, width: '100%', borderRadius: 4, border: '1px solid', borderColor: 'divider' }}
      >
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          {phase === 'polling' && (
            <Stack alignItems="center" spacing={2}>
              <CircularProgress size={56} thickness={4} />
              <Typography variant="h6" fontWeight={700}>
                Đang xác nhận thanh toán
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Đang chờ xác nhận từ {providerLabel}…
              </Typography>
            </Stack>
          )}

          {phase === 'success' && (
            <Stack alignItems="center" spacing={2}>
              <CheckCircleRounded sx={{ fontSize: 64, color: 'success.main' }} />
              <Typography variant="h6" fontWeight={700} color="success.main">
                Nạp tiền thành công!
              </Typography>
              {amount !== null && (
                <Typography variant="body1" color="text.secondary">
                  <strong>{formatCurrency(amount)}</strong> đã được cộng vào ví của bạn qua {providerLabel}.
                </Typography>
              )}
              <Button
                variant="contained"
                color="success"
                fullWidth
                sx={{ mt: 1, borderRadius: 3, fontWeight: 700 }}
                onClick={() => navigate('/wallet')}
              >
                Về trang ví
              </Button>
            </Stack>
          )}

          {(phase === 'failed' || phase === 'timeout') && (
            <Stack alignItems="center" spacing={2}>
              {phase === 'timeout' ? (
                <HourglassTopRounded sx={{ fontSize: 64, color: 'warning.main' }} />
              ) : (
                <ErrorRounded sx={{ fontSize: 64, color: 'error.main' }} />
              )}
              <Typography
                variant="h6"
                fontWeight={700}
                color={phase === 'timeout' ? 'warning.main' : 'error.main'}
              >
                {phase === 'timeout' ? 'Chưa xác nhận được' : 'Thanh toán thất bại'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {phase === 'timeout'
                  ? 'Hệ thống chưa nhận được xác nhận từ cổng thanh toán. Nếu tiền đã bị trừ, vui lòng liên hệ hỗ trợ.'
                  : 'Giao dịch không thành công hoặc đã bị huỷ.'}
              </Typography>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                sx={{ mt: 1, borderRadius: 3, fontWeight: 700 }}
                onClick={() => navigate('/wallet')}
              >
                Về trang ví
              </Button>
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
