import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  AttachMoney,
  DirectionsCar,
  People,
  PictureAsPdf,
  TrendingDown,
  TrendingUp,
} from '@mui/icons-material';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { adminApi } from '../api/admin.api';
import { formatCurrency, formatNumber } from '../utils/format.utils';

// ── Types ──────────────────────────────────────────────────────────────────
interface DailyRevenue {
  date: string;
  revenue: number;
  trips: number;
}

interface RevenueAnalytics {
  dailyRevenue: DailyRevenue[];
  methodBreakdown: Record<string, number>;
  totalRevenue: number;
  totalTrips: number;
}

interface VehicleBreakdownRow {
  vehicleType: string;
  count: number;
  revenue: number;
}

interface TopDriver {
  id: string;
  name: string;
  totalRides: number;
  rating: number;
  vehicleType: string;
}

interface TopCustomer {
  id: string;
  name: string;
  email: string;
  totalRides: number;
}

type PeriodKey = 'day' | 'week' | 'month' | 'year';

const PERIOD_DAYS: Record<PeriodKey, number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

const PERIOD_LABEL: Record<PeriodKey, string> = {
  day: 'Hôm nay',
  week: '7 ngày qua',
  month: '30 ngày qua',
  year: '365 ngày qua',
};

const PERIOD_PREV_LABEL: Record<PeriodKey, string> = {
  day: 'Hôm qua',
  week: '7 ngày trước đó',
  month: '30 ngày trước đó',
  year: '365 ngày trước đó',
};

// ── Style constants ───────────────────────────────────────────────────────
const PALETTE = ['#5a7fb8', '#5ca38a', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#ec4899'];
const METHOD_LABELS: Record<string, string> = {
  CASH: 'Tiền mặt',
  MOMO: 'MoMo',
  VNPAY: 'VNPay',
  // Legacy/unused — system only supports CASH/MOMO/VNPAY but keep labels
  // for any historical rows already in the database.
  CARD: 'Thẻ (cũ)',
  WALLET: 'Ví (cũ)',
};
const VEHICLE_LABELS: Record<string, string> = {
  MOTORBIKE: 'Xe máy',
  SCOOTER: 'Xe ga',
  CAR_4: 'Ô tô 4 chỗ',
  CAR_7: 'Ô tô 7 chỗ',
};
const VEHICLE_COLOR: Record<string, string> = {
  MOTORBIKE: '#5a7fb8',
  SCOOTER:   '#06b6d4',
  CAR_4:     '#5ca38a',
  CAR_7:     '#f59e0b',
};

/** Thông tin hiển thị trên báo cáo / PDF (chỉnh theo doanh nghiệp thật). */
const REPORT_COMPANY = {
  legalName: 'Công ty TNHH FoxGo Việt Nam',
  brandLine: 'Nền tảng Cab Booking — Hệ thống đặt xe',
  email: 'Email: contact@foxgo.vn',
};

/** ~210mm @ 96dpi — cố định chiều ngang capture để scale PDF khớp A4, tránh “phình” theo màn hình. */
const PDF_CAPTURE_WIDTH_PX = 794;

// ── Helpers ───────────────────────────────────────────────────────────────
const formatShortCurrency = (v: number) => {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}T`;
  if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(1)}Tr`;
  if (v >= 1_000)         return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
};

