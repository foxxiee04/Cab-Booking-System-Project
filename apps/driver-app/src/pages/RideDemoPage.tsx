/**
 * RideDemoPage – Demo mode for driver-side map tracking.
 * Accessible at /demo (no auth required).
 * Uses the real DriverTripMap component with animated mock position.
 *
 * Phases:
 *  0  IDLE         – initial, show start button
 *  1  ACCEPTED     (~6 s) – driver drives from garage → pickup  (mode: 'pickup')
 *  2  PICKING_UP   (~2 s) – driver stationary at pickup         (mode: 'pickup')
 *  3  IN_PROGRESS  (~8 s) – driver drives pickup → dropoff      (mode: 'trip')
 *  4  COMPLETED    (hold) – at dropoff                          (mode: 'trip')
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import {
  ArrowBack,
  PauseRounded,
  PlayArrowRounded,
  RestartAltRounded,
  Chat,
  Phone,
  AutorenewRounded,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import DriverTripMap from '../features/trip/components/DriverTripMap';
import type { Location } from '../types';

/* ─── Mock scenario ─── */
const DRIVER_START: Location = { lat: 10.7520, lng: 106.6730, address: 'Quận 5, TP. HCM' };
const PICKUP: Location = { lat: 10.7726, lng: 106.6980, address: 'Bến Thành, Phường Bến Thành, TP. HCM' };
const DROPOFF: Location = { lat: 10.8185, lng: 106.6588, address: 'Sân bay Tân Sơn Nhất, TP. HCM' };

const ROUTE_TO_PICKUP: [number, number][] = [
  [10.7520, 106.6730],
  [10.7560, 106.6780],
  [10.7600, 106.6840],
  [10.7640, 106.6880],
  [10.7670, 106.6920],
  [10.7700, 106.6960],
  [10.7726, 106.6980],
];

const ROUTE_TO_DROPOFF: [number, number][] = [
  [10.7726, 106.6980],
  [10.7780, 106.6930],
  [10.7840, 106.6870],
  [10.7910, 106.6800],
  [10.7980, 106.6730],
  [10.8050, 106.6680],
  [10.8120, 106.6620],
  [10.8185, 106.6588],
];

const MOCK_CUSTOMER = {
  firstName: 'Trần',
  lastName: 'Thị Demo',
  phone: '090.123.4567',
};

type DemoPhase = 'IDLE' | 'ACCEPTED' | 'PICKING_UP' | 'IN_PROGRESS' | 'COMPLETED';

const PHASE_DURATION_MS: Partial<Record<DemoPhase, number>> = {
  ACCEPTED: 7000,
  PICKING_UP: 2200,
  IN_PROGRESS: 9000,
};

const STATUS_META: Record<DemoPhase, { label: string; description: string; color: string }> = {
  IDLE:        { label: 'Sẵn sàng',              description: 'Nhấn "Chạy demo" để bắt đầu hành trình mô phỏng.',  color: '#64748b' },
  ACCEPTED:    { label: 'Đang đến đón khách',     description: 'Điều hướng tới điểm đón khách hàng.',               color: '#2563eb' },
  PICKING_UP:  { label: 'Đã đến điểm đón',        description: 'Chờ khách hàng lên xe. Chuyến đi sắp bắt đầu.',    color: '#0f766e' },
  IN_PROGRESS: { label: 'Đang trong chuyến đi',   description: 'Đưa khách đến điểm đến.',                           color: '#16a34a' },
  COMPLETED:   { label: 'Chuyến đi hoàn thành',   description: 'Xem thu nhập và đánh giá của khách hàng.',          color: '#16a34a' },
};

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function posOnPath(path: [number, number][], t: number): Location {
  if (t <= 0) return { lat: path[0][0], lng: path[0][1] };
  if (t >= 1) return { lat: path[path.length - 1][0], lng: path[path.length - 1][1] };
  const raw = (path.length - 1) * t;
  const i = Math.floor(raw);
  const frac = raw - i;
  const a = path[i];
  const b = path[Math.min(i + 1, path.length - 1)];
  return { lat: a[0] + (b[0] - a[0]) * frac, lng: a[1] + (b[1] - a[1]) * frac };
}

