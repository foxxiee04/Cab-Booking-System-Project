import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  AttachMoney,
  CheckCircle,
  DirectionsCar,
  DriveEta,
  MyLocation,
  People,
  TrendingDown,
  TrendingUp,
  Warning,
} from '@mui/icons-material';
import { GoogleMap, HeatmapLayerF, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import L from 'leaflet';
import 'leaflet.heat';
import {
  MapContainer as LeafletMapContainer,
  TileLayer as LeafletTileLayer,
  useMap,
} from 'react-leaflet';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../api/admin.api';
import { adminSocketService } from '../socket/admin.socket';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setStats } from '../store/admin.slice';
import { Driver, Payment, Ride } from '../types';
import { formatCurrency, formatNumber } from '../utils/format.utils';

const mapLibraries: ('visualization')[] = ['visualization'];
const defaultCenter = { lat: 10.7769, lng: 106.7009 };

const heatmapGradient = [
  'rgba(0,0,255,0)',
  'rgba(0,128,255,0.6)',
  'rgba(0,255,200,0.7)',
  'rgba(255,255,0,0.8)',
  'rgba(255,128,0,0.9)',
  'rgba(255,0,0,1)',
];

const lightMapStyles: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#f8fafc' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#dbeafe' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#93c5fd' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#bfdbfe' }] },
];

type RegionFilter = 'ALL' | 'NORTH' | 'CENTRAL' | 'SOUTH';

const regionOptions: Array<{ value: RegionFilter; label: string }> = [
  { value: 'ALL', label: 'Toàn thành phố' },
  { value: 'NORTH', label: 'Phía Bắc' },
  { value: 'CENTRAL', label: 'Trung tâm' },
  { value: 'SOUTH', label: 'Phía Nam' },
];

// LatLngBounds per region — used both for filtering AND for fitBounds() so the
// map zooms into the chosen area when the user picks one.
const REGION_BOUNDS: Record<Exclude<RegionFilter, 'ALL'>, [[number, number], [number, number]]> = {
  NORTH:   [[10.82, 106.55], [10.92, 106.78]],
  CENTRAL: [[10.74, 106.63], [10.82, 106.75]],
  SOUTH:   [[10.65, 106.65], [10.74, 106.82]],
};

function matchesRegion(driver: Driver, region: RegionFilter): boolean {
  if (region === 'ALL' || !driver.currentLocation) return true;
  const { lat, lng } = driver.currentLocation;
  if (region === 'NORTH') return lat >= 10.82;
  if (region === 'SOUTH') return lat < 10.74;
  return lat >= 10.74 && lat < 10.82 && lng >= 106.63 && lng <= 106.75;
}

// ── Leaflet.heat heatmap layer ──────────────────────────────────────────────
// Uses the leaflet.heat plugin (https://github.com/Leaflet/Leaflet.heat) for a
// proper zoom-aware gradient instead of a hand-rolled canvas. Points are
// weighted by 1.0 (one per driver); blur/radius scale with the map's pixel
// density via the plugin's built-in handling.
const LeafletHeatLayer: React.FC<{ drivers: Driver[] }> = ({ drivers }) => {
  const map = useMap();
  const layerRef = useRef<any>(null);

  useEffect(() => {
    const points: Array<[number, number, number]> = drivers
      .filter((d) => d.currentLocation)
      .map((d) => [d.currentLocation!.lat, d.currentLocation!.lng, 1.0]);

    if (!layerRef.current) {
      layerRef.current = (L as any).heatLayer(points, {
        radius: 28,
        blur: 22,
        maxZoom: 17,
        max: 1.0,
        minOpacity: 0.35,
        gradient: {
          0.0: '#2563eb',
          0.25: '#06b6d4',
          0.5:  '#22c55e',
          0.7:  '#facc15',
          0.85: '#f97316',
          1.0:  '#dc2626',
        },
      }).addTo(map);
    } else {
      layerRef.current.setLatLngs(points);
    }

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, drivers]);

  return null;
};

