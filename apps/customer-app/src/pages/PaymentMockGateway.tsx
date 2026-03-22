import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  Typography,
} from '@mui/material';

const PaymentMockGateway: React.FC = () => {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const provider = (params.get('provider') || '').toUpperCase();
  const rideId = params.get('rideId') || '';
  const amount = params.get('amount') || '0';

  const buildCallbackUrl = (paid: boolean) => {
    const callbackParams = new URLSearchParams({
      provider,
      rideId,
      mock: '1',
      paid: String(paid),
      message: paid ? 'Mock payment success' : 'Mock payment failed',
    });

    if (provider === 'MOMO') {
      callbackParams.set('resultCode', paid ? '0' : '1005');
      callbackParams.set('orderId', rideId);
      callbackParams.set('transactionId', `MOMO_MOCK_${Date.now()}`);
    }

    if (provider === 'VNPAY') {
      callbackParams.set('vnp_TxnRef', rideId.replace(/-/g, '').slice(0, 8).toUpperCase());
      callbackParams.set('vnp_Amount', String(Math.round(Number(amount) * 100)));
      callbackParams.set('vnp_TransactionNo', `${Date.now()}`);
      callbackParams.set('transactionId', `VNPAY_MOCK_${Date.now()}`);
    }

    return `/payment/callback?${callbackParams.toString()}`;
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5" fontWeight={800} textAlign="center">
              Mock Gateway {provider || 'Payment'}
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Môi trường hiện chưa có credential sandbox thật. Trang này mô phỏng cổng thanh toán để kiểm thử browser end-to-end.
            </Typography>

            <Alert severity="info">
              Ride: {rideId || 'N/A'}
              <br />
              Amount: {amount} VND
            </Alert>

            <Box sx={{ display: 'grid', gap: 1.5 }}>
              <Button variant="contained" color="success" href={buildCallbackUrl(true)}>
                Mô phỏng thanh toán thành công
              </Button>
              <Button variant="contained" color="error" href={buildCallbackUrl(false)}>
                Mô phỏng thanh toán thất bại
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
};

export default PaymentMockGateway;
