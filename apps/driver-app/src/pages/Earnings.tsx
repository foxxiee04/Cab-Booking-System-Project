import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Typography,
  Card,
  CardContent,
  Alert,
  Stack,
  Skeleton,
} from '@mui/material';
import {
  AttachMoneyRounded,
  TrendingUpRounded,
  DriveEtaRounded,
  PercentRounded,
  EmojiEventsRounded,
  WarningAmberRounded,
  HistoryRounded,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useNavigate } from 'react-router-dom';
import { driverApi } from '../api/driver.api';
import { setEarnings } from '../store/driver.slice';
import { formatCurrency } from '../utils/format.utils';
import { useTranslation } from 'react-i18next';



const PIE_COLORS = ['#16a34a', '#f59e0b', '#ef4444', '#6366f1'];

const formatVND = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
};

type ChartView = 'revenue' | 'trend' | 'trips' | 'pie';

const CHART_TABS: { value: ChartView; label: string }[] = [
  { value: 'revenue', label: 'Doanh thu' },
  { value: 'trend', label: 'Xu hướng' },
  { value: 'trips', label: 'Số chuyến' },
  { value: 'pie', label: 'Cơ cấu' },
];

const Earnings: React.FC = () => {
  const dispatch = useAppDispatch();
  const { earnings } = useAppSelector((state) => state.driver);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [chartView, setChartView] = useState<ChartView>('revenue');


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

  // ── Derived data ──

  const pieData = useMemo(() => {
    if (!earnings) return [];
    const net = earnings.netTotal;
    const commission = earnings.commissionTotal;
    const bonus = earnings.bonusTotal;
    const penalty = earnings.penaltyTotal;
    return [
      { name: 'Thực nhận', value: net },
      { name: 'Thưởng', value: bonus },
      { name: 'Hoa hồng', value: commission },
      { name: 'Phạt', value: penalty },
    ].filter((d) => d.value > 0);
  }, [earnings]);

  const weekTrips = useMemo(() => {
    if (!earnings) return 0;
    return earnings.daily.reduce((sum, d) => sum + d.rides, 0);
  }, [earnings]);



  // ── Loading / Error ──

  if (loading && !earnings) {
    return (
      <Box sx={{ py: 4, px: 1 }}>
        <Skeleton variant="text" width={200} height={40} sx={{ mb: 2 }} />
        <Stack spacing={2}>
          {[1, 2, 3, 4].map((k) => (
            <Skeleton key={k} variant="rounded" height={100} sx={{ borderRadius: 3 }} />
          ))}
        </Stack>
      </Box>
    );
  }

  if (error && !earnings) {
    return (
      <Box sx={{ py: 4, px: 1 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!earnings) return null;

  // ── Summary stats ──
  const statsRow = [
    { label: 'Hôm nay', value: formatCurrency(earnings.today), icon: <AttachMoneyRounded fontSize="small" />, color: '#16a34a', bg: '#f0fdf4' },
    { label: '7 ngày', value: formatCurrency(earnings.week), icon: <TrendingUpRounded fontSize="small" />, color: '#2563eb', bg: '#eff6ff' },
    { label: 'Chuyến/tuần', value: String(weekTrips), icon: <DriveEtaRounded fontSize="small" />, color: '#7c3aed', bg: '#f5f3ff' },
    { label: 'Hoa hồng', value: formatCurrency(earnings.commissionTotal), icon: <PercentRounded fontSize="small" />, color: '#dc2626', bg: '#fef2f2' },
    { label: 'Thưởng', value: formatCurrency(earnings.bonusTotal), icon: <EmojiEventsRounded fontSize="small" />, color: '#d97706', bg: '#fffbeb' },
  ];

  return (
    <Box
      sx={{
        pt: 1.5,
        pb: 1.5,
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      {error && <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      {/* Highlight card — net this week */}
      <Card
        elevation={0}
        sx={{
          background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
          color: '#fff',
          borderRadius: 4,
          mb: 2,
        }}
      >
        <CardContent sx={{ p: 2.5 }}>
          <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Thực nhận tuần này
          </Typography>
          <Typography variant="h4" fontWeight={800} letterSpacing={-0.5} sx={{ mt: 0.5, mb: 1.5 }}>
            {formatCurrency(earnings.week)}
          </Typography>
          <Stack direction="row" spacing={2}>
            <Box>
              <Typography variant="caption" sx={{ opacity: 0.75 }}>Hôm nay</Typography>
              <Typography variant="body1" fontWeight={700}>{formatCurrency(earnings.today)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ opacity: 0.75 }}>Số chuyến</Typography>
              <Typography variant="body1" fontWeight={700}>{weekTrips} chuyến</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ opacity: 0.75 }}>Thưởng</Typography>
              <Typography variant="body1" fontWeight={700}>{formatCurrency(earnings.bonusTotal)}</Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Stats row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(5, 1fr)' }, gap: 1, mb: 2 }}>
        {statsRow.map((s) => (
          <Card key={s.label} elevation={0} sx={{ borderRadius: 3, bgcolor: s.bg, border: 'none' }}>
            <CardContent sx={{ py: 1.5, px: 1, '&:last-child': { pb: 1.5 }, textAlign: 'center' }}>
              <Box sx={{ color: s.color, display: 'flex', justifyContent: 'center', mb: 0.5 }}>{s.icon}</Box>
              <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.2}>
                {s.label}
              </Typography>
              <Typography variant="body2" fontWeight={800} sx={{ color: s.color, mt: 0.25 }}>
                {s.value}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {earnings.unpaidCashDebt > 0 && (
        <Card elevation={0} sx={{ borderRadius: 3, bgcolor: '#fef2f2', border: '1px solid #fecaca', mb: 2 }}>
          <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <WarningAmberRounded sx={{ color: '#dc2626' }} fontSize="small" />
              <Box>
                <Typography variant="body2" fontWeight={700} color="error.main">Nợ tiền mặt chưa thanh toán</Typography>
                <Typography variant="caption" color="text.secondary">{formatCurrency(earnings.unpaidCashDebt)}</Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Chart section */}
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 2 }}>
          {/* Chart toggle */}
          <ButtonGroup fullWidth size="small" sx={{ mb: 2 }}>
            {CHART_TABS.map((ct) => (
              <Button
                key={ct.value}
                variant={chartView === ct.value ? 'contained' : 'outlined'}
                onClick={() => setChartView(ct.value)}
                disableElevation
                sx={{ fontWeight: 700, fontSize: '0.72rem', borderRadius: ct.value === 'revenue' ? '12px 0 0 12px !important' : ct.value === 'pie' ? '0 12px 12px 0 !important' : undefined }}
              >
                {ct.label}
              </Button>
            ))}
          </ButtonGroup>

          {earnings.daily.length === 0 ? (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
              Chưa có dữ liệu
            </Typography>
          ) : (
            <>
              {chartView === 'revenue' && (
                <>
                  <Typography variant="subtitle2" fontWeight={700} mb={1} color="text.secondary">Doanh thu theo ngày</Typography>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={earnings.daily} margin={{ top: 0, right: 4, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={formatVND} tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={(value: any, name: any) => {
                          const labels: Record<string, string> = { net: 'Thực nhận', commission: 'Hoa hồng', bonus: 'Thưởng' };
                          return [formatCurrency(Number(value)), labels[name] || name];
                        }}
                      />
                      <Legend formatter={(v: string) => {
                        const m: Record<string, string> = { net: 'Thực nhận', commission: 'Hoa hồng', bonus: 'Thưởng' };
                        return m[v] || v;
                      }} />
                      <Bar dataKey="net" fill="#16a34a" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="commission" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="bonus" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}

              {chartView === 'trend' && (
                <>
                  <Typography variant="subtitle2" fontWeight={700} mb={1} color="text.secondary">Xu hướng thu nhập</Typography>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={earnings.daily} margin={{ top: 0, right: 4, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={formatVND} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value: any) => [formatCurrency(Number(value)), 'Thực nhận']} />
                      <Line type="monotone" dataKey="net" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4, fill: '#2563eb' }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="gross" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}

              {chartView === 'trips' && (
                <>
                  <Typography variant="subtitle2" fontWeight={700} mb={1} color="text.secondary">Số chuyến theo ngày</Typography>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={earnings.daily} margin={{ top: 0, right: 4, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value: any) => [`${Number(value)} chuyến`, 'Số chuyến']} />
                      <Bar dataKey="rides" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}

              {chartView === 'pie' && (
                <>
                  <Typography variant="subtitle2" fontWeight={700} mb={1} color="text.secondary">Cơ cấu thu nhập</Typography>
                  {pieData.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>Chưa có dữ liệu</Typography>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                      <ResponsiveContainer width={160} height={160}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={68} paddingAngle={3} dataKey="value">
                            {pieData.map((_e, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                        </PieChart>
                      </ResponsiveContainer>
                      <Stack spacing={0.75}>
                        {pieData.map((entry, i) => (
                          <Stack key={entry.name} direction="row" alignItems="center" spacing={1}>
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                            <Typography variant="body2">{entry.name}</Typography>
                            <Typography variant="body2" fontWeight={700}>{formatCurrency(entry.value)}</Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Link to trip history */}
      <Button
        variant="outlined"
        fullWidth
        startIcon={<HistoryRounded />}
        onClick={() => navigate('/history')}
        sx={{ borderRadius: 3, fontWeight: 700, py: 1.2, mt: 2 }}
      >
        Xem lịch sử chuyến đi
      </Button>
    </Box>
  );
};

export default Earnings;
