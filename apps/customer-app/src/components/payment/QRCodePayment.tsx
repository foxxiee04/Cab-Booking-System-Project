import React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import {
  OpenInNew as OpenIcon,
  Close as CloseIcon,
  QrCode2 as QrIcon,
} from '@mui/icons-material';

export interface QRCodePaymentProps {
  paymentUrl: string;
  paymentMethod: 'MOMO' | 'VNPAY';
  amount: number;
  orderId: string;
  rideId: string;
  deeplink?: string;
  qrCodeUrl?: string;
  onContinue?: () => void;
  onCancel?: () => void;
}

const IDBlock: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box>
    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
      {label}
    </Typography>
    <Typography
      variant="body2"
      fontFamily="monospace"
      sx={{ wordBreak: 'break-all', bgcolor: 'action.hover', px: 1, py: 0.5, borderRadius: 1 }}
    >
      {value}
    </Typography>
  </Box>
);

export const QRCodePayment: React.FC<QRCodePaymentProps> = ({
  paymentUrl,
  paymentMethod,
  amount,
  orderId,
  rideId,
  deeplink,
  qrCodeUrl,
  onContinue,
  onCancel,
}) => {
  const methodLabel = paymentMethod === 'MOMO' ? 'MoMo' : 'VNPay';
  const methodIcon = paymentMethod === 'MOMO' ? '💰' : '🏧';
  const openUrl = deeplink || paymentUrl;

  return (
    <>
      <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
        <CardContent>
          <Stack spacing={3}>
            {/* Header */}
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" fontWeight={800} gutterBottom>
                {methodIcon} Thanh toán qua {methodLabel}
              </Typography>
              <Chip label="Sandbox" size="small" color="warning" sx={{ mb: 1 }} />
              <Typography variant="h4" color="success.main" fontWeight={800}>
                {amount.toLocaleString('vi-VN')} ₫
              </Typography>
            </Box>

            <Divider />

            {/* QR Code image (when available) */}
            {qrCodeUrl && (
              <Box sx={{ textAlign: 'center' }}>
                <Box
                  component="img"
                  src={qrCodeUrl}
                  alt="QR thanh toán"
                  sx={{ width: 200, height: 200, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                />
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                  Quét mã QR bằng app {methodLabel}
                </Typography>
              </Box>
            )}

            {/* Payment detail rows */}
            <Alert severity="info" icon={<QrIcon fontSize="small" />} sx={{ bgcolor: 'rgba(25, 118, 210, 0.08)' }}>
              <Typography variant="body2" fontWeight={700} gutterBottom>
                Thông tin thanh toán
              </Typography>
              <Stack spacing={1.5}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary" flexShrink={0}>
                    Cổng thanh toán
                  </Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {methodLabel} Sandbox
                  </Typography>
                </Box>
                <Divider />
                <IDBlock label="Mã chuyến đi (Ride ID)" value={rideId} />
                {orderId !== rideId && <IDBlock label="Mã đơn hàng (Order ID)" value={orderId} />}
              </Stack>
            </Alert>

            {!qrCodeUrl && (
              <Typography variant="body2" color="text.secondary" textAlign="center">
                Nhấn <strong>Tiếp tục thanh toán</strong> để chuyển sang giao diện sandbox của {methodLabel}.
              </Typography>
            )}

            <Divider />

            {/* Action Buttons */}
            <Stack direction="row" spacing={2}>
              <Button
                fullWidth
                variant="outlined"
                onClick={onCancel}
                startIcon={<CloseIcon />}
              >
                Hủy
              </Button>
              <Button
                fullWidth
                variant="contained"
                color="success"
                onClick={onContinue || (() => {
                  window.location.href = openUrl;
                })}
                startIcon={<OpenIcon />}
              >
                {qrCodeUrl ? 'Mở app thanh toán' : 'Tiếp tục thanh toán'}
              </Button>
            </Stack>

            {/* Footer Info */}
            <Alert severity="info" icon={false} sx={{ bgcolor: 'rgba(25, 118, 210, 0.05)' }}>
              <Typography variant="caption" display="block">
                Sau khi thanh toán xong trên cổng {methodLabel} sandbox, hệ thống sẽ tự động xác thực và quay lại trang chuyến đi.
              </Typography>
            </Alert>
          </Stack>
        </CardContent>
      </Card>
    </>
  );
};

export default QRCodePayment;
