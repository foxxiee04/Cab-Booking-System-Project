import React, { useEffect, useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  Stack,
} from '@mui/material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { driverApi } from '../api/driver.api';
import { setEarnings } from '../store/driver.slice';
import { formatCurrency, formatDate, getPaymentMethodLabel, getVehicleTypeLabel } from '../utils/format.utils';
import { useTranslation } from 'react-i18next';

const EARNINGS_CHART_HEIGHT = 180;

const Earnings: React.FC = () => {
  const dispatch = useAppDispatch();
  const { earnings } = useAppSelector((state) => state.driver);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEarnings = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await driverApi.getEarnings();
        dispatch(setEarnings(response.data.earnings));
      } catch (err: any) {
        setError(err.response?.data?.error?.message || t('errors.loadEarnings'));
      } finally {
        setLoading(false);
      }
    };

    fetchEarnings();
  }, [dispatch, t]);

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight="bold">
        {t('earnings.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        Thu nhập hiển thị là phần thực nhận sau hoa hồng nền tảng. Báo cáo chi tiết từng cuốc ở bên dưới.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box sx={{ mt: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {earnings && (
        <Box sx={{ mt: 2, display: 'grid', gap: 2 }}>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Thực nhận hôm nay
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {formatCurrency(earnings.today)}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Thực nhận 7 ngày
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {formatCurrency(earnings.week)}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Thực nhận tháng này
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {formatCurrency(earnings.month)}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                {t('earnings.totalRides')}
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {earnings.totalRides}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Doanh thu gộp
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {formatCurrency(earnings.grossTotal)}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Hoa hồng nền tảng
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="error.main">
                {formatCurrency(earnings.commissionTotal)}
              </Typography>
              <Chip size="small" label={`${Math.round(earnings.commissionRate * 100)}% / cuốc`} sx={{ mt: 1 }} />
            </CardContent>
          </Card>
          </Box>

          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5 }}>
                Biểu đồ 7 ngày gần nhất
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Cột xanh là thực nhận, phần đỏ là hoa hồng tương ứng của từng ngày.
              </Typography>
              {earnings.daily.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Chưa có dữ liệu thu nhập để hiển thị biểu đồ.
                </Typography>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${earnings.daily.length}, minmax(0, 1fr))`, gap: 1.25, alignItems: 'end', height: EARNINGS_CHART_HEIGHT }}>
                  {earnings.daily.map((day) => {
                    const maxValue = Math.max(...earnings.daily.map((entry) => entry.gross), 1);
                    const grossHeight = Math.max((day.gross / maxValue) * (EARNINGS_CHART_HEIGHT - 36), day.gross > 0 ? 24 : 10);
                    const commissionHeight = day.gross > 0 ? Math.max((day.commission / day.gross) * grossHeight, 6) : 0;
                    const netHeight = Math.max(grossHeight - commissionHeight, 0);

                    return (
                      <Stack key={day.label} spacing={0.75} alignItems="center" justifyContent="flex-end" sx={{ minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary">
                          {day.rides} cuốc
                        </Typography>
                        <Box sx={{ width: '100%', maxWidth: 48, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: grossHeight }}>
                          <Box sx={{ width: '100%', borderRadius: 999, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px rgba(148,163,184,0.18)' }}>
                            <Box sx={{ height: netHeight, bgcolor: '#16a34a' }} />
                            <Box sx={{ height: commissionHeight, bgcolor: '#ef4444' }} />
                          </Box>
                        </Box>
                        <Typography variant="caption" fontWeight={700}>{day.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatCurrency(day.net)}
                        </Typography>
                      </Stack>
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5 }}>
                Chi tiết thu nhập theo cuốc xe
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Mỗi cuốc gồm doanh thu gộp, phần hoa hồng và thực nhận cuối cùng của tài xế.
              </Typography>
              <Stack spacing={1.5}>
                {earnings.recentTrips.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Chưa có chuyến hoàn thành để thống kê.
                  </Typography>
                )}
                {earnings.recentTrips.map((trip) => (
                  <Box key={trip.rideId}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between">
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" fontWeight={800}>
                          {trip.rideId.slice(0, 8).toUpperCase()} • {getVehicleTypeLabel(trip.vehicleType)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {trip.pickupAddress}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {trip.dropoffAddress}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(trip.completedAt)} • {getPaymentMethodLabel(trip.paymentMethod || 'CASH')}
                        </Typography>
                      </Box>
                      <Stack spacing={0.25} alignItems={{ xs: 'flex-start', sm: 'flex-end' }}>
                        <Typography variant="body2">Gộp: {formatCurrency(trip.gross)}</Typography>
                        <Typography variant="body2" color="error.main">Hoa hồng: {formatCurrency(trip.commission)}</Typography>
                        <Typography variant="subtitle2" fontWeight={800} color="success.main">Thực nhận: {formatCurrency(trip.net)}</Typography>
                      </Stack>
                    </Stack>
                    <Divider sx={{ mt: 1.5 }} />
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Box>
      )}
    </Container>
  );
};

export default Earnings;