const RideDemoPage: React.FC = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<DemoPhase>('IDLE');
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [paused, setPaused] = useState(false);

  const rafRef = useRef<number | null>(null);
  const phaseStartRef = useRef<number | null>(null);
  const pausedAtRef = useRef<number>(0);
  const pausedElapsedRef = useRef<number>(0);
  const currentPhaseRef = useRef<DemoPhase>('IDLE');

  const cancel = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const runPhase = useCallback((p: DemoPhase) => {
    cancel();
    currentPhaseRef.current = p;
    setPhase(p);
    phaseStartRef.current = null;
    pausedElapsedRef.current = 0;

    const path = p === 'ACCEPTED' ? ROUTE_TO_PICKUP : ROUTE_TO_DROPOFF;
    const duration = PHASE_DURATION_MS[p] ?? 0;

    if (!duration) return;

    const tick = (now: number) => {
      if (phaseStartRef.current === null) phaseStartRef.current = now;
      const elapsed = now - phaseStartRef.current + pausedElapsedRef.current;
      const raw = Math.min(elapsed / duration, 1);
      const t = easeInOut(raw);
      setCurrentLocation(posOnPath(path, t));

      if (raw < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        if (p === 'ACCEPTED') {
          runPhase('PICKING_UP');
        } else if (p === 'PICKING_UP') {
          runPhase('IN_PROGRESS');
        } else if (p === 'IN_PROGRESS') {
          setCurrentLocation({ ...DROPOFF });
          setPhase('COMPLETED');
          currentPhaseRef.current = 'COMPLETED';
        }
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [cancel]);

  const handlePlay = useCallback(() => {
    if (phase === 'IDLE' || phase === 'COMPLETED') {
      setCurrentLocation({ ...DRIVER_START });
      setPaused(false);
      runPhase('ACCEPTED');
    } else if (paused) {
      setPaused(false);
      const p = currentPhaseRef.current as 'ACCEPTED' | 'PICKING_UP' | 'IN_PROGRESS';
      const duration = PHASE_DURATION_MS[p] ?? 0;
      const path = p === 'ACCEPTED' ? ROUTE_TO_PICKUP : ROUTE_TO_DROPOFF;
      pausedElapsedRef.current = Math.min(performance.now() - pausedAtRef.current, duration - 50);
      phaseStartRef.current = null;

      const tick = (ts: number) => {
        if (phaseStartRef.current === null) phaseStartRef.current = ts;
        const elapsed = ts - phaseStartRef.current + pausedElapsedRef.current;
        const raw = Math.min(elapsed / duration, 1);
        const t = easeInOut(raw);
        setCurrentLocation(posOnPath(path, t));
        if (raw < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          if (p === 'ACCEPTED') runPhase('PICKING_UP');
          else if (p === 'PICKING_UP') runPhase('IN_PROGRESS');
          else { setCurrentLocation({ ...DROPOFF }); setPhase('COMPLETED'); currentPhaseRef.current = 'COMPLETED'; }
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [phase, paused, runPhase]);

  const handlePause = useCallback(() => {
    cancel();
    pausedAtRef.current = performance.now() - (phaseStartRef.current ?? performance.now());
    setPaused(true);
  }, [cancel]);

  const handleReset = useCallback(() => {
    cancel();
    setPhase('IDLE');
    setCurrentLocation(null);
    setPaused(false);
    phaseStartRef.current = null;
    pausedElapsedRef.current = 0;
    currentPhaseRef.current = 'IDLE';
  }, [cancel]);

  useEffect(() => () => cancel(), [cancel]);

  const meta = STATUS_META[phase];
  const isRunning = phase !== 'IDLE' && phase !== 'COMPLETED' && !paused;
  const mapMode: 'request' | 'pickup' | 'trip' =
    phase === 'IN_PROGRESS' || phase === 'COMPLETED' ? 'trip' : 'pickup';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#e5eefb' }}>
      {/* Map */}
      <Box sx={{ flex: phase === 'COMPLETED' ? '0 0 44vh' : 1, position: 'relative' }}>
        <DriverTripMap
          currentLocation={currentLocation}
          pickupLocation={PICKUP}
          dropoffLocation={DROPOFF}
          nearbyDrivers={[]}
          mode={mapMode}
          height="100%"
        />

        {/* Back button */}
        <IconButton
          onClick={() => navigate(-1)}
          sx={{
            position: 'absolute', top: 16, left: 12, zIndex: 1200,
            bgcolor: 'white', boxShadow: 2, '&:hover': { bgcolor: 'grey.100' },
          }}
        >
          <ArrowBack />
        </IconButton>

        {/* Demo badge */}
        <Chip
          label="🎬 DEMO TÀI XẾ"
          size="small"
          sx={{
            position: 'absolute', top: 16, right: 12, zIndex: 1200,
            bgcolor: '#1e293bcc', color: '#fbbf24', fontWeight: 700, fontSize: 11,
          }}
        />

        {/* Animated phase overlay */}
        {isRunning && (
          <Box
            sx={{
              position: 'absolute', top: 64, left: '50%', transform: 'translateX(-50%)',
              zIndex: 1200, bgcolor: '#1d4ed8f0', color: 'white', borderRadius: 3,
              px: 2.5, py: 1, display: 'flex', alignItems: 'center', gap: 1,
            }}
          >
            <AutorenewRounded sx={{ fontSize: 18, animation: 'spin 1.1s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />
            <Typography variant="body2" fontWeight={700}>{meta.label}</Typography>
          </Box>
        )}
      </Box>

      {/* Status card */}
      <Card sx={{
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -20px 45px rgba(15,23,42,0.14)',
        overflow: 'auto',
        minHeight: phase === 'COMPLETED' ? '56vh' : '30vh',
      }}>
        <CardContent sx={{ p: 3 }}>
          {/* Status header */}
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: meta.color }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" fontWeight={800}>{meta.label}</Typography>
              <Typography variant="body2" color="text.secondary">{meta.description}</Typography>
            </Box>
            <Chip
              label={phase === 'IDLE' ? 'Demo' : phase.replace('_', ' ')}
              size="small"
              sx={{ bgcolor: `${meta.color}18`, color: meta.color, fontWeight: 700 }}
            />
          </Stack>

          {/* Controls */}
          <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
            {!isRunning && (
              <Button
                variant="contained"
                startIcon={<PlayArrowRounded />}
                onClick={handlePlay}
                sx={{ borderRadius: 3, fontWeight: 700 }}
              >
                {phase === 'IDLE' ? 'Chạy demo' : paused ? 'Tiếp tục' : 'Chạy lại'}
              </Button>
            )}
            {isRunning && (
              <Button
                variant="outlined"
                startIcon={<PauseRounded />}
                onClick={handlePause}
                sx={{ borderRadius: 3, fontWeight: 700 }}
              >
                Tạm dừng
              </Button>
            )}
            {phase !== 'IDLE' && (
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<RestartAltRounded />}
                onClick={handleReset}
                sx={{ borderRadius: 3 }}
              >
                Đặt lại
              </Button>
            )}
          </Stack>

          {/* Customer info (show after phase starts) */}
          {phase !== 'IDLE' && (
            <Card sx={{ borderRadius: 4, mb: 2, bgcolor: '#f8fafc' }}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar sx={{ width: 52, height: 52, bgcolor: '#0f766e' }}>
                    {MOCK_CUSTOMER.firstName[0]}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight={800}>
                      {MOCK_CUSTOMER.firstName} {MOCK_CUSTOMER.lastName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {MOCK_CUSTOMER.phone}
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
                  <Button variant="outlined" fullWidth startIcon={<Phone />} sx={{ borderRadius: 3 }}>Gọi khách</Button>
                  <Button variant="outlined" fullWidth startIcon={<Chat />} sx={{ borderRadius: 3 }}>Nhắn tin</Button>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Trip details */}
          {phase !== 'IDLE' && (
            <Card sx={{ borderRadius: 4, mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1.5 }}>Thông tin chuyến</Typography>
                <Stack spacing={1.2}>
                  <Stack direction="row" justifyContent="space-between" spacing={2}>
                    <Typography variant="body2" color="text.secondary">Đón tại</Typography>
                    <Typography variant="body2" fontWeight={600} textAlign="right">{PICKUP.address}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" spacing={2}>
                    <Typography variant="body2" color="text.secondary">Đến</Typography>
                    <Typography variant="body2" fontWeight={600} textAlign="right">{DROPOFF.address}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Quãng đường</Typography>
                    <Typography variant="body2" fontWeight={600}>8.3 km</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Thu nhập</Typography>
                    <Typography variant="body2" fontWeight={800} color="success.main">
                      {phase === 'COMPLETED' ? '+36.000 ₫' : 'Đang tính...'}
                    </Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Earnings receipt */}
          {phase === 'COMPLETED' && (
            <Card sx={{ borderRadius: 4, mb: 2, bgcolor: '#f0fdf4' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1.5 }}>Thu nhập chuyến</Typography>
                <Stack spacing={1.25}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Tiền chuyến</Typography>
                    <Typography variant="body2" fontWeight={600}>45.000 ₫</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Phí nền tảng (20%)</Typography>
                    <Typography variant="body2" fontWeight={600}>-9.000 ₫</Typography>
                  </Stack>
                  <Divider sx={{ my: 0.5 }} />
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Bạn nhận được</Typography>
                    <Typography variant="h6" fontWeight={900} color="success.main">36.000 ₫</Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          )}

          {phase === 'COMPLETED' && (
            <Button
              variant="contained"
              fullWidth
              onClick={handleReset}
              sx={{ borderRadius: 3, py: 1.4, fontWeight: 700 }}
            >
              Chạy lại demo
            </Button>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default RideDemoPage;
