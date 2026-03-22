import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { CheckCircleRounded, ErrorRounded } from '@mui/icons-material';
import { paymentApi } from '../api/payment.api';

type CallbackState = 'processing' | 'success' | 'failed';

const PaymentCallback: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const [state, setState] = useState<CallbackState>('processing');
  const [message, setMessage] = useState('Đang xác thực kết quả thanh toán từ cổng sandbox...');
  const [rideId, setRideId] = useState(params.get('rideId') || '');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const provider = (params.get('provider') || '').toUpperCase();

      if (provider !== 'MOMO' && provider !== 'VNPAY') {
        setState('failed');
        setMessage('Không xác định được cổng thanh toán trả về.');
        return;
      }

      try {
        const response = provider === 'MOMO'
          ? await paymentApi.confirmMomoReturn(params)
          : await paymentApi.confirmVnpayReturn(params);

        if (cancelled) {
          return;
        }

        const resolvedRideId = response.data?.rideId || params.get('rideId') || '';
        if (resolvedRideId) {
          setRideId(resolvedRideId);
        }

        if (response.data?.paid) {
          setState('success');
          setMessage('Thanh toán thành công. Bạn có thể quay lại màn hình theo dõi chuyến.');
        } else {
          setState('failed');
          setMessage(response.data?.message || 'Thanh toán chưa thành công hoặc đã bị hủy.');
        }
      } catch (error: any) {
        if (cancelled) {
          return;
        }

        setState('failed');
        setMessage(error?.response?.data?.error?.message || 'Không thể xác thực callback thanh toán.');
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [params]);

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Stack spacing={2} alignItems="center" textAlign="center">
            {state === 'processing' && <CircularProgress />}
            {state === 'success' && <CheckCircleRounded color="success" sx={{ fontSize: 44 }} />}
            {state === 'failed' && <ErrorRounded color="error" sx={{ fontSize: 44 }} />}

            <Typography variant="h6" fontWeight={800}>
              Kết quả thanh toán
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {message}
            </Typography>

            {rideId && (
              <Alert severity="info" sx={{ width: '100%' }}>
                Mã chuyến: {rideId}
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 1.5, width: '100%', justifyContent: 'center' }}>
              {rideId && (
                <Button variant="contained" onClick={() => navigate(`/ride/${rideId}`, { replace: true })}>
                  Về trang chuyến đi
                </Button>
              )}
              <Button variant="outlined" onClick={() => navigate('/home', { replace: true })}>
                Về trang chủ
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
};

export default PaymentCallback;
