/**
 * Multi-driver / Multi-customer Dispatch Test
 * ============================================
 * Tests:
 *   [A] 3 drivers near 1 customer  → dispatch theo scoring order
 *   [B] 1 driver near 3 customers  → ai được match trước
 *   [C] Concurrent bookings        → hệ thống xử lí như thế nào
 */

import { io } from 'socket.io-client';

const BASE_URL = 'http://localhost:3000';
const SOCKET_URL = 'http://localhost:3000';

// Bến Thành cluster accounts (all CAR_4 drivers, khác rating)
const DRIVERS = [
  { phone: '0911234561', pass: 'Password@1', name: 'Pham Van D (D1)',  rating: 1.0, dist: '~0.22km' },
  { phone: '0911234562', pass: 'Password@1', name: 'Vo Thi E (D2)',    rating: 2.0, dist: '~0.12km' },
  { phone: '0911234568', pass: 'Password@1', name: 'Pham Van M (D8)',  rating: 3.0, dist: '~0.27km' },
];

const CUSTOMERS = [
  { phone: '0901234561', pass: 'Password@1', name: 'Nguyen Van A (C1)' },
  { phone: '0901234562', pass: 'Password@1', name: 'Tran Thi B (C2)'   },
  { phone: '0901234563', pass: 'Password@1', name: 'Le Van C (C3)'     },
];

// Customer 1 pickup — Cửa Nam Chợ Bến Thành
const PICKUP = {
  pickupLat: 10.77095,
  pickupLng: 106.69895,
  pickupAddress: 'Cửa Nam Chợ Bến Thành, Q1, TP.HCM',
  dropoffLat: 10.7900,
  dropoffLng: 106.7050,
  dropoffAddress: 'Nhà thờ Đức Bà, Q1, TP.HCM',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

async function login(phone, pass) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password: pass }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(`Login failed for ${phone}: ${json.message}`);
  return json.data;
}

async function createBooking(token, vehicleType = 'CAR_4', paymentMethod = 'CASH') {
  const res = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ ...PICKUP, vehicleType, paymentMethod }),
  });
  const json = await res.json();
  return json;
}

async function confirmBooking(token, bookingId) {
  const res = await fetch(`${BASE_URL}/api/bookings/${bookingId}/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ paymentMethod: 'CASH' }),
  });
  const json = await res.json();
  return json;
}

async function cancelRide(token, rideId, reason) {
  const res = await fetch(`${BASE_URL}/api/rides/${rideId}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ reason }),
  });
  return res.json();
}