// Smoothly fits the map to the active region's bounds when the filter changes,
// so picking "Phía Bắc" actually zooms into that area instead of just hiding
// data points. ALL → falls back to centering on the driver swarm.
const RegionBoundsController: React.FC<{ region: RegionFilter; fallbackCenter: { lat: number; lng: number } }> = ({ region, fallbackCenter }) => {
  const map = useMap();
  useEffect(() => {
    if (region === 'ALL') {
      map.setView([fallbackCenter.lat, fallbackCenter.lng], 12, { animate: true });
      return;
    }
    const b = REGION_BOUNDS[region];
    map.fitBounds(b, { padding: [24, 24], animate: true, maxZoom: 14 });
  }, [map, region, fallbackCenter.lat, fallbackCenter.lng]);
  return null;
};

// ── KPI Cards ─────────────────────────────────────────────────────────────────
interface KpiProps {
  title: string;
  value: string | number;
  caption: string;
  icon: React.ReactNode;
  tone: string;
  trend?: 'up' | 'down' | 'neutral';
}

const StatCard: React.FC<KpiProps> = ({ title, value, caption, icon, tone, trend }) => (
  <Card
    elevation={0}
    sx={{
      height: '100%',
      borderRadius: 4,
      color: '#0f172a',
      background: `linear-gradient(160deg, ${tone} 0%, #ffffff 80%)`,
      border: '1px solid rgba(148,163,184,0.16)',
      boxShadow: '0 20px 45px rgba(15,23,42,0.08)',
    }}
  >
    <CardContent sx={{ pb: '14px !important' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="body2" color="text.secondary">{title}</Typography>
          <Typography variant="h5" fontWeight={900} sx={{ my: 0.75 }}>{value}</Typography>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {trend === 'up' && <TrendingUp sx={{ fontSize: 14, color: '#16a34a' }} />}
            {trend === 'down' && <TrendingDown sx={{ fontSize: 14, color: '#dc2626' }} />}
            <Typography variant="caption" color="text.secondary">{caption}</Typography>
          </Stack>
        </Box>
        <Box sx={{ color: '#0f172a', opacity: 0.65 }}>{icon}</Box>
      </Stack>
    </CardContent>
  </Card>
);

// ── Section header ─────────────────────────────────────────────────────────────
const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string }> = ({ icon, title, subtitle }) => (
  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
    <Box sx={{ color: 'primary.main' }}>{icon}</Box>
    <Box>
      <Typography variant="h6" fontWeight={800}>{title}</Typography>
      {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
    </Box>
  </Stack>
);

// ── Google Maps heatmap ────────────────────────────────────────────────────────
const GoogleDriverHeatmap: React.FC<{
  googleMapsApiKey: string;
  mapCenter: { lat: number; lng: number };
  drivers: Driver[];
  fallback: React.ReactNode;
}> = ({ googleMapsApiKey, mapCenter, drivers, fallback }) => {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'admin-dashboard-google-maps',
    googleMapsApiKey,
    libraries: mapLibraries,
  });

  if (loadError) return <>{fallback}</>;
  if (!isLoaded) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box>;

  const heatmapData = drivers
    .filter((d) => d.currentLocation)
    .map((d) => new google.maps.LatLng(d.currentLocation!.lat, d.currentLocation!.lng));

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={mapCenter}
      zoom={12}
      options={{
        disableDefaultUI: true,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        styles: lightMapStyles,
      }}
    >
      {heatmapData.length > 0 && (
        <HeatmapLayerF
          data={heatmapData}
          options={{ radius: 40, opacity: 0.75, gradient: heatmapGradient, dissipating: true }}
        />
      )}
      {drivers.slice(0, 80).map((d) => d.currentLocation && (
        <MarkerF
          key={d.id}
          position={{ lat: d.currentLocation.lat, lng: d.currentLocation.lng }}
          title={`${d.user?.firstName || ''} ${d.user?.lastName || ''}`.trim()}
        />
      ))}
    </GoogleMap>
  );
};

// ── Revenue mini chart tooltip ─────────────────────────────────────────────────
const RevenueTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 2, p: 1.5, boxShadow: '0 8px 24px rgba(15,23,42,0.10)' }}>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.25 }}>{label}</Typography>
      {payload.map((e: any) => (
        <Typography key={e.dataKey} variant="body2" fontWeight={700} sx={{ color: e.color }}>
          {e.name}: {e.dataKey === 'revenue' ? formatCurrency(e.value) : e.value}
        </Typography>
      ))}
    </Box>
  );
};

