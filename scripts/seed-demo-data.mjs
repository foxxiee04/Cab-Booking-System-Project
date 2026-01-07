// Seed demo data for local dev (Docker Compose)
// Requires services up: api-gateway(3000), ride-service(3002), driver-service(3003), payment-service(3004), rabbitmq, redis, postgres, mongodb.
// Usage: node scripts/seed-demo-data.mjs

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';
const RIDE_SERVICE_URL = process.env.RIDE_SERVICE_URL || 'http://localhost:3002';

async function requestJson(method, url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  const text = await res.text();
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

async function register({ email, password, role, firstName, lastName, phone }) {
  return requestJson('POST', `${GATEWAY_URL}/api/auth/register`, {
    email,
    password,
    role,
    firstName,
    lastName,
    phone,
  });
}

async function login({ email, password }) {
  return requestJson('POST', `${GATEWAY_URL}/api/auth/login`, { email, password });
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

async function createRide(token, { pickup, dropoff }) {
  return requestJson('POST', `${GATEWAY_URL}/api/rides`, { pickup, dropoff }, token);
}

async function assignDriverInternal(rideId, driverUserId) {
  // Internal route on ride-service; does NOT require auth.
  return requestJson('POST', `${RIDE_SERVICE_URL}/api/rides/${rideId}/assign`, { driverId: driverUserId });
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const now = Date.now();
  const customerEmail = process.env.DEMO_CUSTOMER_EMAIL || `customer${now}@demo.local`;
  const driverEmail = process.env.DEMO_DRIVER_EMAIL || `driver${now}@demo.local`;
  const password = process.env.DEMO_PASSWORD || 'Password123!';

  console.log('Seeding demo data...');
  console.log('Gateway:', GATEWAY_URL);
  console.log('Ride service:', RIDE_SERVICE_URL);

  // 1) Register users (idempotent-ish: if already exists, we just login)
  try {
    await register({
      email: customerEmail,
      password,
      role: 'CUSTOMER',
      firstName: 'Demo',
      lastName: 'Customer',
      phone: '+84900000001',
    });
  } catch (e) {
    console.log('Customer register skipped:', e.message);
  }

  try {
    await register({
      email: driverEmail,
      password,
      role: 'DRIVER',
      firstName: 'Demo',
      lastName: 'Driver',
      phone: '+84900000002',
    });
  } catch (e) {
    console.log('Driver register skipped:', e.message);
  }

  const customerLogin = await login({ email: customerEmail, password });
  const driverLogin = await login({ email: driverEmail, password });

  const customer = customerLogin.data.user;
  const driver = driverLogin.data.user;

  const customerToken = customerLogin.data.tokens.accessToken;
  const driverToken = driverLogin.data.tokens.accessToken;

  // 2) Driver profile + online + location
  try {
    await driverRegisterProfile(driverToken, {
      vehicle: {
        make: 'Toyota',
        model: 'Vios',
        year: 2020,
        color: 'White',
        licensePlate: `59A-${String(now).slice(-5)}`,
        type: 'CAR',
      },
      license: {
        number: `DL-${String(now).slice(-8)}`,
        expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
      },
    });
  } catch (e) {
    console.log('Driver profile register skipped:', e.message);
  }

  await driverGoOnline(driverToken);
  await driverUpdateLocation(driverToken, { lat: 10.762622, lng: 106.660172 });

  // 3) Create ride (customer)
  const rideCreate = await createRide(customerToken, {
    pickup: { lat: 10.762622, lng: 106.660172, address: 'Trung tâm TP.HCM' },
    dropoff: { lat: 10.7769, lng: 106.7009, address: 'Landmark 81' },
  });

  const rideId = rideCreate.data.ride.id;
  console.log('Created ride:', rideId);

  // 4) Assign driver internally (simulates matching service)
  await assignDriverInternal(rideId, driver.id);

  // 5) Driver accepts/starts/completes
  await driverAcceptRide(driverToken, rideId);
  await driverStartRide(driverToken, rideId);
  await driverCompleteRide(driverToken, rideId);

  // 6) Wait for payment to appear (async via events)
  let payment;
  for (let i = 0; i < 20; i++) {
    try {
      payment = await getPaymentByRide(customerToken, rideId);
      break;
    } catch (e) {
      await sleep(500);
    }
  }

  console.log('\n=== DEMO ACCOUNTS ===');
  console.log('Customer email:', customerEmail);
  console.log('Driver email:', driverEmail);
  console.log('Password:', password);
  console.log('\n=== DEMO DATA ===');
  console.log('Ride ID:', rideId);
  if (payment?.data) {
    console.log('Payment:', payment.data);
  } else {
    console.log('Payment: (not found yet) - ensure rabbitmq/payment-service are running');
  }

  console.log('\nTry in apps:');
  console.log('- Customer: /login -> /book -> history endpoint /api/rides/customer/history');
  console.log('- Driver: / -> /dashboard (go online, accept ride)');
}

main().catch((e) => {
  console.error('Seed failed:', e.message);
  if (e.data) console.error(JSON.stringify(e.data, null, 2));
  process.exit(1);
});