function connectDriverSocket(token, userId, driverName) {
  return new Promise((resolve) => {
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    const received = [];

    socket.on('connect', () => {
      console.log(`  🔌 ${driverName} connected (socketId=${socket.id})`);
      resolve({ socket, received, name: driverName, userId });
    });

    socket.on('NEW_RIDE_AVAILABLE', (data) => {
      const ts = new Date().toISOString();
      received.push({ ts, data });
      console.log(`  🔔 [${ts}] NEW_RIDE_AVAILABLE → ${driverName}`);
      console.log(`       rideId=${data.rideId}, ETA=${data.etaMinutes}min, score=${data.score?.toFixed?.(4) ?? 'n/a'}`);
    });

    socket.on('ride:timeout', (data) => {
      console.log(`  ⏰ ride:timeout → ${driverName} (rideId=${data.rideId})`);
    });

    socket.on('disconnect', () => {
      console.log(`  🔴 ${driverName} disconnected`);
    });

    socket.on('connect_error', (err) => {
      console.error(`  ❌ ${driverName} connect_error: ${err.message}`);
      resolve({ socket: null, received, name: driverName, userId });
    });

    setTimeout(() => resolve({ socket, received, name: driverName, userId }), 5000);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function separator(label) {
  console.log('\n' + '═'.repeat(60));
  console.log('  ' + label);
  console.log('═'.repeat(60));
}

// ── Score Calculator (mirrors driver-matcher.ts logic) ────────────────────────

function scoreDriver({ distanceKm, rating, idleSeconds = 0, acceptanceRate = 0.85, cancelRate = 0.05 }) {
  const wEta = 0.40, wRating = 0.20, wAcceptance = 0.15, wCancelRate = 0.15;
  const wIdleTime = 0.05, wDistance = 0.05, maxRadius = 5, maxIdle = 7200;
  const avgSpeed = 25;

  const etaMin = Math.ceil((distanceKm / avgSpeed) * 60);
  const etaScore = Math.max(0, Math.min(1, 1 / Math.max(1, etaMin)));
  const normDist = Math.min(distanceKm, maxRadius) / maxRadius;
  const normRating = rating / 5;
  const normIdle = Math.min(idleSeconds, maxIdle) / maxIdle;

  const score = wEta * etaScore
    + wRating * normRating
    + wAcceptance * acceptanceRate
    - wCancelRate * cancelRate
    + wIdleTime * normIdle
    - wDistance * normDist;

  return { score, etaMin, etaScore, normRating, normDist };
}

function printExpectedOrder() {
  console.log('\n📊 Score calculation (Bến Thành cluster, CAR_4):');
  console.log('   Customer C1 at: 10.77095, 106.69895');
  console.log('');

  const candidates = [
    { name: 'D1 Pham Van D',  rating: 1.0, distanceKm: 0.22, phone: '0911234561' },
    { name: 'D2 Vo Thi E',    rating: 2.0, distanceKm: 0.12, phone: '0911234562' },
    { name: 'D8 Pham Van M',  rating: 3.0, distanceKm: 0.27, phone: '0911234568' },
  ];

  const scored = candidates.map(c => ({ ...c, ...scoreDriver(c) }));
  scored.sort((a, b) => b.score - a.score);

  console.log('   Rank | Driver         | Rating | Dist  | ETA   | Score');
  console.log('   ─────┼────────────────┼────────┼───────┼───────┼──────');
  scored.forEach((d, i) => {
    console.log(
      `   ${i + 1}    | ${d.name.padEnd(14)} | ${d.rating.toFixed(1)} ★  | ${(d.distanceKm * 1000).toFixed(0)}m  | ${d.etaMin}min  | ${d.score.toFixed(4)}`
    );
  });
  console.log('');
  console.log('   ⚡ Dispatch order (sequential): ' + scored.map((d, i) => `Round${i+1}→${d.name}`).join(', '));
  console.log('');
  return scored;
}

// ════════════════════════════════════════════════════════════════════════════
// TEST A — 3 Drivers → 1 Customer
// ════════════════════════════════════════════════════════════════════════════

async function testA_3drivers1customer() {
  separator('TEST A: 3 Drivers → 1 Customer (Bến Thành cluster, CAR_4)');

  printExpectedOrder();

  // 1. Login all drivers
  console.log('▶ Đăng nhập 3 tài xế...');
  const driverSessions = await Promise.all(
    DRIVERS.map(d => login(d.phone, d.pass).then(data => ({ ...data, meta: d })))
  );
  driverSessions.forEach(d => console.log(`  ✓ ${d.meta.name} (userId=${d.user.id})`));

  // 2. Connect WebSockets for all drivers
  console.log('\n▶ Kết nối WebSocket cho 3 tài xế...');
  const connections = await Promise.all(
    driverSessions.map(d =>
      connectDriverSocket(d.tokens.accessToken, d.user.id, d.meta.name)
    )
  );
  await sleep(1000);

  // 3. Login customer 1
  console.log('\n▶ Đăng nhập khách hàng C1 (Nguyen Van A)...');
  const c1 = await login(CUSTOMERS[0].phone, CUSTOMERS[0].pass);
  console.log(`  ✓ C1 (userId=${c1.user.id})`);

  // 4. Create and confirm booking
  console.log('\n▶ Tạo booking CAR_4 tại Bến Thành...');
  const booking = await createBooking(c1.tokens.accessToken, 'CAR_4', 'CASH');
  if (!booking.success) {
    console.error('  ❌ Tạo booking thất bại:', JSON.stringify(booking));
    return;
  }
  // response: { success, data: { booking: { id, ... } } }
  const bkData = booking.data?.booking || booking.data;
  const bookingId = bkData?.id;
  const fareEstimate = bkData?.fareEstimate ?? bkData?.estimatedFare ?? bkData?.totalFare;
  console.log(`  ✓ Booking created: id=${bookingId} (fare estimate: ${fareEstimate}₫)`);

  console.log('\n▶ Xác nhận booking (trigger dispatch)...');
  const confirmed = await confirmBooking(c1.tokens.accessToken, bookingId);
  const confData = confirmed.data?.booking || confirmed.data;
  console.log(`  ✓ Booking confirmed → rideId: ${confData?.rideId ?? 'pending (async ride creation)'}, status: ${confData?.status}`);
  const rideId = confData?.rideId;

  // 5. Wait and observe notifications
  console.log('\n▶ Chờ dispatch notifications (15s)...');
  await sleep(15000);

  // 6. Report results
  console.log('\n📋 Kết quả nhận thông báo TEST A:');
  let anyReceived = false;
  connections.forEach(conn => {
    if (conn.received.length > 0) {
      anyReceived = true;
      console.log(`  🔔 ${conn.name}: ${conn.received.length} notification(s)`);
      conn.received.forEach(r => console.log(`       → ${r.ts}: rideId=${r.data.rideId}`));
    } else {
      console.log(`  ⚪ ${conn.name}: không nhận được thông báo`);
    }
  });

  if (!anyReceived) {
    console.log('  ⚠️  Không có driver nào nhận được thông báo. Có thể tất cả đã BUSY.');
  }

  // Cleanup sockets
  connections.forEach(c => c.socket?.disconnect());
  return rideId;
}

// ════════════════════════════════════════════════════════════════════════════
// TEST B — 1 Driver → 3 Customers (concurrent)
// ════════════════════════════════════════════════════════════════════════════

async function testB_1driver3customers() {
  separator('TEST B: 3 Customers Book Simultaneously → 1 Driver (D2)');
  console.log('   Scenario: D2 (Vo Thi E) là tài xế duy nhất online tại Bến Thành');
  console.log('   C1, C2, C3 đặt xe cùng lúc → ai được match trước?\n');

  // Login driver 2 only (others offline)
  console.log('▶ Đăng nhập Driver 2 và kết nối WebSocket...');
  const d2 = await login(DRIVERS[1].phone, DRIVERS[1].pass);
  const d2Conn = await connectDriverSocket(d2.tokens.accessToken, d2.user.id, DRIVERS[1].name);
  await sleep(1000);

  // Login 3 customers
  console.log('\n▶ Đăng nhập 3 khách hàng...');
  const [c1, c2, c3] = await Promise.all(
    CUSTOMERS.map(c => login(c.phone, c.pass).then(data => ({ ...data, meta: c })))
  );
  console.log(`  ✓ C1 ${c1.meta.name} (${c1.user.id})`);
  console.log(`  ✓ C2 ${c2.meta.name} (${c2.user.id})`);
  console.log(`  ✓ C3 ${c3.meta.name} (${c3.user.id})`);

  // Create bookings concurrently (3 customers)
  console.log('\n▶ 3 khách hàng tạo booking cùng lúc...');
  const [bk1, bk2, bk3] = await Promise.all([
    createBooking(c1.tokens.accessToken).then(r => ({ customer: 'C1', ...r })),
    createBooking(c2.tokens.accessToken).then(r => ({ customer: 'C2', ...r })),
    createBooking(c3.tokens.accessToken).then(r => ({ customer: 'C3', ...r })),
  ]);
  const getId = r => (r.data?.booking || r.data)?.id;
  console.log(`  C1 booking: ${bk1.success ? getId(bk1) : '❌ ' + bk1.message}`);
  console.log(`  C2 booking: ${bk2.success ? getId(bk2) : '❌ ' + bk2.message}`);
  console.log(`  C3 booking: ${bk3.success ? getId(bk3) : '❌ ' + bk3.message}`);

  // Confirm all 3 simultaneously (trigger dispatch for each)
  console.log('\n▶ 3 khách hàng confirm booking cùng lúc (trigger dispatch)...');
  const startTime = Date.now();

  const confirms = await Promise.all([
    bk1.success ? confirmBooking(c1.tokens.accessToken, getId(bk1)).then(r => ({ ...r, customer: 'C1', ts: Date.now() - startTime })) : null,
    bk2.success ? confirmBooking(c2.tokens.accessToken, getId(bk2)).then(r => ({ ...r, customer: 'C2', ts: Date.now() - startTime })) : null,
    bk3.success ? confirmBooking(c3.tokens.accessToken, getId(bk3)).then(r => ({ ...r, customer: 'C3', ts: Date.now() - startTime })) : null,
  ]);

  confirms.forEach(c => {
    if (c) {
      const rd = (c.data?.booking || c.data);
      console.log(`  ${c.customer} confirmed → rideId: ${rd?.rideId ?? 'async'}, status: ${rd?.status} (+${c.ts}ms)`);
    }
  });

  // Wait for dispatch notifications
  console.log('\n▶ Chờ dispatch notifications (15s)...');
  await sleep(15000);

  // Report
  console.log('\n📋 Kết quả nhận thông báo TEST B (Driver 2 - Vo Thi E):');
  if (d2Conn.received.length > 0) {
    console.log(`  🔔 D2 nhận ${d2Conn.received.length} offer(s):`);
    d2Conn.received.forEach((r, i) => {
      console.log(`    #${i+1} [${r.ts}] rideId=${r.data.rideId}`);
    });
    console.log('  → D2 chỉ nhận 1 offer tại một thời điểm (sequential dispatch)');
    console.log('  → Các khách hàng còn lại sẽ được dispatch đến các driver khác');
  } else {
    console.log('  ⚪ D2 không nhận được offer (có thể đã BUSY hoặc offline)');
  }

  d2Conn.socket?.disconnect();
}

// ════════════════════════════════════════════════════════════════════════════
// TEST C — Concurrent: 3 Customers + 3 Drivers (race condition)
// ════════════════════════════════════════════════════════════════════════════

async function testC_concurrent() {
  separator('TEST C: Concurrent Bookings — 3 Customers × 3 Drivers');
  console.log('   Scenario: D1, D2, D8 đều online; C1, C2, C3 đặt xe đồng thời');
  console.log('   Quan sát: hệ thống gán driver cho customer theo thứ tự nào?\n');

  // Login all drivers
  console.log('▶ Đăng nhập và kết nối 3 tài xế...');
  const driverSessions = await Promise.all(
    DRIVERS.map(d => login(d.phone, d.pass).then(data => ({ ...data, meta: d })))
  );
  const connections = await Promise.all(
    driverSessions.map(d =>
      connectDriverSocket(d.tokens.accessToken, d.user.id, d.meta.name)
    )
  );
  await sleep(1000);

  // Login 3 customers
  console.log('\n▶ Đăng nhập 3 khách hàng...');
  const customers = await Promise.all(
    CUSTOMERS.map(c => login(c.phone, c.pass).then(data => ({ ...data, meta: c })))
  );
  customers.forEach(c => console.log(`  ✓ ${c.meta.name}`));

  // Create + confirm all bookings in parallel
  console.log('\n▶ 3 khách hàng tạo booking đồng thời...');
  const bookings = await Promise.all(
    customers.map(c => createBooking(c.tokens.accessToken))
  );
  const getId2 = r => (r.data?.booking || r.data)?.id;
  bookings.forEach((b, i) =>
    console.log(`  ${CUSTOMERS[i].name}: ${b.success ? getId2(b) : '❌ ' + b.message}`)
  );

  console.log('\n▶ Confirm tất cả cùng lúc (đồng thời)...');
  const t0 = Date.now();
  const confirmed = await Promise.all(
    customers.map((c, i) =>
      bookings[i].success
        ? confirmBooking(c.tokens.accessToken, getId2(bookings[i]))
            .then(r => { const rd = (r.data?.booking || r.data); return { customer: CUSTOMERS[i].name, rideId: rd?.rideId, status: rd?.status, dt: Date.now() - t0, ok: r.success }; })
        : Promise.resolve({ customer: CUSTOMERS[i].name, ok: false })
    )
  );

  confirmed.forEach(r => {
    console.log(`  ${r.customer}: rideId=${r.rideId ?? '—'}, ok=${r.ok} (+${r.dt}ms)`);
  });

  // Wait and observe who gets what
  console.log('\n▶ Chờ dispatch kết thúc (20s)...');
  await sleep(20000);

  console.log('\n📋 Kết quả TEST C — Driver notifications:');
  connections.forEach(conn => {
    if (conn.received.length > 0) {
      console.log(`  🔔 ${conn.name}: nhận ${conn.received.length} offer(s)`);
      conn.received.forEach(r => console.log(`       rideId=${r.data.rideId} lúc ${r.ts}`));
    } else {
      console.log(`  ⚪ ${conn.name}: 0 offer`);
    }
  });

  connections.forEach(c => c.socket?.disconnect());
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║     DISPATCH MULTI-DRIVER/CUSTOMER TEST SUITE            ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log(`API Gateway: ${BASE_URL}`);
console.log(`Time: ${new Date().toLocaleString('vi-VN')}\n`);

try {
  await testA_3drivers1customer();
  await sleep(5000);

  await testB_1driver3customers();
  await sleep(5000);

  await testC_concurrent();

  console.log('\n✅ Tất cả tests hoàn tất!');
} catch (err) {
  console.error('\n❌ Test lỗi:', err.message);
  process.exit(1);
}