const formatTickDate = (raw: string, period: PeriodKey) => {
  const d = new Date(raw);
  if (period === 'year') {
    return `${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
  }
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const computeDelta = (current: number, prev: number): number => {
  if (prev === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prev) / prev) * 100);
};

/**
 * Bucket daily series by month for the year view (so we don't try to plot 365
 * tiny bars). For shorter periods, returns the original series unchanged.
 */
const aggregateForChart = (
  daily: DailyRevenue[],
  period: PeriodKey,
): DailyRevenue[] => {
  if (period !== 'year' || daily.length === 0) return daily;
  const buckets = new Map<string, DailyRevenue>();
  for (const row of daily) {
    const d = new Date(row.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const cur = buckets.get(key);
    if (cur) {
      cur.revenue += row.revenue;
      cur.trips   += row.trips;
    } else {
      buckets.set(key, { date: key, revenue: row.revenue, trips: row.trips });
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
};

// ── KPI Card with delta vs previous period ────────────────────────────────
const KpiCard: React.FC<{
  title: string;
  value: string;
  prevValue: string;
  delta: number | null;
  icon: React.ReactNode;
  tone: string;
  /** Khi có — hiển thị thay cho dòng “kỳ trước” + chip % (vd. Top tài xế). */
  footerNote?: string;
}> = ({ title, value, prevValue, delta, icon, tone, footerNote }) => (
  <Card
    elevation={0}
    sx={{
      height: '100%',
      borderRadius: 4,
      background: `linear-gradient(160deg, ${tone} 0%, #ffffff 80%)`,
      border: '1px solid rgba(148,163,184,0.16)',
      boxShadow: '0 20px 45px rgba(15,23,42,0.07)',
    }}
  >
    <CardContent>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
        <Typography variant="body2" color="text.secondary" fontWeight={600}>{title}</Typography>
        <Box sx={{ opacity: 0.7 }}>{icon}</Box>
      </Stack>
      <Typography variant="h5" fontWeight={900}>{value}</Typography>
      {footerNote != null ? (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
          {footerNote}
        </Typography>
      ) : (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.75 }} flexWrap="wrap" useFlexGap>
          {delta !== null && (
            <Chip
              size="small"
              icon={delta >= 0 ? <TrendingUp sx={{ fontSize: 14 }} /> : <TrendingDown sx={{ fontSize: 14 }} />}
              label={`${delta >= 0 ? '+' : ''}${delta}%`}
              sx={{
                height: 22,
                fontSize: '0.72rem',
                fontWeight: 700,
                color: delta >= 0 ? '#16a34a' : '#dc2626',
                bgcolor: delta >= 0 ? 'rgba(22,163,74,0.10)' : 'rgba(220,38,38,0.10)',
                '& .MuiChip-icon': { color: 'inherit' },
              }}
            />
          )}
          <Typography variant="caption" color="text.secondary">
            kỳ trước: {prevValue}
          </Typography>
        </Stack>
      )}
    </CardContent>
  </Card>
);

const SectionTitle: React.FC<{ children: React.ReactNode; subtitle?: string }> = ({ children, subtitle }) => (
  <Box sx={{ mb: 2 }}>
    <Typography variant="h6" fontWeight={800}>{children}</Typography>
    {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
  </Box>
);

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 2, p: 1.5, boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>{label}</Typography>
      {payload.map((entry: any) => (
        <Typography key={entry.dataKey} variant="body2" fontWeight={700} sx={{ color: entry.color }}>
          {entry.name}: {entry.dataKey === 'revenue' ? formatCurrency(entry.value) : formatNumber(entry.value)}
        </Typography>
      ))}
    </Box>
  );
};

