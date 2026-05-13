import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Slider,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import { TrendingUp, Save, DirectionsBike, DirectionsCar, AirportShuttle } from '@mui/icons-material';
import { pricingApi } from '../api/pricing.api';
import { formatCurrency } from '../utils/format.utils';

// Pricing rates — must match pricing-service/src/config/index.ts
const VEHICLE_RATES = [
  {
    type: 'MOTORBIKE',
    label: 'Xe máy',
    icon: <DirectionsBike fontSize="small" />,
    color: '#16a34a',
    base: 10_000,
    perKm: 6_200,
    perMin: 450,
    minFare: 15_000,
  },
  {
    type: 'SCOOTER',
    label: 'Xe tay ga',
    icon: <DirectionsBike fontSize="small" />,
    color: '#0284c7',
    base: 14_000,
    perKm: 8_400,
    perMin: 700,
    minFare: 15_000,
  },
  {
    type: 'CAR_4',
    label: 'Ô tô 4 chỗ',
    icon: <DirectionsCar fontSize="small" />,
    color: '#7c3aed',
    base: 24_000,
    perKm: 15_000,
    perMin: 1_900,
    minFare: 15_000,
  },
  {
    type: 'CAR_7',
    label: 'Ô tô 7 chỗ',
    icon: <AirportShuttle fontSize="small" />,
    color: '#b45309',
    base: 32_000,
    perKm: 18_500,
    perMin: 2_400,
    minFare: 15_000,
  },
];

// Example trip: 5 km, 15 minutes
const EXAMPLE_KM = 5;
const EXAMPLE_MIN = 15;

function calcFare(rate: typeof VEHICLE_RATES[0], surge: number) {
  const raw = rate.base + rate.perKm * EXAMPLE_KM + rate.perMin * EXAMPLE_MIN;
  return Math.max(rate.minFare, Math.round(raw * surge));
}

const getSurgeColor = (v: number): 'success' | 'warning' | 'error' =>
  v < 1.3 ? 'success' : v < 1.8 ? 'warning' : 'error';

