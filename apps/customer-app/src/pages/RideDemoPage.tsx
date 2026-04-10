/**
 * RideDemoPage – Demo mode for customer ride tracking.
 * Accessible at /demo (no auth required).
 * Uses the real BookingMap component with animated mock driver data.
 *
 * Phases:
 *  0  ACCEPTED     (~6 s) – driver moves from garage → pickup
 *  1  PICKING_UP   (~2 s) – driver arrives at pickup, waiting
 *  2  IN_PROGRESS  (~8 s) – both move pickup → dropoff
 *  3  COMPLETED    (hold) – trip done, receipt shown
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
  AutorenewRounded,
  Chat,
  Phone,
  PlayArrowRounded,
  RestartAltRounded,
  PauseRounded,
  StarRate,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { BookingMap } from '../features/booking';
import type { DriverLocationUpdate } from '../features/booking';

/* ─── Mock scenario ─── */
const MOCK_PICKUP = { lat: 10.7726, lng: 106.6980, address: 'Bến Thành, Phường Bến Thành, TP. HCM' };
const MOCK_DROPOFF = { lat: 10.8185, lng: 106.6588, address: 'Sân bay Tân Sơn Nhất, TP. HCM' };

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

const MOCK_DRIVER = {
  id: 'demo-driver-1',
  firstName: 'Nguyễn',
  lastName: 'Văn Demo',
  vehicleColor: 'Trắng',
  vehicleMake: 'Honda',
  vehicleModel: 'Vision',
  licensePlate: '51F-999.88',
  rating: 4.9,
};

type DemoPhase = 'IDLE' | 'ACCEPTED' | 'PICKING_UP' | 'IN_PROGRESS' | 'COMPLETED';

const STATUS_META: Record<DemoPhase, { label: string; description: string; color: string }> = {
  IDLE:        { label: 'Sẵn sàng chạy demo',     description: 'Nhấn "Chạy demo" để xem hành trình mẫu.',           color: '#64748b' },
  ACCEPTED:    { label: 'Tài xế đang đến đón',     description: 'Theo dõi vị trí tài xế theo thời gian thực.',        color: '#2563eb' },
  PICKING_UP:  { label: 'Tài xế đã tới điểm đón', description: 'Tài xế đã đến nơi. Chuyến đi sẽ bắt đầu ngay.',     color: '#0f766e' },
  IN_PROGRESS: { label: 'Đang trong chuyến đi',    description: 'Chuyến đi đang diễn ra. Hãy kiểm tra lộ trình.',    color: '#16a34a' },
  COMPLETED:   { label: 'Chuyến đi hoàn thành',    description: 'Xem hóa đơn và đánh giá tài xế.',                   color: '#16a34a' },
};

