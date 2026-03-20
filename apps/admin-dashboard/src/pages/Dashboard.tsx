import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Card, CardContent, Chip, CircularProgress, FormControl, Grid, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material';
import { AttachMoney, DirectionsCar, DriveEta, Explore, MyLocation, Payments, People, Timeline } from '@mui/icons-material';
import { GoogleMap, HeatmapLayerF, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import L from 'leaflet';
import { Circle as LeafletCircle, CircleMarker as LeafletCircleMarker, MapContainer as LeafletMapContainer, TileLayer as LeafletTileLayer, useMap } from 'react-leaflet';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../api/admin.api';
import { AdminRealtimeEvent, adminSocketService } from '../socket/admin.socket';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setStats } from '../store/admin.slice';
import { Driver, Payment, Ride } from '../types';
import { formatCurrency, formatDate, formatNumber } from '../utils/format.utils';

const mapLibraries: ('visualization')[] = ['visualization'];
const defaultCenter = { lat: 10.7769, lng: 106.7009 };
const heatmapGradient = [
  'rgba(14, 165, 233, 0)',
  'rgba(14, 165, 233, 1)',
  'rgba(59, 130, 246, 1)',
  'rgba(249, 115, 22, 1)',
  'rgba(220, 38, 38, 1)',
];
const darkMapStyles: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#111827' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#d1d5db' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#111827' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2563eb' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
];

type RegionFilter = 'ALL' | 'NORTH' | 'CENTRAL' | 'SOUTH';

interface HotspotSummary {
  key: string;
  label: string;
  center: { lat: number; lng: number };
  driverCount: number;
  avgRating: number;
}

interface DashboardTimelinePoint {
  time: string;
  rides: number;
  completedPayments: number;
  onlineDrivers: number;
}

const regionOptions: Array<{ value: RegionFilter; label: string }> = [
  { value: 'ALL', label: 'Toàn thành phố' },
  { value: 'NORTH', label: 'Phía Bắc' },
  { value: 'CENTRAL', label: 'Trung tâm' },
  { value: 'SOUTH', label: 'Phía Nam' },
];