const Pricing: React.FC = () => {
  const [multiplier, setMultiplier] = useState(1.0);
  const [reason, setReason] = useState('');
  const [currentSurge, setCurrentSurge] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    pricingApi.getSurge()
      .then((res) => {
        setCurrentSurge(res.data.multiplier ?? 1.0);
        setMultiplier(res.data.multiplier ?? 1.0);
      })
      .catch(() => {});
  }, []);

  const handleUpdateSurge = async () => {
    setLoading(true);
    setSuccess('');
    setError('');
    try {
      await pricingApi.updateSurge({ multiplier, reason });
      setCurrentSurge(multiplier);
      setSuccess('Đã cập nhật hệ số surge thành công.');
      setReason('');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Cập nhật thất bại, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={800} gutterBottom>
        Giá cước & Hệ số surge
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Điều chỉnh hệ số surge toàn hệ thống. Giá cước cơ bản theo từng loại xe hiển thị bên dưới.
      </Typography>

      {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}
      {error   && <Alert severity="error"   onClose={() => setError('')}   sx={{ mb: 2 }}>{error}</Alert>}

      {/* Surge control */}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1fr 320px' }, mb: 3 }}>
        <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Stack direction="row" alignItems="center" spacing={1.5} mb={3}>
              <TrendingUp color="primary" />
              <Box>
                <Typography variant="h6" fontWeight={800}>Hệ số surge hiện tại</Typography>
                <Chip label={`${currentSurge.toFixed(1)}x`} color={getSurgeColor(currentSurge)} size="small" />
              </Box>
            </Stack>

            <Typography variant="body2" gutterBottom>
              Điều chỉnh: <strong>{multiplier.toFixed(1)}x</strong>
            </Typography>
            <Slider
              value={multiplier}
              onChange={(_, v) => setMultiplier(v as number)}
              min={1.0} max={3.0} step={0.1}
              marks={[1.0, 1.5, 2.0, 2.5, 3.0].map((v) => ({ value: v, label: `${v}x` }))}
              color={getSurgeColor(multiplier)}
              sx={{ mt: 2, mb: 3 }}
            />

            <TextField
              fullWidth
              label="Lý do điều chỉnh (tùy chọn)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Cao điểm giờ tan tầm, thời tiết xấu..."
              multiline rows={2}
              sx={{ mb: 2.5 }}
            />

            <Button
              variant="contained"
              fullWidth
              size="large"
              startIcon={loading ? <CircularProgress size={18} /> : <Save />}
              onClick={handleUpdateSurge}
              disabled={loading || multiplier === currentSurge}
              sx={{ borderRadius: 3 }}
            >
              Áp dụng surge {multiplier.toFixed(1)}x
            </Button>
          </CardContent>
        </Card>

        {/* Surge guide */}
        <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>Hướng dẫn</Typography>
            <Stack spacing={1.5} mt={1}>
              {[
                { range: '1.0–1.2x', color: 'success' as const, desc: 'Bình thường — cung đủ cầu' },
                { range: '1.3–1.7x', color: 'warning' as const, desc: 'Tăng nhẹ — giờ cao điểm' },
                { range: '1.8–3.0x', color: 'error'   as const, desc: 'Cao — thiếu tài xế hoặc thời tiết xấu' },
              ].map((g) => (
                <Box key={g.range} sx={{ p: 1.5, borderRadius: 2, bgcolor: g.color === 'success' ? '#f0fdf4' : g.color === 'warning' ? '#fffbeb' : '#fef2f2' }}>
                  <Chip label={g.range} color={g.color} size="small" sx={{ mb: 0.5 }} />
                  <Typography variant="body2" color="text.secondary">{g.desc}</Typography>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {/* Base fare table */}
      <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', mb: 3 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="subtitle1" fontWeight={800} gutterBottom>
            Bảng giá cơ bản theo loại xe
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Ví dụ tính cho chuyến {EXAMPLE_KM} km / {EXAMPLE_MIN} phút.&nbsp;
            Surge hiện tại: <strong>{currentSurge.toFixed(1)}x</strong>
            {multiplier !== currentSurge && <>&nbsp;→ dự kiến: <strong>{multiplier.toFixed(1)}x</strong></>}
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Loại xe</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Mở cửa</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Giá/km</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Giá/phút</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                    Ví dụ ({currentSurge.toFixed(1)}x)
                  </TableCell>
                  {multiplier !== currentSurge && (
                    <TableCell align="right" sx={{ fontWeight: 700, color: 'warning.main' }}>
                      Dự kiến ({multiplier.toFixed(1)}x)
                    </TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {VEHICLE_RATES.map((v) => {
                  const current = calcFare(v, currentSurge);
                  const preview = calcFare(v, multiplier);
                  return (
                    <TableRow key={v.type} hover>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Box sx={{ color: v.color }}>{v.icon}</Box>
                          <Box>
                            <Typography variant="body2" fontWeight={700}>{v.label}</Typography>
                            <Typography variant="caption" color="text.secondary">{v.type}</Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell align="right">{formatCurrency(v.base)}</TableCell>
                      <TableCell align="right">{formatCurrency(v.perKm)}</TableCell>
                      <TableCell align="right">{formatCurrency(v.perMin)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: v.color }}>
                        {formatCurrency(current)}
                      </TableCell>
                      {multiplier !== currentSurge && (
                        <TableCell align="right" sx={{ fontWeight: 700, color: 'warning.dark' }}>
                          {formatCurrency(preview)}
                          <Typography variant="caption" color={preview > current ? 'error.main' : 'success.main'} sx={{ display: 'block' }}>
                            {preview > current ? `+${formatCurrency(preview - current)}` : `-${formatCurrency(current - preview)}`}
                          </Typography>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

    </Box>
  );
};

export default Pricing;
