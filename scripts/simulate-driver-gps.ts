/**
 * simulate-driver-gps.ts
 * ─────────────────────────────────────────────────────────────────
 * Giả lập tài xế di chuyển GPS trên hệ thống thật.
 * Script này kết nối Socket.IO với token tài xế thật và phát sự kiện
 * driver:update-location để bản đồ theo dõi của khách hàng cập nhật.
 *
 * Cách dùng:
 *   npx tsx scripts/simulate-driver-gps.ts --rideId=<RIDE_ID>
 *
 * Tuỳ chọn:
 *   --rideId=<id>          (bắt buộc) ID chuyến đang hoạt động
 *   --email=<email>        (mặc định: driver1@example.com)
 *   --password=<pass>      (mặc định: Password@1)
 *   --gateway=<url>        (mặc định: http://localhost:3000)
 *   --route=<ten-tuyen>    benshanhtoairport | airporttobenthanh | custom
 *   --interval=<ms>        khoảng cách phát mỗi điểm (mặc định: 1500ms)
 *   --loop                 lặp lại sau khi xong
 *
 * Ví dụ:
 *   npx tsx scripts/simulate-driver-gps.ts --rideId=abc123
 *   npx tsx scripts/simulate-driver-gps.ts --rideId=abc123 --email=driver2@example.com --interval=800
 * ─────────────────────────────────────────────────────────────────
 */

import { io, Socket } from 'socket.io-client';

// ─── Parse CLI args ───────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [key, ...rest] = a.slice(2).split('=');
      return [key, rest.join('=') || 'true'];
    })
);

const RIDE_ID   = args['rideId'] || args['ride-id'];
const EMAIL     = args['email']    || 'driver1@example.com';
const PASSWORD  = args['password'] || 'Password@1';
const GATEWAY   = (args['gateway'] || 'http://localhost:3000').replace(/\/$/, '');
const INTERVAL  = parseInt(args['interval'] || '1500', 10);
const LOOP      = args['loop'] === 'true';
const ROUTE_KEY = args['route'] || 'benthanhtairport';

if (!RIDE_ID) {
  console.error('\n❌  Thiếu --rideId\n');
  console.error('   Ví dụ: npx tsx scripts/simulate-driver-gps.ts --rideId=abc123\n');
  process.exit(1);
}

// ─── Tuyến đường mẫu (TPHCM) ─────────────────────────────────────
// Mỗi điểm: [lat, lng, heading?]
const ROUTES: Record<string, [number, number, number?][]> = {
  // Quận 5 → Bến Thành → Sân bay TSN
  benthanhtairport: [
    [10.7520, 106.6730, 45],
    [10.7548, 106.6758, 42],
    [10.7575, 106.6785, 40],
    [10.7600, 106.6820, 38],
    [10.7620, 106.6855, 30],
    [10.7640, 106.6885, 25],
    [10.7660, 106.6910, 20],
    [10.7680, 106.6938, 18],
    [10.7700, 106.6960, 15],
    [10.7715, 106.6972, 12],
    [10.7726, 106.6980, 10],   // ← Bến Thành (pickup)
    [10.7750, 106.6955, 320],
    [10.7790, 106.6920, 315],
    [10.7840, 106.6880, 310],
    [10.7900, 106.6830, 305],
    [10.7960, 106.6780, 300],
    [10.8010, 106.6740, 295],
    [10.8060, 106.6700, 290],
    [10.8110, 106.6660, 288],
    [10.8155, 106.6620, 285],
    [10.8185, 106.6588, 280],  // ← Sân bay TSN (dropoff)
  ],

  // Sân bay TSN → Bến Thành (ngược lại)
  airporttobenthanh: [
    [10.8185, 106.6588, 100],
    [10.8140, 106.6625, 110],
    [10.8090, 106.6660, 115],
    [10.8030, 106.6705, 120],
    [10.7970, 106.6750, 125],
    [10.7910, 106.6800, 130],
    [10.7840, 106.6855, 135],
    [10.7780, 106.6910, 140],
    [10.7740, 106.6945, 145],
    [10.7726, 106.6980, 150],  // ← Bến Thành
  ],

  // Vòng quanh hồ Con Rùa (Q.3) - ngắn gọn để test nhanh
  roundtrip: [
    [10.7795, 106.6994, 0],
    [10.7810, 106.7005, 45],
    [10.7820, 106.7018, 90],
    [10.7812, 106.7030, 135],
    [10.7797, 106.7038, 180],
    [10.7783, 106.7030, 225],
    [10.7775, 106.7015, 270],
    [10.7780, 106.7000, 315],
    [10.7795, 106.6994, 360],
  ],
};