const StatCard: React.FC<{ title: string; value: string | number; caption: string; icon: React.ReactNode; tone: string }> = ({ title, value, caption, icon, tone }) => (
  <Card elevation={0} sx={{ height: '100%', borderRadius: 5, color: '#0f172a', background: `linear-gradient(160deg, ${tone} 0%, #ffffff 80%)`, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 20px 45px rgba(15,23,42,0.08)' }}>
    <CardContent>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="body2" color="text.secondary">{title}</Typography>
          <Typography variant="h4" fontWeight={900} sx={{ my: 1 }}>{value}</Typography>
          <Typography variant="caption" color="text.secondary">{caption}</Typography>
        </Box>
        <Box sx={{ color: '#0f172a', opacity: 0.8 }}>{icon}</Box>
      </Stack>
    </CardContent>
  </Card>
);

function matchesRegion(driver: Driver, region: RegionFilter): boolean {
  if (region === 'ALL' || !driver.currentLocation) {
    return true;
  }

  const { lat, lng } = driver.currentLocation;

  if (region === 'NORTH') {
    return lat >= 10.82;
  }

  if (region === 'SOUTH') {
    return lat < 10.74;
  }

  return lat >= 10.74 && lat < 10.82 && lng >= 106.63 && lng <= 106.75;
}

function bucketLabel(date: string) {
  const value = new Date(date);
  return `${String(value.getHours()).padStart(2, '0')}:00`;
}

function buildTimeline(rides: Ride[], payments: Payment[], drivers: Driver[]): DashboardTimelinePoint[] {
  const buckets = new Map<string, DashboardTimelinePoint>();

  for (let index = 5; index >= 0; index -= 1) {
    const point = new Date();
    point.setHours(point.getHours() - index, 0, 0, 0);
    const label = bucketLabel(point.toISOString());
    buckets.set(label, { time: label, rides: 0, completedPayments: 0, onlineDrivers: 0 });
  }

  rides.forEach((ride) => {
    const bucket = buckets.get(bucketLabel(ride.createdAt));
    if (bucket) {
      bucket.rides += 1;
    }
  });

  payments.filter((payment) => payment.status === 'COMPLETED').forEach((payment) => {
    const bucket = buckets.get(bucketLabel(payment.updatedAt || payment.createdAt));
    if (bucket) {
      bucket.completedPayments += 1;
    }
  });

  const currentBucket = buckets.get(bucketLabel(new Date().toISOString()));
  if (currentBucket) {
    currentBucket.onlineDrivers = drivers.filter((driver) => driver.isOnline || driver.isAvailable).length;
  }

  return Array.from(buckets.values());
}

function buildHotspots(drivers: Driver[]): HotspotSummary[] {
  const clusters = new Map<string, HotspotSummary>();

  drivers.forEach((driver) => {
    if (!driver.currentLocation) {
      return;
    }

    const bucketLat = Math.round(driver.currentLocation.lat * 100) / 100;
    const bucketLng = Math.round(driver.currentLocation.lng * 100) / 100;
    const key = `${bucketLat}-${bucketLng}`;
    const current = clusters.get(key);

    if (!current) {
      clusters.set(key, {
        key,
        label: `${bucketLat.toFixed(2)}, ${bucketLng.toFixed(2)}`,
        center: { lat: bucketLat, lng: bucketLng },
        driverCount: 1,
        avgRating: driver.rating || 0,
      });
      return;
    }

    const nextCount = current.driverCount + 1;
    current.avgRating = (current.avgRating * current.driverCount + (driver.rating || 0)) / nextCount;
    current.driverCount = nextCount;
  });

  return Array.from(clusters.values()).sort((left, right) => right.driverCount - left.driverCount).slice(0, 4);
}

function createInitialRealtimeEvent(): AdminRealtimeEvent {
  return {
    id: 'dashboard-mounted',
    type: 'ride:created',
    timestamp: new Date().toISOString(),
    title: 'Bảng điều khiển realtime',
    detail: 'Bảng điều khiển đã vào chế độ theo dõi realtime và sẽ cập nhật khi hệ thống có biến động.',
    tone: 'info',
  };
}

const hotspotPalette = ['#dc2626', '#f97316', '#2563eb', '#0ea5e9'];

function getHotspotColor(index: number) {
  return hotspotPalette[index] || '#64748b';
}

const HeatmapViewportController: React.FC<{ drivers: Driver[]; hotspots: HotspotSummary[] }> = ({ drivers, hotspots }) => {
  const map = useMap();

  useEffect(() => {
    const points = [
      ...drivers
        .filter((driver) => driver.currentLocation)
        .map((driver) => [driver.currentLocation!.lat, driver.currentLocation!.lng] as [number, number]),
      ...hotspots.map((hotspot) => [hotspot.center.lat, hotspot.center.lng] as [number, number]),
    ];

    if (!points.length) {
      map.setView([defaultCenter.lat, defaultCenter.lng], 12, { animate: true });
      return;
    }

    if (points.length === 1) {
      map.setView(points[0], 14, { animate: true });
      return;
    }

    map.fitBounds(L.latLngBounds(points), {
      padding: [48, 48],
      animate: true,
    });
  }, [drivers, hotspots, map]);

  return null;
};

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

  if (loadError) {
    return <>{fallback}</>;
  }

  if (!isLoaded) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box>;
  }

  const heatmapData = drivers.map((driver) => new google.maps.LatLng(driver.currentLocation!.lat, driver.currentLocation!.lng));

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
        rotateControl: false,
        clickableIcons: false,
        styles: darkMapStyles,
      }}
    >
      {heatmapData.length > 0 && <HeatmapLayerF data={heatmapData} options={{ radius: 38, opacity: 0.7, gradient: heatmapGradient }} />}
      {drivers.slice(0, 120).map((driver) => <MarkerF key={driver.id} position={{ lat: driver.currentLocation!.lat, lng: driver.currentLocation!.lng }} title={`${driver.user?.firstName || 'Driver'} ${driver.user?.lastName || ''}`.trim()} />)}
    </GoogleMap>
  );
};

