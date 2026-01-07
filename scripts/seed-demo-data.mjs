// Seed demo data for local dev (Docker Compose)
// Requires services up: api-gateway(3000), ride-service(3002), driver-service(3003), payment-service(3004), rabbitmq, redis, postgres, mongodb.
// Usage:
//   node scripts/seed-demo-data.mjs
// Environment:
//   GATEWAY_URL=http://localhost:3000
//   DEMO_CUSTOMER_EMAIL=customer@demo.local
//   DEMO_DRIVER_EMAIL=driver@demo.local
//   DEMO_PASSWORD=Password123!
//   DEMO_RIDES=3

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';

async function requestJson(method, url, body, token, options = {}) {
  const { retries = 0, retryDelayMs = 1000 } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 429 && attempt < retries) {
      const retryAfter = res.headers.get('retry-after');
      const waitMs = retryAfter ? Number(retryAfter) * 1000 : retryDelayMs * (attempt + 1);
      await sleep(Number.isFinite(waitMs) ? waitMs : retryDelayMs);
      continue;
    }

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      const message = data?.error?.message || data?.message || `${res.status} ${res.statusText}`;
      const err = new Error(`${method} ${url} failed: ${message}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function register({ email, password, role, firstName, lastName, phone }) {
  return requestJson('POST', `${GATEWAY_URL}/api/auth/register`, {
    email,
    password,
    role,
    firstName,
    lastName,
    phone,
  }, undefined, { retries: 5, retryDelayMs: 1200 });
}

async function login({ email, password }) {
  return requestJson('POST', `${GATEWAY_URL}/api/auth/login`, { email, password }, undefined, { retries: 5, retryDelayMs: 1200 });
}

async function ensureUser({ email, password, role, firstName, lastName, phone }) {
  try {
    await register({ email, password, role, firstName, lastName, phone });
  } catch (e) {
    // Most commonly: already exists
  }

  const result = await login({ email, password });
  return {
    user: result.data.user,
    token: result.data.tokens.accessToken,
    email,
  };
}

function withPlusSuffix(email, suffix) {
  const at = email.indexOf('@');
  if (at === -1) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return `${local}+${suffix}@${domain}`;
}

function phoneFromSuffix(suffix) {
  // 10 digits, deterministic for a given suffix
  const n = Number(suffix) % 1_000_000_0000; // 0..9999999999
  return String(1_000_000_0000 + n).slice(-10);
}

async function ensureUserWithFallback(base, label) {
  try {
    return await ensureUser(base);
  } catch (e) {
    const msg = String(e?.message || '');
    if (!msg.toLowerCase().includes('invalid credentials')) throw e;

    const suffix = Date.now();
    const newEmail = withPlusSuffix(base.email, suffix);
    const newPhone = phoneFromSuffix(suffix);
    console.log(`${label} account exists with different password; using ${newEmail} / phone ${newPhone}`);
    return await ensureUser({ ...base, email: newEmail, phone: newPhone });
  }
}

async function getDriverMe(token) {
  return requestJson('GET', `${GATEWAY_URL}/api/drivers/me`, undefined, token);
}

async function driverRegisterProfile(token, { vehicle, license }) {
  return requestJson('POST', `${GATEWAY_URL}/api/drivers/register`, { vehicle, license }, token);
}

async function driverGoOnline(token) {
  return requestJson('POST', `${GATEWAY_URL}/api/drivers/me/online`, {}, token);
}

async function driverUpdateLocation(token, { lat, lng }) {
  return requestJson('POST', `${GATEWAY_URL}/api/drivers/me/location`, { lat, lng }, token);
}

async function getCustomerRideHistory(token, { page = 1, limit = 50 } = {}) {
  return requestJson('GET', `${GATEWAY_URL}/api/rides/customer/history?page=${page}&limit=${limit}`, undefined, token);
}

async function getCustomerPaymentHistory(token, { page = 1, limit = 50 } = {}) {
  return requestJson(
    'GET',
    `${GATEWAY_URL}/api/payments/customer/history?page=${page}&limit=${limit}`,
    undefined,
    token
  );
}

async function getDriverEarnings(token, { page = 1, limit = 50 } = {}) {
  return requestJson('GET', `${GATEWAY_URL}/api/payments/driver/earnings?page=${page}&limit=${limit}`, undefined, token);
}

async function createRide(token, { pickup, dropoff }) {
  return requestJson('POST', `${GATEWAY_URL}/api/rides`, { pickup, dropoff }, token);
}

async function assignDriver(token, rideId, driverUserId) {
  // This hits ride-service via gateway; ride-service validates JWT.
  return requestJson('POST', `${GATEWAY_URL}/api/rides/${rideId}/assign`, { driverId: driverUserId }, token);
}

async function driverAcceptRide(token, rideId) {
  return requestJson('POST', `${GATEWAY_URL}/api/rides/${rideId}/accept`, {}, token);
}

async function driverStartRide(token, rideId) {
  return requestJson('POST', `${GATEWAY_URL}/api/rides/${rideId}/start`, {}, token);
}

async function driverCompleteRide(token, rideId) {
  return requestJson('POST', `${GATEWAY_URL}/api/rides/${rideId}/complete`, {}, token);
}

async function getPaymentByRide(token, rideId) {
  return requestJson('GET', `${GATEWAY_URL}/api/payments/ride/${rideId}`, undefined, token);
}

async function waitForPayment(token, rideId, { retries = 30, delayMs = 500 } = {}) {
  for (let i = 0; i < retries; i++) {
    try {
      const payment = await getPaymentByRide(token, rideId);
      return payment;
    } catch (e) {
      if (e.status && e.status !== 404) throw e;
      await sleep(delayMs);
    }
  }
  return null;
}

function pickLocations(index) {
  const pairs = [
    {
      pickup: { lat: 10.762622, lng: 106.660172, address: 'Trung tâm TP.HCM' },
      dropoff: { lat: 10.7769, lng: 106.7009, address: 'Landmark 81' },
    },
    {
      pickup: { lat: 10.7722, lng: 106.6579, address: 'Công viên Tao Đàn' },
      dropoff: { lat: 10.7827, lng: 106.6953, address: 'Thảo Cầm Viên' },
    },
    {
      pickup: { lat: 10.8009, lng: 106.6686, address: 'Sân bay Tân Sơn Nhất' },
      dropoff: { lat: 10.7599, lng: 106.6750, address: 'Chợ Bến Thành' },
    },
  ];
  return pairs[index % pairs.length];
}

async function createAndCompleteRide({ customerToken, driverToken, driverUserId, assignToken, index }) {
  const { pickup, dropoff } = pickLocations(index);
  const rideCreate = await createRide(customerToken, { pickup, dropoff });
  const rideId = rideCreate.data.ride.id;

  await assignDriver(assignToken, rideId, driverUserId);
  await driverAcceptRide(driverToken, rideId);
  await driverStartRide(driverToken, rideId);
  await driverCompleteRide(driverToken, rideId);

  const payment = await waitForPayment(customerToken, rideId);
  return { rideId, payment };
}

async function main() {
  const customerEmail = process.env.DEMO_CUSTOMER_EMAIL || 'customer.demo@example.com';
  const driverEmail = process.env.DEMO_DRIVER_EMAIL || 'driver.demo@example.com';
  const password = process.env.DEMO_PASSWORD || 'Password123!';
  const desiredRides = Math.max(1, parseInt(process.env.DEMO_RIDES || '3', 10) || 3);

  console.log('Seeding demo data...');
  console.log('Gateway:', GATEWAY_URL);

  const customerAuth = await ensureUserWithFallback({
    email: customerEmail,
    password,
    role: 'CUSTOMER',
    firstName: 'Demo',
    lastName: 'Customer',
    phone: '0900000001',
  }, 'Customer');

  const driverAuth = await ensureUserWithFallback({
    email: driverEmail,
    password,
    role: 'DRIVER',
    firstName: 'Demo',
    lastName: 'Driver',
    phone: '0900000002',
  }, 'Driver');

  const customer = customerAuth.user;
  const driver = driverAuth.user;

  // Ensure driver profile exists
  let hasProfile = true;
  try {
    await getDriverMe(driverAuth.token);
  } catch (e) {
    hasProfile = false;
  }

  if (!hasProfile) {
    const suffix = String(Date.now()).slice(-6);
    await driverRegisterProfile(driverAuth.token, {
      vehicle: {
        brand: 'Toyota',
        model: 'Vios',
        year: 2020,
        color: 'White',
        type: 'CAR',
        plate: `59A-${suffix}`,
      },
      license: {
        number: `DL-${suffix}`,
        expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
      },
    });
  }

  await driverGoOnline(driverAuth.token);
  await driverUpdateLocation(driverAuth.token, { lat: 10.762622, lng: 106.660172 });

  const history = await getCustomerRideHistory(customerAuth.token, { page: 1, limit: 100 });
  const existing = Array.isArray(history?.data?.rides) ? history.data.rides : [];
  const completedExisting = existing.filter((r) => String(r.status || '').toUpperCase() === 'COMPLETED').length;
  const toCreate = Math.max(0, desiredRides - completedExisting);

  const created = [];
  for (let i = 0; i < toCreate; i++) {
    const idx = completedExisting + i;
    const result = await createAndCompleteRide({
      customerToken: customerAuth.token,
      driverToken: driverAuth.token,
      driverUserId: driver.id,
      // assign via customer token (any authenticated user works; simplest)
      assignToken: customerAuth.token,
      index: idx,
    });
    created.push(result);
    console.log(`Created+completed ride ${i + 1}/${toCreate}: ${result.rideId}`);
  }

  const paymentHistory = await getCustomerPaymentHistory(customerAuth.token, { page: 1, limit: 100 });
  const earnings = await getDriverEarnings(driverAuth.token, { page: 1, limit: 100 });

  const customerPayments = paymentHistory?.data?.payments || paymentHistory?.data?.items || paymentHistory?.data?.data;
  const driverEarningsItems = earnings?.data?.payments || earnings?.data?.items || earnings?.data?.data;

  console.log('\n=== DEMO ACCOUNTS ===');
  console.log('Customer:', customerAuth.email);
  console.log('Driver:', driverAuth.email);
  console.log('Password:', password);

  console.log('\n=== SUMMARY ===');
  console.log(`Customer completed rides (existing): ${completedExisting}`);
  console.log(`Customer completed rides (created now): ${created.length}`);
  console.log(`Payments visible to customer: ${Array.isArray(customerPayments) ? customerPayments.length : '(see response structure)'}`);
  console.log(`Earnings items visible to driver: ${Array.isArray(driverEarningsItems) ? driverEarningsItems.length : '(see response structure)'}`);

  if (created.length) {
    console.log('\nCreated ride IDs:');
    for (const c of created) {
      console.log('-', c.rideId);
    }
  }

  console.log('\nTry in apps:');
  console.log('- Customer: /login -> /rides and /payments');
  console.log('- Driver: /login -> /rides and /earnings');
}

main().catch((e) => {
  console.error('Seed failed:', e.message);
  if (e.data) console.error(JSON.stringify(e.data, null, 2));
  process.exit(1);
});