// ── Main Dashboard ─────────────────────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const dispatch = useAppDispatch();
  const { stats } = useAppSelector((state) => state.admin);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<RegionFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [revenueTimeSeries, setRevenueTimeSeries] = useState<Array<{ date: string; revenue: number; trips: number }>>([]);
  const { t } = useTranslation();
  const googleMapsApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [statsRes, driversRes, ridesRes, paymentsRes] = await Promise.all([
          adminApi.getStats(),
          adminApi.getDrivers({ limit: 500 }),
          adminApi.getRides({ limit: 200 }),
          adminApi.getPayments({ limit: 200 }),
        ]);

        dispatch(setStats(statsRes.data?.stats || null));
        // Heatmap only counts drivers who are actively ONLINE — feeding offline
        // drivers in misleads operators (they see "hot zones" of drivers who
        // logged out hours ago).
        setDrivers(
          (driversRes.data?.drivers || []).filter(
            (d) => d.currentLocation && d.isOnline === true,
          ),
        );
        setRides(ridesRes.data?.rides || []);
        setPayments(paymentsRes.data?.payments || []);
        setError('');
      } catch {
        setError(t('dashboard.loadStatsFailed'));
      } finally {
        setLoading(false);
      }
    };

    const fetchRevenue = async () => {
      try {
        const res = await adminApi.getRevenueAnalytics(14);
        setRevenueTimeSeries(res.data?.dailyRevenue || []);
      } catch { /* non-critical */ }
    };

    fetchDashboard();
    fetchRevenue();

    const interval = window.setInterval(fetchDashboard, 15000);
    const unsub = adminSocketService.subscribe(fetchDashboard);

    return () => {
      window.clearInterval(interval);
      unsub();
    };
  }, [dispatch, t]);

  const filteredDrivers = useMemo(
    () => drivers.filter((d) => matchesRegion(d, selectedRegion)),
    [drivers, selectedRegion]
  );

  const mapCenter = useMemo(() => {
    if (!filteredDrivers.length) return defaultCenter;
    const lat = filteredDrivers.reduce((s, d) => s + (d.currentLocation?.lat || 0), 0) / filteredDrivers.length;
    const lng = filteredDrivers.reduce((s, d) => s + (d.currentLocation?.lng || 0), 0) / filteredDrivers.length;
    return { lat, lng };
  }, [filteredDrivers]);

  const completionRate = stats && stats.rides.total > 0
    ? Math.round((stats.rides.completed / stats.rides.total) * 100)
    : 0;

  const cancellationRate = stats && stats.rides.total > 0
    ? Math.round((stats.rides.cancelled / stats.rides.total) * 100)
    : 0;

  const onlineRatio = stats && stats.drivers.total > 0
    ? Math.round((stats.drivers.online / stats.drivers.total) * 100)
    : 0;

  const completedPayments = payments.filter((p) => p.status === 'COMPLETED');
  const cashCount = completedPayments.filter((p) => p.method === 'CASH').length;
  const onlinePaymentCount = completedPayments.length - cashCount;
  const onlinePaymentRate = completedPayments.length > 0
    ? Math.round((onlinePaymentCount / completedPayments.length) * 100)
    : 0;

  // Last-hour mini-stats (replaces the realtime events card). Operators care
  // about momentum more than a feed of generic events: how busy is the last
  // hour vs the previous hour?
  const lastHourStats = useMemo(() => {
    const nowMs = Date.now();
    const hourMs = 60 * 60 * 1000;
    const within = (iso: string | undefined, fromMs: number, toMs: number) => {
      if (!iso) return false;
      const t = new Date(iso).getTime();
      return t >= fromMs && t < toMs;
    };
    const ridesLastHour = rides.filter((r) => within(r.createdAt, nowMs - hourMs, nowMs));
    const ridesPrevHour = rides.filter((r) => within(r.createdAt, nowMs - 2 * hourMs, nowMs - hourMs));
    const completedLastHour = ridesLastHour.filter((r) => r.status === 'COMPLETED').length;
    const completionRateLastHour = ridesLastHour.length > 0
      ? Math.round((completedLastHour / ridesLastHour.length) * 100)
      : 0;
    const revenueLastHour = completedPayments
      .filter((p) => within(p.updatedAt || p.createdAt, nowMs - hourMs, nowMs))
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const revenuePrevHour = completedPayments
      .filter((p) => within(p.updatedAt || p.createdAt, nowMs - 2 * hourMs, nowMs - hourMs))
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const delta = (cur: number, prev: number) => {
      if (prev === 0) return cur > 0 ? 100 : 0;
      return Math.round(((cur - prev) / prev) * 100);
    };

    return {
      ridesLastHour: ridesLastHour.length,
      ridesDeltaPct: delta(ridesLastHour.length, ridesPrevHour.length),
      revenueLastHour,
      revenueDeltaPct: delta(revenueLastHour, revenuePrevHour),
      completionRateLastHour,
    };
  }, [rides, completedPayments]);

  // Chart: hourly ride buckets (last 6 hours)
  const hourlyBuckets = useMemo(() => {
    const buckets = new Map<string, { time: string; rides: number; completedPay: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setHours(d.getHours() - i, 0, 0, 0);
      const key = `${String(d.getHours()).padStart(2, '0')}:00`;
      buckets.set(key, { time: key, rides: 0, completedPay: 0 });
    }
    rides.forEach((r) => {
      const h = `${String(new Date(r.createdAt).getHours()).padStart(2, '0')}:00`;
      const b = buckets.get(h);
      if (b) b.rides += 1;
    });
    completedPayments.forEach((p) => {
      const h = `${String(new Date(p.updatedAt || p.createdAt).getHours()).padStart(2, '0')}:00`;
      const b = buckets.get(h);
      if (b) b.completedPay += 1;
    });
    return Array.from(buckets.values());
  }, [rides, completedPayments]);

  const leafletFallback = (
    <LeafletMapContainer
      center={[mapCenter.lat, mapCenter.lng]}
      zoom={12}
      style={{ width: '100%', height: '100%' }}
      zoomControl
      scrollWheelZoom
    >
      <LeafletTileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={20}
      />
      <LeafletHeatLayer drivers={filteredDrivers} />
      <RegionBoundsController region={selectedRegion} fallbackCenter={mapCenter} />
    </LeafletMapContainer>
  );

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><CircularProgress size={56} /></Box>;
  }

  if (error) {
    return <Alert severity="error" sx={{ m: 3, borderRadius: 3 }}>{error}</Alert>;
  }

  if (!stats) {
    return <Alert severity="info" sx={{ m: 3, borderRadius: 3 }}>{t('dashboard.noStats')}</Alert>;
  }

  return (
    <Box sx={{ p: 3, minHeight: '100%', background: 'radial-gradient(circle at top left, rgba(90,127,184,0.10), transparent 34%), linear-gradient(180deg, #f7f9fc 0%, #eef3f9 100%)' }}>

      {/* ── Page Header ── */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={900}>{t('dashboard.title')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Giám sát thời gian thực · {new Date().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip icon={<DriveEta />} label={`${stats.drivers.online} / ${stats.drivers.total} online`} color="success" variant="outlined" />
          <Chip icon={<DirectionsCar />} label={`${stats.rides.active + stats.rides.pending} chuyến đang chạy`} color="primary" variant="outlined" />
        </Stack>
      </Stack>

      {/* ── KPI Row 1: Operational ── */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={3}>
          <StatCard title="Tổng chuyến hôm nay" value={stats.rides.today} caption={`Tổng: ${formatNumber(stats.rides.total)}`} icon={<DirectionsCar sx={{ fontSize: 40 }} />} tone="#dbeafe" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Tài xế online" value={`${stats.drivers.online} / ${stats.drivers.total}`} caption={`${onlineRatio}% đang kết nối`} icon={<DriveEta sx={{ fontSize: 40 }} />} tone="#dcfce7" trend="neutral" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Doanh thu hôm nay" value={formatCurrency(stats.revenue.today)} caption={`Tuần: ${formatCurrency(stats.revenue.week)}`} icon={<AttachMoney sx={{ fontSize: 40 }} />} tone="#fef3c7" trend="up" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Khách hàng" value={formatNumber(stats.customers.total)} caption="Tổng đã đăng ký" icon={<People sx={{ fontSize: 40 }} />} tone="#ede9fe" />
        </Grid>
      </Grid>

      {/* ── KPI Row 2: Quality / Business ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <StatCard
            title="Tỷ lệ hoàn thành"
            value={`${completionRate}%`}
            caption={`${stats.rides.completed} chuyến thành công`}
            icon={<CheckCircle sx={{ fontSize: 40 }} />}
            tone="#d1fae5"
            trend={completionRate >= 80 ? 'up' : 'down'}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            title="Tỷ lệ hủy"
            value={`${cancellationRate}%`}
            caption={`${stats.rides.cancelled} chuyến bị hủy`}
            icon={<TrendingDown sx={{ fontSize: 40 }} />}
            tone={cancellationRate > 20 ? '#fee2e2' : '#f1f5f9'}
            trend={cancellationRate > 20 ? 'down' : 'up'}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            title="Thanh toán online"
            value={`${onlinePaymentRate}%`}
            caption={`${onlinePaymentCount} / ${completedPayments.length} giao dịch`}
            icon={<TrendingUp sx={{ fontSize: 40 }} />}
            tone="#e0f2fe"
            trend="up"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            title="Đang chờ & đang chạy"
            value={stats.rides.pending + stats.rides.active}
            caption={`${stats.rides.pending} chờ • ${stats.rides.active} đang chạy`}
            icon={<Warning sx={{ fontSize: 40 }} />}
            tone="#fff7ed"
          />
        </Grid>
      </Grid>

      {/* ── Tab Navigation ── */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab label="Bản đồ & Vận hành" />
          <Tab label="Phân tích thời gian" />
          <Tab label="Cung – Cầu" />
        </Tabs>
      </Box>

      {/* ── Tab 0: Map + Operations ── */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          {/* Heatmap */}
          <Grid item xs={12} lg={8}>
            <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 20px 48px rgba(15,23,42,0.08)', overflow: 'hidden' }}>
              <Box sx={{ p: 2.5, pb: 1.5 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5}>
                  <SectionHeader icon={<MyLocation />} title="Bản đồ nhiệt tài xế" subtitle="Màu đỏ = mật độ cao · Màu xanh = thưa" />
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>{t('dashboardExtras.region')}</InputLabel>
                    <Select
                      value={selectedRegion}
                      label={t('dashboardExtras.region')}
                      onChange={(e) => setSelectedRegion(e.target.value as RegionFilter)}
                    >
                      {regionOptions.map((o) => (
                        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={`${filteredDrivers.length} vị trí`} icon={<MyLocation />} color="primary" variant="outlined" />
                  <Chip size="small" label="Đỏ: mật độ cao" sx={{ bgcolor: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)' }} />
                  <Chip size="small" label="Vàng: trung bình" sx={{ bgcolor: 'rgba(234,179,8,0.1)', color: '#ca8a04', border: '1px solid rgba(234,179,8,0.3)' }} />
                  <Chip size="small" label="Xanh: ít" sx={{ bgcolor: 'rgba(59,130,246,0.1)', color: '#2563eb', border: '1px solid rgba(59,130,246,0.3)' }} />
                </Stack>
              </Box>
              <Box sx={{ height: 480 }}>
                {Boolean(googleMapsApiKey.trim()) ? (
                  <GoogleDriverHeatmap
                    googleMapsApiKey={googleMapsApiKey}
                    mapCenter={mapCenter}
                    drivers={filteredDrivers}
                    fallback={leafletFallback}
                  />
                ) : leafletFallback}
              </Box>
            </Card>
          </Grid>

          {/* Operations sidebar */}
          <Grid item xs={12} lg={4}>
            <Stack spacing={2.5}>
              {/* Ride status */}
              <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 12px 32px rgba(15,23,42,0.07)' }}>
                <CardContent>
                  <SectionHeader icon={<DirectionsCar />} title="Trạng thái chuyến đi" />
                  {[
                    { label: 'Chờ tài xế', value: stats.rides.pending, color: '#f59e0b' },
                    { label: 'Đang chạy', value: stats.rides.active, color: '#3b82f6' },
                    { label: 'Hoàn thành', value: stats.rides.completed, color: '#22c55e' },
                    { label: 'Đã hủy', value: stats.rides.cancelled, color: '#ef4444' },
                  ].map(({ label, value, color }) => (
                    <Stack key={label} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1, borderBottom: '1px solid rgba(148,163,184,0.10)' }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
                        <Typography variant="body2" color="text.secondary">{label}</Typography>
                      </Stack>
                      <Typography variant="body2" fontWeight={700}>{value}</Typography>
                    </Stack>
                  ))}
                </CardContent>
              </Card>

              {/* Driver supply */}
              <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 12px 32px rgba(15,23,42,0.07)' }}>
                <CardContent>
                  <SectionHeader icon={<DriveEta />} title="Nguồn cung tài xế" />
                  {[
                    { label: 'Đang rảnh (online)', value: stats.drivers.online, color: '#22c55e' },
                    { label: 'Đang chở khách', value: stats.drivers.busy, color: '#3b82f6' },
                    { label: 'Offline', value: stats.drivers.offline, color: '#94a3b8' },
                  ].map(({ label, value, color }) => {
                    const total = stats.drivers.total || 1;
                    const pct = Math.round((value / total) * 100);
                    return (
                      <Box key={label} sx={{ mb: 1.5 }}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">{label}</Typography>
                          <Typography variant="body2" fontWeight={700}>{value} ({pct}%)</Typography>
                        </Stack>
                        <Box sx={{ mt: 0.5, height: 6, borderRadius: 3, bgcolor: 'rgba(148,163,184,0.15)', overflow: 'hidden' }}>
                          <Box sx={{ height: '100%', width: `${pct}%`, borderRadius: 3, bgcolor: color, transition: 'width 0.4s ease' }} />
                        </Box>
                      </Box>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Last-hour mini stats */}
              <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 12px 32px rgba(15,23,42,0.07)' }}>
                <CardContent>
                  <SectionHeader
                    icon={<TrendingUp />}
                    title="Nhịp 1 giờ qua"
                    subtitle="So với cùng khung giờ trước đó"
                  />
                  <Stack spacing={1.25}>
                    {[
                      {
                        label: 'Chuyến / giờ',
                        value: formatNumber(lastHourStats.ridesLastHour),
                        delta: lastHourStats.ridesDeltaPct,
                        color: '#3b82f6',
                      },
                      {
                        label: 'Doanh thu / giờ',
                        value: formatCurrency(lastHourStats.revenueLastHour),
                        delta: lastHourStats.revenueDeltaPct,
                        color: '#16a34a',
                      },
                      {
                        label: 'Tỉ lệ hoàn tất',
                        value: `${lastHourStats.completionRateLastHour}%`,
                        delta: null,
                        color: lastHourStats.completionRateLastHour >= 80 ? '#16a34a' : '#dc2626',
                      },
                    ].map((row) => (
                      <Box
                        key={row.label}
                        sx={{
                          p: 1.5,
                          borderRadius: 2.5,
                          bgcolor: 'rgba(241,245,249,0.6)',
                          border: '1px solid rgba(148,163,184,0.12)',
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" color="text.secondary">{row.label}</Typography>
                          {row.delta !== null && (
                            <Chip
                              size="small"
                              icon={row.delta >= 0 ? <TrendingUp sx={{ fontSize: 14 }} /> : <TrendingDown sx={{ fontSize: 14 }} />}
                              label={`${row.delta >= 0 ? '+' : ''}${row.delta}%`}
                              sx={{
                                height: 22,
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: row.delta >= 0 ? '#16a34a' : '#dc2626',
                                bgcolor: row.delta >= 0 ? 'rgba(22,163,74,0.10)' : 'rgba(220,38,38,0.10)',
                                '& .MuiChip-icon': { color: 'inherit' },
                              }}
                            />
                          )}
                        </Stack>
                        <Typography variant="h6" fontWeight={800} sx={{ mt: 0.25, color: row.color }}>
                          {row.value}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Grid>
        </Grid>
      )}

      {/* ── Tab 1: Time Analysis ── */}
      {activeTab === 1 && (
        <Grid container spacing={3}>
          {/* Revenue 14-day trend */}
          <Grid item xs={12} lg={8}>
            <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.07)' }}>
              <CardContent sx={{ p: 3 }}>
                <SectionHeader icon={<AttachMoney />} title="Xu hướng doanh thu 14 ngày" subtitle="Dữ liệu từ trang Báo cáo" />
                {revenueTimeSeries.length === 0 ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
                    <Typography variant="body2" color="text.secondary">Chưa có dữ liệu. Vào trang Báo cáo để xem phân tích đầy đủ.</Typography>
                  </Box>
                ) : (
                  <Box sx={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueTimeSeries.slice(-14)} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#5a7fb8" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#5a7fb8" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) => {
                            const dt = new Date(d);
                            return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
                          }}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          tickLine={false}
                        />
                        <YAxis
                          tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}K`}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip content={<RevenueTooltip />} />
                        <Area type="monotone" dataKey="revenue" name="Doanh thu" stroke="#5a7fb8" strokeWidth={2.5} fill="url(#revGrad)" dot={false} activeDot={{ r: 5 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Hourly timeline */}
          <Grid item xs={12} lg={4}>
            <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.07)', height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <SectionHeader icon={<Warning />} title="Hoạt động 6 giờ gần nhất" />
                <Stack spacing={1}>
                  {hourlyBuckets.map((b) => (
                    <Box key={b.time} sx={{ p: 1.5, borderRadius: 3, bgcolor: '#f8fafc', border: '1px solid rgba(148,163,184,0.12)' }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" fontWeight={700}>{b.time}</Typography>
                        <Stack direction="row" spacing={1.5}>
                          <Typography variant="caption" color="text.secondary">{b.rides} chuyến</Typography>
                          <Typography variant="caption" color="success.main">{b.completedPay} thanh toán</Typography>
                        </Stack>
                      </Stack>
                      <Box sx={{ mt: 0.75, height: 4, borderRadius: 2, bgcolor: 'rgba(148,163,184,0.15)' }}>
                        <Box
                          sx={{
                            height: '100%',
                            borderRadius: 2,
                            bgcolor: '#5a7fb8',
                            width: `${Math.min(100, (b.rides / Math.max(...hourlyBuckets.map((x) => x.rides), 1)) * 100)}%`,
                          }}
                        />
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Payment breakdown */}
          <Grid item xs={12}>
            <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.07)' }}>
              <CardContent sx={{ p: 3 }}>
                <SectionHeader icon={<AttachMoney />} title="Thanh toán hôm nay" subtitle="Phân tích giao dịch thực hiện trong phiên hiện tại" />
                <Grid container spacing={2}>
                  {[
                    { label: 'Đã hoàn thành', value: stats.payments.completed, color: '#22c55e', pct: Math.round((stats.payments.completed / Math.max(stats.payments.completed + stats.payments.pending + stats.payments.failed, 1)) * 100) },
                    { label: 'Đang xử lý', value: stats.payments.pending, color: '#f59e0b', pct: Math.round((stats.payments.pending / Math.max(stats.payments.completed + stats.payments.pending + stats.payments.failed, 1)) * 100) },
                    { label: 'Thất bại', value: stats.payments.failed, color: '#ef4444', pct: Math.round((stats.payments.failed / Math.max(stats.payments.completed + stats.payments.pending + stats.payments.failed, 1)) * 100) },
                    { label: 'Tỷ lệ online', value: `${onlinePaymentRate}%`, color: '#6366f1', pct: onlinePaymentRate },
                  ].map(({ label, value, color, pct }) => (
                    <Grid item xs={6} sm={3} key={label}>
                      <Box sx={{ textAlign: 'center', p: 2, borderRadius: 3, bgcolor: '#f8fafc' }}>
                        <Typography variant="h5" fontWeight={900} sx={{ color }}>{value}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{label}</Typography>
                        <Box sx={{ mt: 1, height: 4, borderRadius: 2, bgcolor: 'rgba(148,163,184,0.2)' }}>
                          <Box sx={{ height: '100%', borderRadius: 2, bgcolor: color, width: `${pct}%` }} />
                        </Box>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* ── Tab 2: Supply-Demand ── */}
      {activeTab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.07)' }}>
              <CardContent sx={{ p: 3 }}>
                <SectionHeader icon={<DriveEta />} title="Cân bằng cung – cầu" />
                <Stack spacing={2}>
                  {[
                    {
                      label: 'Tài xế / Chuyến chờ',
                      supply: stats.drivers.online,
                      demand: stats.rides.pending,
                      status: stats.drivers.online >= stats.rides.pending * 2 ? 'Cung dư' : stats.drivers.online < stats.rides.pending ? 'Thiếu tài xế' : 'Cân bằng',
                      color: stats.drivers.online >= stats.rides.pending * 2 ? '#22c55e' : stats.drivers.online < stats.rides.pending ? '#ef4444' : '#f59e0b',
                    },
                  ].map(({ label, supply, demand, status, color }) => (
                    <Box key={label} sx={{ p: 2, borderRadius: 3, bgcolor: '#f8fafc' }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" fontWeight={700}>{label}</Typography>
                        <Chip size="small" label={status} sx={{ bgcolor: color + '22', color, fontWeight: 700 }} />
                      </Stack>
                      <Stack direction="row" spacing={3} sx={{ mt: 1.5 }}>
                        <Box>
                          <Typography variant="h5" fontWeight={900} color="primary.main">{supply}</Typography>
                          <Typography variant="caption" color="text.secondary">Cung (online drivers)</Typography>
                        </Box>
                        <Box>
                          <Typography variant="h5" fontWeight={900} color="warning.main">{demand}</Typography>
                          <Typography variant="caption" color="text.secondary">Cầu (pending rides)</Typography>
                        </Box>
                      </Stack>
                    </Box>
                  ))}

                  <Box sx={{ p: 2, borderRadius: 3, bgcolor: '#f0fdf4' }}>
                    <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1, color: '#15803d' }}>Hiệu suất vận hành</Typography>
                    {[
                      { label: 'Tỷ lệ hoàn thành', value: `${completionRate}%`, good: completionRate >= 80 },
                      { label: 'Tỷ lệ hủy chuyến', value: `${cancellationRate}%`, good: cancellationRate <= 15 },
                      { label: 'Tài xế đang sử dụng', value: `${onlineRatio}%`, good: onlineRatio >= 30 },
                      { label: 'Thanh toán online', value: `${onlinePaymentRate}%`, good: onlinePaymentRate >= 30 },
                    ].map(({ label, value, good }) => (
                      <Stack key={label} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.75 }}>
                        <Typography variant="body2" color="text.secondary">{label}</Typography>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: good ? '#22c55e' : '#ef4444' }} />
                          <Typography variant="body2" fontWeight={700}>{value}</Typography>
                        </Stack>
                      </Stack>
                    ))}
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.07)', height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <SectionHeader icon={<Warning />} title="Cảnh báo hệ thống" subtitle="Chỉ số cần chú ý của điều vận" />
                <Stack spacing={1.5}>
                  {[
                    {
                      condition: stats.rides.pending > stats.drivers.online,
                      severity: 'error' as const,
                      msg: `Thiếu tài xế: ${stats.rides.pending} chuyến chờ vs ${stats.drivers.online} tài xế online`,
                    },
                    {
                      condition: cancellationRate > 25,
                      severity: 'warning' as const,
                      msg: `Tỷ lệ hủy cao: ${cancellationRate}% (ngưỡng an toàn < 25%)`,
                    },
                    {
                      condition: stats.payments.failed > 3,
                      severity: 'warning' as const,
                      msg: `${stats.payments.failed} giao dịch thất bại cần kiểm tra`,
                    },
                    {
                      condition: onlineRatio < 15 && stats.drivers.total > 0,
                      severity: 'info' as const,
                      msg: `Tỷ lệ tài xế online thấp: chỉ ${onlineRatio}%`,
                    },
                  ]
                    .filter((a) => a.condition)
                    .map((alert) => (
                      <Alert key={alert.msg} severity={alert.severity} sx={{ borderRadius: 3 }}>
                        {alert.msg}
                      </Alert>
                    ))}

                  {[
                    stats.rides.pending <= stats.drivers.online,
                    cancellationRate <= 25,
                    stats.payments.failed <= 3,
                    onlineRatio >= 15 || stats.drivers.total === 0,
                  ].every(Boolean) && (
                    <Alert severity="success" sx={{ borderRadius: 3 }}>
                      Tất cả chỉ số vận hành trong ngưỡng an toàn.
                    </Alert>
                  )}

                  <Box sx={{ mt: 1, p: 2, borderRadius: 3, bgcolor: '#f8fafc' }}>
                    <Typography variant="subtitle2" fontWeight={800} gutterBottom>Tóm tắt tài chính</Typography>
                    <Stack spacing={0.75}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Doanh thu hôm nay</Typography>
                        <Typography variant="body2" fontWeight={700} color="primary.main">{formatCurrency(stats.revenue.today)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Doanh thu tuần</Typography>
                        <Typography variant="body2" fontWeight={700}>{formatCurrency(stats.revenue.week)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Doanh thu tháng</Typography>
                        <Typography variant="body2" fontWeight={700}>{formatCurrency(stats.revenue.month)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Tổng tích lũy</Typography>
                        <Typography variant="body2" fontWeight={700}>{formatCurrency(stats.revenue.total)}</Typography>
                      </Stack>
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default Dashboard;