const waypoints = ROUTES[ROUTE_KEY];
if (!waypoints) {
  console.error(`\n❌  Không tìm thấy tuyến "${ROUTE_KEY}". Tuyến có sẵn: ${Object.keys(ROUTES).join(', ')}\n`);
  process.exit(1);
}

// ─── Step 1: Đăng nhập lấy token ─────────────────────────────────
async function login(): Promise<string> {
  console.log(`\n🔐  Đăng nhập: ${EMAIL} @ ${GATEWAY}`);
  const res = await fetch(`${GATEWAY}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error(`❌  Đăng nhập thất bại (${res.status}):`, body?.message || body);
    process.exit(1);
  }

  // Support common response shapes
  const token =
    body?.data?.tokens?.accessToken ||
    body?.data?.accessToken ||
    body?.tokens?.accessToken ||
    body?.accessToken;

  if (!token) {
    console.error('❌  Không lấy được accessToken từ response:', JSON.stringify(body, null, 2));
    process.exit(1);
  }

  console.log('✅  Đăng nhập thành công');
  return token as string;
}

// ─── Step 2: Kết nối socket ────────────────────────────────────────
function connectSocket(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    console.log(`🔌  Kết nối socket: ${GATEWAY}`);

    const socket = io(GATEWAY, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: false,
    });

    socket.on('connect', () => {
      console.log(`✅  Socket kết nối thành công (id: ${socket.id})`);
      resolve(socket);
    });

    socket.on('connect_error', (err) => {
      console.error('❌  Socket lỗi kết nối:', err.message);
      reject(err);
    });
  });
}

// ─── Step 3: Phát vị trí ───────────────────────────────────────────
async function simulateGPS(socket: Socket, token: string): Promise<void> {
  let iteration = 0;

  const run = (): Promise<void> => new Promise((resolve) => {
    iteration++;
    let step = 0;
    const total = waypoints.length;

    console.log(`\n🚗  Bắt đầu tuyến "${ROUTE_KEY}" (${total} điểm, interval ${INTERVAL}ms) — lần ${iteration}`);
    console.log(`📍  Ride ID: ${RIDE_ID}`);
    console.log(`🗺️   ${GATEWAY}/ride/${RIDE_ID}  ← mở trang này để theo dõi\n`);

    // Subscribe to ride room first (as driver)
    socket.emit('ride:subscribe', { rideId: RIDE_ID });

    const send = () => {
      if (step >= total) {
        console.log('\n🏁  Đến điểm cuối!');
        resolve();
        return;
      }

      const [lat, lng, heading] = waypoints[step];
      const payload = {
        rideId: RIDE_ID,
        lat,
        lng,
        heading: heading ?? 0,
        timestamp: Date.now(),
      };

      socket.emit('driver:update-location', payload);

      const bar = '█'.repeat(Math.round((step / (total - 1)) * 20)).padEnd(20, '░');
      process.stdout.write(`\r  [${bar}] ${step + 1}/${total}  lat=${lat.toFixed(5)} lng=${lng.toFixed(5)}`);

      step++;
      setTimeout(send, INTERVAL);
    };

    send();
  });

  await run();

  if (LOOP) {
    console.log('\n🔁  Lặp lại tuyến...\n');
    await simulateGPS(socket, token);
  }
}

// ─── Main ──────────────────────────────────────────────────────────
(async () => {
  try {
    const token = await login();
    const socket = await connectSocket(token);
    await simulateGPS(socket, token);

    console.log('\n\n✅  Hoàn thành! Ngắt kết nối...');
    socket.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('\n❌  Lỗi:', err);
    process.exit(1);
  }
})();