const PHASE_DURATION_MS = {
  ACCEPTED:   7000,
  PICKING_UP: 2200,
  IN_PROGRESS: 9000,
};

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function posOnPath(path: [number, number][], t: number): { lat: number; lng: number } {
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
  const [driverLocation, setDriverLocation] = useState<DriverLocationUpdate | null>(null);
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
    const duration = PHASE_DURATION_MS[p as keyof typeof PHASE_DURATION_MS] ?? 0;

    if (!duration) return; // COMPLETED / IDLE – no animation

    const tick = (now: number) => {
      if (phaseStartRef.current === null) phaseStartRef.current = now;
      const elapsed = now - phaseStartRef.current + pausedElapsedRef.current;
      const raw = Math.min(elapsed / duration, 1);
      const t = easeInOut(raw);
      const pos = posOnPath(path, t);
      setDriverLocation({ driverId: MOCK_DRIVER.id, lat: pos.lat, lng: pos.lng });

      if (raw < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // advance to next phase
        if (p === 'ACCEPTED') {
          runPhase('PICKING_UP');
        } else if (p === 'PICKING_UP') {
          runPhase('IN_PROGRESS');
        } else if (p === 'IN_PROGRESS') {
          setPhase('COMPLETED');
          currentPhaseRef.current = 'COMPLETED';
        }
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [cancel]);

  const handlePlay = useCallback(() => {
    if (phase === 'IDLE' || phase === 'COMPLETED') {
      // fresh start
      setDriverLocation({ driverId: MOCK_DRIVER.id, lat: ROUTE_TO_PICKUP[0][0], lng: ROUTE_TO_PICKUP[0][1] });
      setPaused(false);
      runPhase('ACCEPTED');
    } else if (paused) {
      // resume
      setPaused(false);
      const p = currentPhaseRef.current as 'ACCEPTED' | 'PICKING_UP' | 'IN_PROGRESS';
      const duration = PHASE_DURATION_MS[p] ?? 0;
      const now = performance.now();
      pausedElapsedRef.current = Math.min(now - pausedAtRef.current, duration - 50);
      phaseStartRef.current = null;
      const path = p === 'ACCEPTED' ? ROUTE_TO_PICKUP : ROUTE_TO_DROPOFF;

      const tick = (ts: number) => {
        if (phaseStartRef.current === null) phaseStartRef.current = ts;
        const elapsed = ts - phaseStartRef.current + pausedElapsedRef.current;
        const raw = Math.min(elapsed / duration, 1);
        const t = easeInOut(raw);
        const pos = posOnPath(path, t);
        setDriverLocation({ driverId: MOCK_DRIVER.id, lat: pos.lat, lng: pos.lng });
        if (raw < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          if (p === 'ACCEPTED') runPhase('PICKING_UP');
          else if (p === 'PICKING_UP') runPhase('IN_PROGRESS');
          else { setPhase('COMPLETED'); currentPhaseRef.current = 'COMPLETED'; }
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [phase, paused, runPhase]);

  const handlePause = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pausedAtRef.current = performance.now() - (phaseStartRef.current ?? performance.now());
    setPaused(true);
  }, []);

  const handleReset = useCallback(() => {
    cancel();
    setPhase('IDLE');
    setDriverLocation(null);
    setPaused(false);
    phaseStartRef.current = null;
    pausedElapsedRef.current = 0;
    currentPhaseRef.current = 'IDLE';
  }, [cancel]);

  // cleanup on unmount
  useEffect(() => () => cancel(), [cancel]);

  const meta = STATUS_META[phase];
  const isRunning = phase !== 'IDLE' && phase !== 'COMPLETED' && !paused;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#e5eefb' }}>
      {/* ── Back button ── */}
      <Box
        sx={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1100,
          p: 1, pt: 2, pointerEvents: 'none',
        }}
      >
        <IconButton
          onClick={() => navigate(-1)}
          sx={{ bgcolor: 'white', boxShadow: 2, '&:hover': { bgcolor: 'grey.100' }, pointerEvents: 'auto' }}
        >
          <ArrowBack />
        </IconButton>
      </Box>

      {/* ── Map ── */}
      <Box sx={{ flex: phase === 'COMPLETED' ? '0 0 44vh' : 1, position: 'relative' }}>
        <BookingMap
          pickup={MOCK_PICKUP}
          dropoff={MOCK_DROPOFF}
          driverLocation={driverLocation}
          mode="tracking"
          height="100%"
        />

        {/* Demo badge */}
        <Chip
          label="🎬 DEMO MODE"
          size="small"
          sx={{
            position: 'absolute', top: 60, right: 12, zIndex: 1200,
            bgcolor: '#1e293bcc', color: '#fbbf24', fontWeight: 700, fontSize: 11,
          }}
        />
      </Box>

      {/* ── Status card ── */}
      <Card sx={{
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -20px 45px rgba(15,23,42,0.14)',
        overflow: 'auto',
        minHeight: phase === 'COMPLETED' ? '56vh' : '34vh',
      }}>
        <CardContent sx={{ p: 3 }}>
          {/* Status row */}
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
            {isRunning ? (
              <Box sx={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(245,158,11,0.14)' }}>
                <AutorenewRounded sx={{ color: '#d97706', animation: 'spin 1.1s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />
              </Box>
            ) : (
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: meta.color }} />
            )}
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" fontWeight={800}>{meta.label}</Typography>
              <Typography variant="body2" color="text.secondary">{meta.description}</Typography>
            </Box>
            <Chip
              label={meta.label}
              size="small"
              sx={{ bgcolor: `${meta.color}18`, color: meta.color, fontWeight: 700 }}
            />
          </Stack>

          {/* Control buttons */}
          <Stack direction="row" spacing={1.5} sx={{ mb: 2.5 }}>
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

          {/* Driver info (show after phase starts) */}
          {phase !== 'IDLE' && (
            <Card sx={{ borderRadius: 4, mb: 2.5, bgcolor: '#f8fafc' }}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar sx={{ width: 56, height: 56, bgcolor: '#1d4ed8' }}>
                    {MOCK_DRIVER.firstName[0]}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight={800}>
                      {MOCK_DRIVER.firstName} {MOCK_DRIVER.lastName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {MOCK_DRIVER.vehicleColor} {MOCK_DRIVER.vehicleMake} {MOCK_DRIVER.vehicleModel}
                    </Typography>
                    <Typography variant="body2" fontWeight={700}>{MOCK_DRIVER.licensePlate}</Typography>
                  </Box>
                  <Chip
                    icon={<StarRate sx={{ color: '#f59e0b !important' }} />}
                    label={MOCK_DRIVER.rating.toFixed(1)}
                    variant="outlined"
                  />
                </Stack>
                <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
                  <Button variant="outlined" fullWidth startIcon={<Phone />} sx={{ borderRadius: 3 }}>Gọi</Button>
                  <Button variant="outlined" fullWidth startIcon={<Chat />} sx={{ borderRadius: 3 }}>Nhắn tin</Button>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Ride details */}
          {phase !== 'IDLE' && (
            <Card sx={{ borderRadius: 4, mb: 2.5 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1.5 }}>Chi tiết chuyến đi</Typography>
                <Stack spacing={1.2}>
                  <Stack direction="row" justifyContent="space-between" spacing={2}>
                    <Typography variant="body2" color="text.secondary">Điểm đón</Typography>
                    <Typography variant="body2" fontWeight={600} textAlign="right">{MOCK_PICKUP.address}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" spacing={2}>
                    <Typography variant="body2" color="text.secondary">Điểm đến</Typography>
                    <Typography variant="body2" fontWeight={600} textAlign="right">{MOCK_DROPOFF.address}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Loại xe</Typography>
                    <Typography variant="body2" fontWeight={600}>Xe ga</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Thanh toán</Typography>
                    <Typography variant="body2" fontWeight={600}>Tiền mặt</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Quãng đường</Typography>
                    <Typography variant="body2" fontWeight={600}>8.3 km</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Cước phí</Typography>
                    <Typography variant="body2" fontWeight={800}>
                      {phase === 'COMPLETED' ? '45.000 ₫' : 'Đang tính...'}
                    </Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Receipt (completed) */}
          {phase === 'COMPLETED' && (
            <Card sx={{ borderRadius: 4, mb: 2.5, bgcolor: '#eff6ff' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1.5 }}>Hóa đơn chuyến đi</Typography>
                <Stack spacing={1.25}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Mã chuyến</Typography>
                    <Typography variant="body2" fontWeight={600}>DEMO0001</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Phương thức</Typography>
                    <Typography variant="body2" fontWeight={600}>Tiền mặt</Typography>
                  </Stack>
                  <Divider sx={{ my: 0.5 }} />
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Tổng tiền</Typography>
                    <Typography variant="h6" fontWeight={900}>45.000 ₫</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Trạng thái</Typography>
                    <Chip size="small" label="Đã thanh toán" color="success" />
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
