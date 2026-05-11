import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  Alert,
  Stack,
  Skeleton,
  Tab,
  Tabs,
  Divider,
} from '@mui/material';
import {
  AttachMoneyRounded,
  DriveEtaRounded,
  PercentRounded,
  EmojiEventsRounded,
  MoneyOffRounded,
  BarChartRounded,
  AssessmentRounded,
} from '@mui/icons-material';

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { driverApi } from '../api/driver.api';
import { setEarnings } from '../store/driver.slice';
import { formatCurrency } from '../utils/format.utils';
import { useTranslation } from 'react-i18next';

// ─── Constants ─────────────────────────────────────────────────────────────

const formatVND = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
};

// ─── Component ─────────────────────────────────────────────────────────────

const Earnings: React.FC = () => {
  const dispatch = useAppDispatch();
  const { earnings } = useAppSelector((state) => state.driver);
  const { t } = useTranslation();

  const [tab, setTab] = useState(0);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchEarnings = useCallback(async () => {
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
  }, [dispatch, t]);

  useEffect(() => { fetchEarnings(); }, [fetchEarnings]);

  // ── Derived data ─────────────────────────────────────────────────────

  const periodNet = useMemo(() => {
    if (!earnings) return 0;
    return period === 'today' ? earnings.today : period === 'week' ? earnings.week : earnings.month;
  }, [earnings, period]);

  const periodTrips = useMemo(() => {
    const trips = earnings?.recentTrips ?? [];
    if (!trips.length) return [];
    // Vietnam-time boundaries so the user's browser timezone doesn't shift the buckets.
    const VN_OFFSET_MS = 7 * 3600 * 1000;
    const nowVn = new Date(Date.now() + VN_OFFSET_MS);
    const y = nowVn.getUTCFullYear();
    const m = nowVn.getUTCMonth();
    const d = nowVn.getUTCDate();
    const boundaries = {
      today: Date.UTC(y, m, d) - VN_OFFSET_MS,
      week: Date.UTC(y, m, d - 6) - VN_OFFSET_MS,
      month: Date.UTC(y, m, 1) - VN_OFFSET_MS,
    } as const;
    return trips.filter((t) => new Date(t.completedAt).getTime() >= boundaries[period]);
  }, [earnings, period]);

  const weekTrips = useMemo(() => earnings?.daily?.reduce((s, d) => s + d.rides, 0) ?? 0, [earnings]);
  const avgFare   = useMemo(() => {
    if (!periodTrips.length) return 0;
    return periodTrips.reduce((s, t) => s + t.net, 0) / periodTrips.length;
  }, [periodTrips]);

  // ── Loading / Error ──────────────────────────────────────────────────

  if (loading && !earnings) {
    return (
      <Box sx={{ py: 2, px: 0.5 }}>
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
        <Alert severity="error" action={<Button onClick={fetchEarnings}>Thử lại</Button>}>
          {error}
        </Alert>
      </Box>
    );
  }

  if (!earnings) return null;

  // ── Period selector ──────────────────────────────────────────────────

  const renderPeriodSelector = () => (
    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
      {(['today', 'week', 'month'] as const).map((p) => (
        <Button
          key={p}
          variant={period === p ? 'contained' : 'outlined'}
          size="small"
          disableElevation
          onClick={() => setPeriod(p)}
          sx={{ flex: 1, borderRadius: 3, fontWeight: 700, fontSize: '0.78rem' }}
        >
          {p === 'today' ? 'Hôm nay' : p === 'week' ? '7 ngày' : 'Tháng'}
        </Button>
      ))}
    </Stack>
  );

  // ── Tab 1: Tổng quan ─────────────────────────────────────────────────

  const renderOverview = () => (
    <Stack spacing={2}>
      {renderPeriodSelector()}

      {/* Main earning card */}
      <Card elevation={0} sx={{ background: (theme: any) => `linear-gradient(135deg, ${theme.palette.secondary.dark} 0%, ${theme.palette.secondary.main} 100%)`, color: '#fff', borderRadius: 4 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', textAlign: 'center' }}>
            Thực nhận {period === 'today' ? 'hôm nay' : period === 'week' ? '7 ngày' : 'tháng này'}
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 800, textAlign: 'center', mt: 0.5, mb: 1.5 }}>
            {formatCurrency(periodNet)}
          </Typography>
          <Stack direction="row" justifyContent="center" spacing={2} flexWrap="wrap" useFlexGap>
            <Stack alignItems="center">
              <Typography variant="caption" sx={{ opacity: 0.7 }}>Số chuyến</Typography>
              <Typography variant="subtitle1" fontWeight={800}>{periodTrips.length}</Typography>
            </Stack>
            <Stack alignItems="center">
              <Typography variant="caption" sx={{ opacity: 0.7 }}>Trung bình/cuốc</Typography>
              <Typography variant="subtitle1" fontWeight={800}>{formatCurrency(avgFare)}</Typography>
            </Stack>
            <Stack alignItems="center">
              <Typography variant="caption" sx={{ opacity: 0.7 }}>Thưởng</Typography>
              <Typography variant="subtitle1" fontWeight={800}>{formatCurrency(earnings.bonusTotal)}</Typography>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
        {[
          { icon: <AttachMoneyRounded fontSize="small" />, label: 'Tổng cước (gộp)', value: formatCurrency(earnings.grossTotal), color: '#16a34a', bg: '#f0fdf4' },
          { icon: <PercentRounded fontSize="small" />, label: 'Phí nền tảng', value: formatCurrency(earnings.commissionTotal), color: '#dc2626', bg: '#fef2f2' },
          { icon: <EmojiEventsRounded fontSize="small" />, label: 'Tổng thưởng', value: formatCurrency(earnings.bonusTotal), color: '#d97706', bg: '#fffbeb' },
          { icon: <DriveEtaRounded fontSize="small" />, label: 'Cuốc 7 ngày', value: String(weekTrips), color: '#7c3aed', bg: '#f5f3ff' },
        ].map((s) => (
          <Card key={s.label} elevation={0} sx={{ borderRadius: 3, bgcolor: s.bg }}>
            <CardContent sx={{ py: 1.5, px: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box sx={{ color: s.color, mb: 0.5 }}>{s.icon}</Box>
              <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.2}>{s.label}</Typography>
              <Typography variant="body2" fontWeight={800} sx={{ color: s.color, mt: 0.25 }}>{s.value}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {earnings.unpaidCashDebt > 0 && (
        <Alert severity="warning" icon={<MoneyOffRounded />} sx={{ borderRadius: 3 }}>
          <strong>Nợ tiền mặt chưa thanh toán: {formatCurrency(earnings.unpaidCashDebt)}</strong>
          <br />Số tiền hoa hồng còn thiếu từ các cuốc xe tiền mặt
        </Alert>
      )}

      {/* Trend chart */}
      {earnings.daily.length > 0 && (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={1} color="text.secondary">Xu hướng thu nhập 7 ngày</Typography>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={earnings.daily} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={formatVND} tick={{ fontSize: 9 }} />
                <Tooltip formatter={(value: any, name: any) => [formatCurrency(Number(value)), name === 'net' ? 'Thực nhận' : 'Doanh thu gộp']} />
                <Legend formatter={(value: string) => value === 'net' ? 'Thực nhận' : 'Doanh thu gộp'} />
                <Line type="monotone" dataKey="net" name="net" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="gross" name="gross" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Trip statistics */}
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
            <AssessmentRounded color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>Thống kê chuyến đi</Typography>
          </Stack>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
            {[
              { label: 'Tổng cuốc', value: String(earnings.totalRides), color: '#2563eb' },
              { label: 'Cuốc tuần', value: String(weekTrips), color: '#7c3aed' },
              { label: 'TB/cuốc', value: formatCurrency(earnings.totalRides > 0 ? earnings.netTotal / earnings.totalRides : 0), color: '#16a34a' },
            ].map((s) => (
              <Box key={s.label} sx={{ textAlign: 'center', p: 1, bgcolor: '#f8fafc', borderRadius: 2 }}>
                <Typography variant="h6" fontWeight={800} sx={{ color: s.color }}>{s.value}</Typography>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
              </Box>
            ))}
          </Box>
          {earnings.daily.length > 0 && (
            <Box mt={1.5}>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={earnings.daily} margin={{ top: 0, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 9 }} />
                  <Tooltip formatter={(v: any) => [`${Number(v)} cuốc`, 'Số chuyến']} />
                  <Bar dataKey="rides" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          )}
        </CardContent>
      </Card>
    </Stack>
  );

  // ── Tab 2: Chi tiết thu nhập ─────────────────────────────────────────

  const renderIncome = () => (
    <Stack spacing={2}>
      {renderPeriodSelector()}

      {/* Revenue stacked bar chart */}
      {earnings.daily.length > 0 && (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={1} color="text.secondary">Doanh thu theo ngày</Typography>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={earnings.daily} margin={{ top: 0, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={formatVND} tick={{ fontSize: 9 }} />
                <Tooltip
                  formatter={(value: any, name: any) => {
                    const labels: Record<string, string> = { net: 'Thực nhận', commission: 'Phí nền tảng', bonus: 'Thưởng' };
                    return [formatCurrency(Number(value)), labels[name] || name];
                  }}
                />
                <Legend formatter={(v: string) => ({ net: 'Thực nhận', commission: 'Phí nền tảng', bonus: 'Thưởng' } as Record<string, string>)[v] || v} />
                <Bar dataKey="net" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="commission" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="bonus" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Income breakdown */}
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
            <BarChartRounded color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>Cơ cấu thu nhập (toàn kỳ)</Typography>
          </Stack>
          <Stack spacing={1.2}>
            {[
              { label: 'Tổng cước gộp', value: earnings.grossTotal, color: '#2563eb', icon: <AttachMoneyRounded fontSize="small" />, sign: '+' },
              { label: 'Thưởng', value: earnings.bonusTotal, color: '#d97706', icon: <EmojiEventsRounded fontSize="small" />, sign: '+' },
              { label: 'Phí nền tảng', value: earnings.commissionTotal, color: '#dc2626', icon: <PercentRounded fontSize="small" />, sign: '-' },
              { label: 'Phạt', value: earnings.penaltyTotal, color: '#7c3aed', icon: <MoneyOffRounded fontSize="small" />, sign: '-' },
            ].map((item) => (
              <Stack key={item.label} direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ color: item.color, display: 'flex' }}>{item.icon}</Box>
                  <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                </Stack>
                <Typography variant="body2" fontWeight={700} sx={{ color: item.color }}>
                  {item.sign}{formatCurrency(item.value)}
                </Typography>
              </Stack>
            ))}
            <Divider />
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body2" fontWeight={700}>Thực nhận</Typography>
              <Typography variant="subtitle2" fontWeight={800} color="success.main">
                {formatCurrency(earnings.netTotal)}
              </Typography>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );

  // ── Main render ──────────────────────────────────────────────────────

  return (
    <Box sx={{ pt: 1, pb: 2, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      {error && <Alert severity="warning" sx={{ mb: 2, borderRadius: 2, mx: 0.5 }}>{error}</Alert>}

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="h6" fontWeight={800}>Thu nhập tài xế</Typography>
        <Button size="small" variant="outlined" onClick={fetchEarnings} disabled={loading} sx={{ borderRadius: 2, fontSize: '0.72rem' }}>
          {loading ? 'Đang tải...' : 'Làm mới'}
        </Button>
      </Stack>

      <Card variant="outlined" sx={{ borderRadius: 3, mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_e, v) => setTab(v)}
          variant="fullWidth"
          sx={{ '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' }, minHeight: 44 }}
        >
          <Tab label="Tổng quan" sx={{ fontSize: '0.78rem', minHeight: 44, fontWeight: 700 }} />
          <Tab label="Chi tiết thu nhập" sx={{ fontSize: '0.78rem', minHeight: 44, fontWeight: 700 }} />
        </Tabs>
      </Card>

      <Box sx={{ flex: 1 }}>
        {tab === 0 && renderOverview()}
        {tab === 1 && renderIncome()}
      </Box>
    </Box>
  );
};

export default Earnings;