const Dashboard: React.FC = () => {
  const dispatch = useAppDispatch();
  const { stats } = useAppSelector((state) => state.admin);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<RegionFilter>('ALL');
  const [realtimeEvents, setRealtimeEvents] = useState<AdminRealtimeEvent[]>([createInitialRealtimeEvent()]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { t } = useTranslation();
  const googleMapsApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [statsResponse, driversResponse, ridesResponse, paymentsResponse] = await Promise.all([
          adminApi.getStats(),
          adminApi.getDrivers({ limit: 500 }),
          adminApi.getRides({ limit: 200 }),
          adminApi.getPayments({ limit: 200 }),
        ]);

        dispatch(setStats(statsResponse.data?.stats || null));
        setDrivers((driversResponse.data?.drivers || []).filter((driver) => driver.currentLocation));
        setRides(ridesResponse.data?.rides || []);
        setPayments(paymentsResponse.data?.payments || []);
        setError('');
      } catch (err: any) {
        setError(t('dashboard.loadStatsFailed'));
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
    const interval = window.setInterval(fetchDashboard, 15000);
    const unsubscribe = adminSocketService.subscribe(fetchDashboard);
    const unsubscribeEvents = adminSocketService.subscribeToEvents((event) => {
      setRealtimeEvents((current) => [event, ...current].slice(0, 8));
    });

    return () => {
      window.clearInterval(interval);
      unsubscribe();
      unsubscribeEvents();
    };
  }, [dispatch, t]);

  const filteredDrivers = useMemo(() => drivers.filter((driver) => matchesRegion(driver, selectedRegion)), [drivers, selectedRegion]);

  const mapCenter = useMemo(() => {
    if (!filteredDrivers.length) {
      return defaultCenter;
    }

    const lat = filteredDrivers.reduce((sum, driver) => sum + (driver.currentLocation?.lat || 0), 0) / filteredDrivers.length;
    const lng = filteredDrivers.reduce((sum, driver) => sum + (driver.currentLocation?.lng || 0), 0) / filteredDrivers.length;
    return { lat, lng };
  }, [filteredDrivers]);

  const hotspots = useMemo(() => buildHotspots(filteredDrivers), [filteredDrivers]);
  const timeline = useMemo(() => buildTimeline(rides, payments, filteredDrivers), [filteredDrivers, payments, rides]);
  const hasGoogleMapsApiKey = Boolean(googleMapsApiKey.trim());

  const leafletHeatmap = (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <LeafletMapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={12} style={{ width: '100%', height: '100%' }} zoomControl scrollWheelZoom>
        <LeafletTileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          maxZoom={20}
        />
        <HeatmapViewportController drivers={filteredDrivers} hotspots={hotspots} />
        {hotspots.map((hotspot, index) => {
          const color = getHotspotColor(index);
          return (
            <LeafletCircle
              key={hotspot.key}
              center={[hotspot.center.lat, hotspot.center.lng]}
              radius={Math.max(260, hotspot.driverCount * 170)}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.14,
                opacity: 0.6,
                weight: 2,
              }}
            />
          );
        })}
        {filteredDrivers.slice(0, 220).map((driver) => (
          <LeafletCircleMarker
            key={driver.id}
            center={[driver.currentLocation!.lat, driver.currentLocation!.lng]}
            radius={driver.isOnline || driver.isAvailable ? 7 : 5}
            pathOptions={{
              color: '#ffffff',
              weight: 2,
              fillColor: driver.isOnline || driver.isAvailable ? '#2563eb' : '#94a3b8',
              fillOpacity: 0.95,
            }}
          />
        ))}
      </LeafletMapContainer>
      <Alert severity="info" sx={{ position: 'absolute', top: 16, left: 16, right: 16, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.92)' }}>
        {t('dashboardExtras.fallbackMap')}
      </Alert>
    </Box>
  );

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><CircularProgress size={60} /></Box>;
  }

  if (error) {
    return <Alert severity="error" sx={{ m: 3, borderRadius: 3 }}>{error}</Alert>;
  }

  if (!stats) {
    return <Alert severity="info" sx={{ m: 3, borderRadius: 3 }}>{t('dashboard.noStats')}</Alert>;
  }

  return (
    <Box sx={{ p: 3, minHeight: '100%', background: 'radial-gradient(circle at top left, rgba(59,130,246,0.14), transparent 32%), linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%)' }}>
      <Typography variant="h4" fontWeight={900} gutterBottom>{t('dashboard.title')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{t('dashboardExtras.overviewBody')}</Typography>

      <Grid container spacing={3} sx={{ mb: 1 }}>
        <Grid item xs={12} sm={6} md={3}><StatCard title={t('dashboard.totalRides')} value={formatNumber(stats.rides.total)} caption={`+${stats.rides.today} ${t('dashboard.today')}`} icon={<DirectionsCar sx={{ fontSize: 44 }} />} tone="#dbeafe" /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard title={t('dashboard.onlineDrivers')} value={stats.drivers.online} caption={`${stats.drivers.busy} ${t('dashboardExtras.busy')}, ${stats.drivers.offline} ${t('labels.offline').toLowerCase()}`} icon={<DriveEta sx={{ fontSize: 44 }} />} tone="#dcfce7" /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard title={t('dashboard.totalCustomers')} value={formatNumber(stats.customers.total)} caption={`${stats.customers.active} ${t('dashboard.active')}`} icon={<People sx={{ fontSize: 44 }} />} tone="#ede9fe" /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard title={t('dashboard.todayRevenue')} value={formatCurrency(stats.revenue.today)} caption={`${t('dashboard.month')}: ${formatCurrency(stats.revenue.month)}`} icon={<AttachMoney sx={{ fontSize: 44 }} />} tone="#fef3c7" /></Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Card elevation={0} sx={{ borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 24px 50px rgba(15,23,42,0.08)' }}>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ p: 3, pb: 2 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
                  <Box>
                    <Typography variant="h6" fontWeight={800}>{t('dashboardExtras.heatmapTitle')}</Typography>
                    <Typography variant="body2" color="text.secondary">{t('dashboardExtras.heatmapBody')}</Typography>
                  </Box>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <FormControl size="small" sx={{ minWidth: 170 }}>
                      <InputLabel id="region-filter-label">{t('dashboardExtras.region')}</InputLabel>
                      <Select
                        labelId="region-filter-label"
                        value={selectedRegion}
                        label={t('dashboardExtras.region')}
                        onChange={(event) => setSelectedRegion(event.target.value as RegionFilter)}
                      >
                        {regionOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>{option.value === 'ALL' ? t('dashboardExtras.allCity') : option.value === 'NORTH' ? t('dashboardExtras.north') : option.value === 'CENTRAL' ? t('dashboardExtras.central') : t('dashboardExtras.south')}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Chip icon={<MyLocation />} label={`${filteredDrivers.length} ${t('labels.driverLocations')}`} color="primary" variant="outlined" />
                    <Chip icon={<Payments />} label={`${stats.payments.completed} ${t('labels.completedPayments')}`} color="success" variant="outlined" />
                  </Stack>
                </Stack>
              </Box>

              <Box sx={{ height: 520, bgcolor: '#dbeafe' }}>
                {hasGoogleMapsApiKey ? (
                  <GoogleDriverHeatmap googleMapsApiKey={googleMapsApiKey} mapCenter={mapCenter} drivers={filteredDrivers} fallback={leafletHeatmap} />
                ) : leafletHeatmap}
              </Box>

              <Box sx={{ px: 3, py: 2, borderTop: '1px solid rgba(148,163,184,0.16)', background: 'linear-gradient(180deg, rgba(248,250,252,0.9), rgba(255,255,255,0.95))' }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} useFlexGap flexWrap="wrap">
                  <Chip label={t('labels.coolZone')} size="small" sx={{ bgcolor: 'rgba(14,165,233,0.12)', color: '#0284c7' }} />
                  <Chip label={t('labels.steadyZone')} size="small" sx={{ bgcolor: 'rgba(59,130,246,0.12)', color: '#2563eb' }} />
                  <Chip label={t('labels.hotZone')} size="small" sx={{ bgcolor: 'rgba(220,38,38,0.12)', color: '#dc2626' }} />
                  <Chip icon={<Explore />} label={hotspots[0] ? `${t('labels.topHotspot')}: ${hotspots[0].label} (${hotspots[0].driverCount} ${t('dashboardExtras.hotspotDrivers')})` : t('labels.noHotspot')} size="small" variant="outlined" />
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Stack spacing={3}>
            <Card elevation={0} sx={{ borderRadius: 5, boxShadow: '0 18px 40px rgba(15,23,42,0.08)' }}>
              <CardContent>
                <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>{t('dashboardExtras.rideStatusTitle')}</Typography>
                <Stack spacing={1.25}>
                  <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">{t('dashboard.pending')}</Typography><Typography fontWeight={700}>{stats.rides.pending}</Typography></Stack>
                  <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">{t('dashboard.activeStatus')}</Typography><Typography fontWeight={700}>{stats.rides.active}</Typography></Stack>
                  <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">{t('dashboard.completed')}</Typography><Typography fontWeight={700}>{stats.rides.completed}</Typography></Stack>
                  <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">{t('dashboard.cancelled')}</Typography><Typography fontWeight={700}>{stats.rides.cancelled}</Typography></Stack>
                </Stack>
              </CardContent>
            </Card>

            <Card elevation={0} sx={{ borderRadius: 5, boxShadow: '0 18px 40px rgba(15,23,42,0.08)' }}>
              <CardContent>
                <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>{t('dashboardExtras.paymentPulseTitle')}</Typography>
                <Stack spacing={1.25}>
                  <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">{t('dashboard.pending')}</Typography><Typography fontWeight={700}>{stats.payments.pending}</Typography></Stack>
                  <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">{t('dashboard.completed')}</Typography><Typography fontWeight={700}>{stats.payments.completed}</Typography></Stack>
                  <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">{t('dashboard.failed')}</Typography><Typography fontWeight={700}>{stats.payments.failed}</Typography></Stack>
                </Stack>
              </CardContent>
            </Card>

            <Card elevation={0} sx={{ borderRadius: 5, boxShadow: '0 18px 40px rgba(15,23,42,0.08)' }}>
              <CardContent>
                <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>{t('dashboardExtras.hotspotsTitle')}</Typography>
                <Stack spacing={1.5}>
                  {hotspots.map((hotspot, index) => (
                    <Stack key={hotspot.key} direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography fontWeight={700}>{`#${index + 1} ${hotspot.label}`}</Typography>
                        <Typography variant="body2" color="text.secondary">{`${hotspot.driverCount} ${t('dashboardExtras.hotspotDrivers')} • ${t('dashboardExtras.hotspotRating')} ${hotspot.avgRating.toFixed(1)}`}</Typography>
                      </Box>
                      <Chip size="small" label={`${hotspot.driverCount}`} color={index === 0 ? 'error' : 'default'} />
                    </Stack>
                  ))}
                  {!hotspots.length && <Typography variant="body2" color="text.secondary">{t('labels.hotspotFallback')}</Typography>}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Card elevation={0} sx={{ borderRadius: 5, boxShadow: '0 18px 40px rgba(15,23,42,0.08)' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight={800}>{t('dashboardExtras.timelineTitle')}</Typography>
                <Chip icon={<Timeline />} label={t('labels.timelineWindow')} variant="outlined" />
              </Stack>
              <Stack spacing={1.25}>
                {timeline.map((point) => (
                  <Box key={point.time} sx={{ p: 1.5, borderRadius: 3, bgcolor: '#f8fafc', border: '1px solid rgba(148,163,184,0.14)' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography fontWeight={700}>{point.time}</Typography>
                      <Typography variant="body2" color="text.secondary">{`${point.onlineDrivers} ${t('labels.trackingDrivers')}`}</Typography>
                    </Stack>
                    <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                      <Typography variant="body2">{`${t('labels.ridesCount')}: ${point.rides}`}</Typography>
                      <Typography variant="body2">{`${t('labels.paymentsCount')}: ${point.completedPayments}`}</Typography>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Card elevation={0} sx={{ borderRadius: 5, boxShadow: '0 18px 40px rgba(15,23,42,0.08)' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>{t('dashboardExtras.eventFeedTitle')}</Typography>
              <Stack spacing={1.5}>
                {realtimeEvents.map((event) => (
                  <Box key={event.id} sx={{ p: 1.5, borderRadius: 3, bgcolor: event.tone === 'success' ? 'rgba(22,163,74,0.08)' : event.tone === 'warning' ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.08)' }}>
                    <Stack direction="row" justifyContent="space-between" spacing={2}>
                      <Box>
                        <Typography fontWeight={700}>{event.title}</Typography>
                        <Typography variant="body2" color="text.secondary">{event.detail}</Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">{formatDate(event.timestamp)}</Typography>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