// ── Main component ─────────────────────────────────────────────────────────
const Reports: React.FC = () => {
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [revenue, setRevenue] = useState<RevenueAnalytics | null>(null);
  const [prevRevenue, setPrevRevenue] = useState<RevenueAnalytics | null>(null);
  const [vehicleBreakdown, setVehicleBreakdown] = useState<VehicleBreakdownRow[]>([]);
  const [topDrivers, setTopDrivers] = useState<TopDriver[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const reportRef = useRef<HTMLDivElement | null>(null);

  const days = PERIOD_DAYS[period];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const generatedAt = useMemo(() => new Date(), [period, revenue]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch current + previous period revenue in parallel for delta comparison.
      // For "previous period" we ask for 2x days and then split client-side
      // (backend caps at 730 days, well above 2x365).
      const [revRes, vehiclesRes, driversRes, customersRes] = await Promise.all([
        adminApi.getRevenueAnalytics(days * 2),
        adminApi.getVehicleBreakdown(days),
        adminApi.getTopDrivers(10),
        adminApi.getTopCustomers(10),
      ]);

      const fullDaily = revRes.data?.dailyRevenue || [];
      // Split into current half (most recent N days) and prev half (N days before)
      const currentDaily = fullDaily.slice(-days);
      const prevDaily = fullDaily.slice(0, fullDaily.length - days);

      const sumRevenue = (rows: DailyRevenue[]) => rows.reduce((s, r) => s + r.revenue, 0);
      const sumTrips   = (rows: DailyRevenue[]) => rows.reduce((s, r) => s + r.trips, 0);

      // For methodBreakdown we only have the aggregated total from backend; use
      // it for the current period view since previous period is not exposed.
      setRevenue({
        dailyRevenue: currentDaily,
        methodBreakdown: revRes.data?.methodBreakdown || {},
        totalRevenue: sumRevenue(currentDaily),
        totalTrips: sumTrips(currentDaily),
      });
      setPrevRevenue({
        dailyRevenue: prevDaily,
        methodBreakdown: {},
        totalRevenue: sumRevenue(prevDaily),
        totalTrips: sumTrips(prevDaily),
      });

      setVehicleBreakdown(vehiclesRes.data?.breakdown || []);
      setTopDrivers(driversRes.data?.drivers || []);
      setTopCustomers(customersRes.data?.customers || []);
    } catch {
      setError('Không thể tải dữ liệu báo cáo. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ── Derived values ──────────────────────────────────────────────────────
  const avgTripValue = revenue && revenue.totalTrips > 0 ? revenue.totalRevenue / revenue.totalTrips : 0;
  const prevAvgTripValue = prevRevenue && prevRevenue.totalTrips > 0 ? prevRevenue.totalRevenue / prevRevenue.totalTrips : 0;
  const totalVehicleRides = vehicleBreakdown.reduce((s, b) => s + b.count, 0);

  const chartData = useMemo(
    () => aggregateForChart(revenue?.dailyRevenue || [], period),
    [revenue, period],
  );

  const methodPieData = useMemo(() => {
    if (!revenue?.methodBreakdown) return [];
    return Object.entries(revenue.methodBreakdown)
      .filter(([, v]) => v > 0)
      .map(([method, value]) => ({
        name: METHOD_LABELS[method] || method,
        value,
      }));
  }, [revenue]);

  const vehicleChartData = useMemo(
    () =>
      vehicleBreakdown.map((b) => ({
        name: VEHICLE_LABELS[b.vehicleType] || b.vehicleType,
        type: b.vehicleType,
        rides: b.count,
        revenue: b.revenue,
      })),
    [vehicleBreakdown],
  );

  // ── PDF export ──────────────────────────────────────────────────────────
  const handleExportPdf = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    const element = reportRef.current;
    const prevInline = { width: element.style.width, maxWidth: element.style.maxWidth };
    try {
      // Cố định chiều ngang như A4 web (794px) để ảnh scale đúng lề A4, không phụ thuộc độ rộng màn hình.
      element.style.width = `${PDF_CAPTURE_WIDTH_PX}px`;
      element.style.maxWidth = `${PDF_CAPTURE_WIDTH_PX}px`;
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      await new Promise((r) => setTimeout(r, 250));

      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        windowWidth: PDF_CAPTURE_WIDTH_PX,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const marginMm = 10;
      const usableW = pageW - 2 * marginMm;
      const usableH = pageH - 2 * marginMm;

      // Fit toàn bộ báo cáo trong **một** trang A4: scale đồng đều (giữ tỉ lệ), căn giữa trong vùng có lề.
      const pxW = canvas.width;
      const pxH = canvas.height;
      let drawW = usableW;
      let drawH = (pxH * drawW) / pxW;
      if (drawH > usableH) {
        drawH = usableH;
        drawW = (pxW * drawH) / pxH;
      }
      const x = marginMm + (usableW - drawW) / 2;
      const y = marginMm + (usableH - drawH) / 2;
      pdf.addImage(imgData, 'PNG', x, y, drawW, drawH, undefined, 'FAST');

      const stamp = generatedAt.toISOString().slice(0, 10);
      pdf.save(`bao-cao-doanh-so-${period}-${stamp}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      setError('Xuất PDF thất bại. Vui lòng thử lại.');
    } finally {
      element.style.width = prevInline.width;
      element.style.maxWidth = prevInline.maxWidth;
      setExporting(false);
    }
  };

  if (loading && !revenue) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress size={56} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, minHeight: '100%', background: 'radial-gradient(circle at top right, rgba(90,127,184,0.10), transparent 38%), linear-gradient(180deg, #f7f9fc 0%, #eef3f9 100%)' }}>
      {/* ── Toolbar (excluded from PDF) ── */}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 2.5 }}>
        <Box>
          <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ letterSpacing: '0.12em' }}>
            BÁO CÁO DOANH SỐ
          </Typography>
          <Typography variant="h4" fontWeight={900}>Cab Booking — Tổng kết kinh doanh</Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <ToggleButtonGroup
            value={period}
            exclusive
            size="small"
            onChange={(_, v) => v && setPeriod(v as PeriodKey)}
            sx={{ bgcolor: '#fff', borderRadius: 3, '& .MuiToggleButton-root': { fontWeight: 700, px: 2.25, border: '1px solid rgba(148,163,184,0.25)' } }}
          >
            <ToggleButton value="day">Ngày</ToggleButton>
            <ToggleButton value="week">Tuần</ToggleButton>
            <ToggleButton value="month">Tháng</ToggleButton>
            <ToggleButton value="year">Năm</ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="contained"
            startIcon={exporting ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <PictureAsPdf />}
            onClick={handleExportPdf}
            disabled={exporting || loading}
            sx={{ borderRadius: 3, fontWeight: 700, textTransform: 'none', boxShadow: 'none' }}
          >
            {exporting ? 'Đang tạo PDF…' : 'Xuất PDF'}
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{error}</Alert>}

      {/* ── Report body (everything inside is captured by the PDF) ── */}
      <Box ref={reportRef} sx={{ bgcolor: 'transparent', maxWidth: '100%' }}>
        {/* Cover header */}
        <Card elevation={0} sx={{ borderRadius: 5, mb: 3, p: 3, border: '1px solid rgba(148,163,184,0.16)', background: 'linear-gradient(135deg, #5a7fb8 0%, #4f6ea1 100%)', color: '#fff' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} spacing={2.5}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" sx={{ display: 'block', opacity: 0.92, fontWeight: 700, letterSpacing: '0.04em' }}>
                {REPORT_COMPANY.legalName}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', opacity: 0.8, mt: 0.25 }}>
                {REPORT_COMPANY.brandLine}
              </Typography>
              <Typography variant="overline" sx={{ opacity: 0.85, letterSpacing: '0.16em', fontWeight: 700, mt: 1.5, display: 'block' }}>
                Cab Booking System · Báo cáo nội bộ
              </Typography>
              <Typography variant="h4" fontWeight={900} sx={{ mt: 0.5 }}>
                Báo cáo doanh số {PERIOD_LABEL[period].toLowerCase()}
              </Typography>

            </Box>
            <Box sx={{ textAlign: { md: 'right' }, flexShrink: 0 }}>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>Phát hành</Typography>
              <Typography variant="body1" fontWeight={700}>
                {generatedAt.toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' })}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {generatedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </Typography>
            </Box>
          </Stack>
        </Card>

        {/* Executive summary — cùng kiểu Card viền như mục 2, 3 */}
        <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.07)', mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <SectionTitle subtitle={`Đối chiếu ${PERIOD_LABEL[period].toLowerCase()} vs ${PERIOD_PREV_LABEL[period].toLowerCase()}`}>
              1. Tóm tắt điều hành
            </SectionTitle>
            <Grid container spacing={2.5}>
              <Grid item xs={12} sm={6} md={3}>
                <KpiCard
                  title="Tổng doanh thu (GMV)"
                  value={formatCurrency(revenue?.totalRevenue || 0)}
                  prevValue={formatCurrency(prevRevenue?.totalRevenue || 0)}
                  delta={computeDelta(revenue?.totalRevenue || 0, prevRevenue?.totalRevenue || 0)}
                  icon={<AttachMoney sx={{ fontSize: 36 }} />}
                  tone="#fef3c7"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <KpiCard
                  title="Số chuyến hoàn tất"
                  value={formatNumber(revenue?.totalTrips || 0)}
                  prevValue={formatNumber(prevRevenue?.totalTrips || 0)}
                  delta={computeDelta(revenue?.totalTrips || 0, prevRevenue?.totalTrips || 0)}
                  icon={<DirectionsCar sx={{ fontSize: 36 }} />}
                  tone="#dbeafe"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <KpiCard
                  title="Giá trị TB / chuyến"
                  value={formatCurrency(avgTripValue)}
                  prevValue={formatCurrency(prevAvgTripValue)}
                  delta={computeDelta(avgTripValue, prevAvgTripValue)}
                  icon={<TrendingUp sx={{ fontSize: 36 }} />}
                  tone="#dcfce7"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <KpiCard
                  title="Top tài xế (cuốc)"
                  value={topDrivers[0]?.name || '—'}
                  prevValue="—"
                  delta={null}
                  icon={<People sx={{ fontSize: 36 }} />}
                  tone="#ede9fe"
                  footerNote={
                    topDrivers[0]
                      ? `Số chuyến trong kỳ: ${formatNumber(topDrivers[0].totalRides)}`
                      : 'Chưa có dữ liệu'
                  }
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Revenue trend */}
        <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.07)', mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <SectionTitle subtitle={period === 'year' ? 'Tổng hợp theo tháng' : 'Tổng hợp theo ngày'}>
              2. Diễn biến doanh thu
            </SectionTitle>
            <Box sx={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5a7fb8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#5a7fb8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="date" tickFormatter={(d) => formatTickDate(d, period)} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                  <YAxis tickFormatter={formatShortCurrency} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} labelFormatter={(d) => formatTickDate(String(d), period)} />
                  <Area type="monotone" dataKey="revenue" name="Doanh thu" stroke="#5a7fb8" strokeWidth={2.5} fill="url(#revenueGrad)" dot={false} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
            <Box sx={{ height: 220, mt: 2 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="date" tickFormatter={(d) => formatTickDate(d, period)} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} labelFormatter={(d) => formatTickDate(String(d), period)} />
                  <Bar dataKey="trips" name="Số chuyến" fill="#5ca38a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        {/* Vehicle breakdown + Payment methods */}
        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          <Grid item xs={12} lg={7}>
            <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.07)', height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <SectionTitle subtitle={`${formatNumber(totalVehicleRides)} chuyến hoàn tất theo loại xe`}>
                  3. Cơ cấu chuyến đi theo loại xe
                </SectionTitle>
                {vehicleChartData.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">Chưa có dữ liệu</Typography>
                ) : (
                  <Box sx={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={vehicleChartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#334155' }} tickLine={false} />
                        <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                        <YAxis yAxisId="right" orientation="right" tickFormatter={formatShortCurrency} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                        <Tooltip
                          formatter={(value: number, name: string) => name === 'Doanh thu' ? formatCurrency(value) : formatNumber(value)}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="rides" name="Số chuyến" radius={[6, 6, 0, 0]}>
                          {vehicleChartData.map((d) => (
                            <Cell key={d.type} fill={VEHICLE_COLOR[d.type] || '#5a7fb8'} />
                          ))}
                        </Bar>
                        <Bar yAxisId="right" dataKey="revenue" name="Doanh thu" radius={[6, 6, 0, 0]} fill="rgba(245,158,11,0.55)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={5}>
            <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.07)', height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <SectionTitle subtitle="Tổng giá trị giao dịch theo phương thức">
                  4. Phương thức thanh toán
                </SectionTitle>
                {methodPieData.length === 0 ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
                    <Typography variant="body2" color="text.secondary">Chưa có dữ liệu</Typography>
                  </Box>
                ) : (
                  <Box sx={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={methodPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value">
                          {methodPieData.map((_, index) => (
                            <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend formatter={(value) => <span style={{ fontSize: 12, color: '#334155' }}>{value}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Top performers */}
        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          <Grid item xs={12} lg={6}>
            <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.07)' }}>
              <CardContent sx={{ p: 3 }}>
                <SectionTitle subtitle="Xếp theo số chuyến hoàn tất">
                  5. Top 10 tài xế
                </SectionTitle>
                {topDrivers.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">Chưa có dữ liệu</Typography>
                ) : (
                  <Box sx={{ height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topDrivers} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: '#334155' }} tickLine={false} axisLine={false} />
                        <Tooltip formatter={(v: number) => [formatNumber(v), 'Số chuyến']} />
                        <Bar dataKey="totalRides" name="Số chuyến" radius={[0, 4, 4, 0]}>
                          {topDrivers.map((_, index) => (
                            <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={6}>
            <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.07)' }}>
              <CardContent sx={{ p: 3 }}>
                <SectionTitle subtitle="Xếp theo số chuyến đặt thành công">
                  6. Top 10 khách hàng
                </SectionTitle>
                {topCustomers.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">Chưa có dữ liệu</Typography>
                ) : (
                  <Box sx={{ height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topCustomers} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: '#334155' }} tickLine={false} axisLine={false} />
                        <Tooltip formatter={(v: number) => [formatNumber(v), 'Số chuyến']} />
                        <Bar dataKey="totalRides" name="Số chuyến" radius={[0, 4, 4, 0]}>
                          {topCustomers.map((_, index) => (
                            <Cell key={index} fill={PALETTE[(index + 3) % PALETTE.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Footer */}
        <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid rgba(148,163,184,0.16)', mb: 1 }}>
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
              <Typography variant="caption" color="text.secondary">
                Báo cáo phát hành tự động từ Cab Booking Admin Dashboard. Dữ liệu cập nhật tại thời điểm phát hành.
              </Typography>
              <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
              <Typography variant="caption" color="text.secondary">
                Ký hiệu doanh thu (Tr = triệu, T = tỉ).
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default Reports;
