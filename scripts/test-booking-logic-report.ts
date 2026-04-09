type Json = Record<string, any>;

const BASE_URL = (process.env.LOGIC_TEST_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const PASSWORD = process.env.LOGIC_TEST_PASSWORD || 'Password@1';

const PICKUP = {
  address: 'Ben Thanh Market, Q1, TP.HCM',
  lat: 10.7726,
  lng: 106.698,
};

const DROPOFF = {
  address: 'Tan Son Nhat Airport, TP.HCM',
  lat: 10.8185,
  lng: 106.6588,
};

const FAR_PICKUP = {
  address: 'Can Gio Beach, TP.HCM',
  lat: 10.4114,
  lng: 106.9542,
};

const FAR_DROPOFF = {
  address: 'Binh Khanh Ferry, Can Gio, TP.HCM',
  lat: 10.6137,
  lng: 106.8571,
};

const TEST_CUSTOMERS = [
  'customer11@example.com',
  'customer12@example.com',
  'customer13@example.com',
  'customer14@example.com',
  'customer15@example.com',
];

const TEST_DRIVERS = [
  'driver21@example.com',
  'driver22@example.com',
  'driver23@example.com',
  'driver24@example.com',
  'driver25@example.com',
  'driver26@example.com',
  'driver27@example.com',
  'driver28@example.com',
  'driver29@example.com',
  'driver30@example.com',
];

type LoginResult = {
  user: { id: string; email: string; role: string; firstName?: string; lastName?: string };
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
};

type Ride = {
  id: string;
  customerId: string;
  driverId?: string | null;
  status: string;
  vehicleType: string;
  paymentMethod: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  createdAt: string;
};

type DriverProfile = {
  id: string;
  userId: string;
  vehicleType: string;
  availabilityStatus: string;
  status: string;
  lastLocationLat?: number | null;
  lastLocationLng?: number | null;
};

type NearbyDriver = {
  id: string;
  userId: string;
  vehicleType: string;
  availabilityStatus: string;
  lat: number;
  lng: number;
  distanceKm: number;
  rating: number;
};

type AuthUser = {
  email: string;
  token: string;
  userId: string;
};

type DriverUser = AuthUser & {
  driverId: string;
  vehicleType: string;
};

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function request<T = Json>(path: string, init: RequestInit = {}, token?: string): Promise<{ status: number; data: T }> {
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const text = await response.text();
  let data: T;
  try {
    data = (text ? JSON.parse(text) : {}) as T;
  } catch {
    data = text as T;
  }

  return { status: response.status, data };
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function login(email: string): Promise<AuthUser> {
  const response = await request<{ success: boolean; data: LoginResult }>(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password: PASSWORD }),
    }
  );

  assertCondition(response.status === 200, `Login failed for ${email}: ${response.status}`);
  const payload = response.data.data;
  assertCondition(payload?.tokens?.accessToken, `Missing access token for ${email}`);

  return {
    email,
    token: payload.tokens.accessToken,
    userId: payload.user.id,
  };
}

async function getDriverProfile(token: string): Promise<DriverProfile> {
  const response = await request<{ success: boolean; data: { driver: DriverProfile } }>('/api/drivers/me', {}, token);
  assertCondition(response.status === 200, `Get driver profile failed: ${response.status}`);
  return response.data.data.driver;
}

async function getDriverActiveRide(token: string): Promise<Ride | null> {
  const response = await request<{ success: boolean; data: Ride | null }>('/api/rides/driver/active', {}, token);
  assertCondition(response.status === 200, `Get driver active ride failed: ${response.status}`);
  return response.data.data;
}

async function getCustomerActiveRide(token: string): Promise<Ride | null> {
  const response = await request<{ success: boolean; data: { ride: Ride | null } }>('/api/rides/customer/active', {}, token);
  assertCondition(response.status === 200, `Get customer active ride failed: ${response.status}`);
  return response.data.data.ride;
}

async function cancelRide(rideId: string, token: string) {
  const response = await request('/api/rides/' + rideId + '/cancel', {
    method: 'POST',
    body: JSON.stringify({ reason: 'logic-test cleanup' }),
  }, token);
  assertCondition(response.status === 200, `Cancel ride ${rideId} failed: ${response.status}`);
}

async function ensureCustomerIdle(customer: AuthUser) {
  const activeRide = await getCustomerActiveRide(customer.token);
  if (activeRide) {
    await cancelRide(activeRide.id, customer.token);
  }
}

async function ensureDriverReady(driver: DriverUser, location: { lat: number; lng: number }) {
  const onlineResponse = await request('/api/drivers/me/online', { method: 'POST', body: JSON.stringify({}) }, driver.token);
  assertCondition([200, 400].includes(onlineResponse.status), `Go online failed for ${driver.email}: ${onlineResponse.status}`);

  const locationResponse = await request('/api/drivers/me/location', {
    method: 'POST',
    body: JSON.stringify(location),
  }, driver.token);
  assertCondition(locationResponse.status === 200, `Location update failed for ${driver.email}: ${locationResponse.status}`);
}

async function createRide(token: string, options?: {
  paymentMethod?: 'CASH' | 'MOMO';
  vehicleType?: 'MOTORBIKE' | 'SCOOTER' | 'CAR_4' | 'CAR_7';
  pickup?: typeof PICKUP;
  dropoff?: typeof DROPOFF;
}): Promise<Ride> {
  const pickup = options?.pickup || PICKUP;
  const dropoff = options?.dropoff || DROPOFF;
  const response = await request<{ success: boolean; data: { ride: Ride } }>('/api/rides', {
    method: 'POST',
    body: JSON.stringify({
      pickup,
      dropoff,
      vehicleType: options?.vehicleType || 'CAR_4',
      paymentMethod: options?.paymentMethod || 'CASH',
    }),
  }, token);

  assertCondition(
    response.status === 201 || response.status === 200,
    `Create ride failed: ${response.status} ${JSON.stringify(response.data)}`
  );
  return response.data.data.ride;
}

async function getRide(rideId: string, token: string): Promise<Ride> {
  const response = await request<{ success: boolean; data: { ride: Ride } }>('/api/rides/' + rideId, {}, token);
  assertCondition(response.status === 200, `Get ride ${rideId} failed: ${response.status}`);
  return response.data.data.ride;
}

async function getNearbyDrivers(customerToken: string, lat: number, lng: number, radius = 4): Promise<NearbyDriver[]> {
  const response = await request<{ success: boolean; data: { drivers: NearbyDriver[] } }>(
    `/api/drivers/nearby?lat=${lat}&lng=${lng}&radius=${radius}`,
    {},
    customerToken
  );
  assertCondition(response.status === 200, `Nearby drivers failed: ${response.status}`);
  return response.data.data.drivers || [];
}

async function getAvailableRides(driver: DriverUser): Promise<Ride[]> {
  const response = await request<{ success: boolean; data: { rides: Ride[] } }>(
    `/api/drivers/me/available-rides?lat=${PICKUP.lat}&lng=${PICKUP.lng}&radius=4`,
    {},
    driver.token
  );
  assertCondition(response.status === 200, `Available rides failed for ${driver.email}: ${response.status}`);
  return response.data.data.rides || [];
}

async function driverAcceptRide(driver: DriverUser, rideId: string) {
  return request<{ success: boolean; data?: Json; error?: Json }>(
    `/api/drivers/me/rides/${rideId}/accept`,
    { method: 'POST', body: JSON.stringify({}) },
    driver.token
  );
}

async function waitForStatus(rideId: string, customerToken: string, statuses: string[], attempts = 20, waitMs = 500): Promise<Ride> {
  let ride = await getRide(rideId, customerToken);
  for (let i = 0; i < attempts; i += 1) {
    if (statuses.includes(ride.status)) {
      return ride;
    }
    await sleep(waitMs);
    ride = await getRide(rideId, customerToken);
  }
  return ride;
}

async function main() {
  const customers = await Promise.all(TEST_CUSTOMERS.map(login));

  const driverAuth = await Promise.all(TEST_DRIVERS.map(login));
  const driversRaw = await Promise.all(driverAuth.map(async (driver) => {
    const profile = await getDriverProfile(driver.token);
    return {
      ...driver,
      driverId: profile.id,
      vehicleType: profile.vehicleType,
    } as DriverUser;
  }));

  const idleDrivers: DriverUser[] = [];
  for (const driver of driversRaw) {
    const activeRide = await getDriverActiveRide(driver.token);
    if (!activeRide) {
      idleDrivers.push(driver);
    }
  }

  const groups = new Map<string, DriverUser[]>();
  for (const driver of idleDrivers) {
    const arr = groups.get(driver.vehicleType) || [];
    arr.push(driver);
    groups.set(driver.vehicleType, arr);
  }

  const sortedGroups = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  assertCondition(sortedGroups.length > 0, 'No idle drivers found for logic test');

  const [scenarioVehicleType, compatibleDrivers] = sortedGroups[0] as [
    'MOTORBIKE' | 'SCOOTER' | 'CAR_4' | 'CAR_7',
    DriverUser[]
  ];
  assertCondition(compatibleDrivers.length >= 3, `Not enough idle compatible drivers for vehicle ${scenarioVehicleType}`);

  const drivers = compatibleDrivers.slice(0, 4);

  for (const customer of customers) {
    await ensureCustomerIdle(customer);
  }

  // Place 4 drivers around same area to test nearby and race behavior.
  const driverLocations = [
    { lat: PICKUP.lat + 0.0005, lng: PICKUP.lng + 0.0005 },
    { lat: PICKUP.lat + 0.0008, lng: PICKUP.lng + 0.0002 },
    { lat: PICKUP.lat - 0.0006, lng: PICKUP.lng - 0.0004 },
    { lat: PICKUP.lat - 0.001, lng: PICKUP.lng + 0.0007 },
  ];
  await Promise.all(drivers.map((driver, index) => ensureDriverReady(driver, driverLocations[index])));

  const nearbyBefore = await getNearbyDrivers(customers[0].token, PICKUP.lat, PICKUP.lng, 4);

  // Scenario A: 3 customers place rides concurrently at one pickup.
  const concurrentCustomers = customers.slice(0, 3);
  const rideCreates = await Promise.all(concurrentCustomers.map((customer) => createRide(customer.token, {
    paymentMethod: 'CASH',
    vehicleType: scenarioVehicleType,
  })));
  await sleep(2500);
  const ridesAfterMatch = await Promise.all(rideCreates.map((ride, i) => getRide(ride.id, concurrentCustomers[i].token)));

  // Scenario B: two drivers race to accept the same ride.
  const targetRide = ridesAfterMatch[0];
  const raceDrivers = drivers.slice(0, 2);
  const raceAcceptResults = await Promise.all(raceDrivers.map((driver) => driverAcceptRide(driver, targetRide.id)));
  const targetRideFinal = await waitForStatus(targetRide.id, concurrentCustomers[0].token, ['ASSIGNED', 'PICKING_UP', 'ACCEPTED'], 10, 500);

  // Scenario C: capacity pressure - 3 rides, only 2 remaining idle drivers attempt accept available rides.
  const remainingDrivers = drivers.slice(2, 4);
  const remainingRideIds = rideCreates.slice(1).map((ride) => ride.id);

  const acceptanceAttempts: Array<{ driverEmail: string; rideId: string; status: number; ok: boolean; message?: string }> = [];
  for (const driver of remainingDrivers) {
    const list = await getAvailableRides(driver);
    const candidate = list.find((ride) => remainingRideIds.includes(ride.id));
    if (!candidate) {
      acceptanceAttempts.push({ driverEmail: driver.email, rideId: '', status: 0, ok: false, message: 'no ride visible' });
      continue;
    }
    const accept = await driverAcceptRide(driver, candidate.id);
    acceptanceAttempts.push({
      driverEmail: driver.email,
      rideId: candidate.id,
      status: accept.status,
      ok: accept.status === 200,
      message: (accept.data as any)?.error?.message,
    });
  }

  await sleep(1200);
  const ridesAfterCapacity = await Promise.all(rideCreates.map((ride, i) => getRide(ride.id, concurrentCustomers[i].token)));

  // Scenario D: payment gating comparison.
  await ensureCustomerIdle(customers[3]);
  await ensureCustomerIdle(customers[4]);
  const cashRide = await createRide(customers[3].token, { paymentMethod: 'CASH', vehicleType: scenarioVehicleType });
  const momoRide = await createRide(customers[4].token, { paymentMethod: 'MOMO', vehicleType: scenarioVehicleType });
  await sleep(1500);
  const cashRideAfter = await getRide(cashRide.id, customers[3].token);
  const momoRideAfter = await getRide(momoRide.id, customers[4].token);

  // Scenario E: no nearby drivers area.
  await ensureCustomerIdle(customers[2]);
  const farRide = await createRide(customers[2].token, {
    paymentMethod: 'CASH',
    vehicleType: scenarioVehicleType,
    pickup: FAR_PICKUP,
    dropoff: FAR_DROPOFF,
  });
  await sleep(1200);
  const farNearby = await getNearbyDrivers(customers[2].token, FAR_PICKUP.lat, FAR_PICKUP.lng, 4);
  const farRideAfter = await getRide(farRide.id, customers[2].token);

  const report = {
    generatedAt: new Date().toISOString(),
    scenarioA: {
      description: '3 customers create rides concurrently at same pickup',
      vehicleType: scenarioVehicleType,
      rideIds: rideCreates.map((ride) => ride.id),
      statusesAfterMatching: ridesAfterMatch.map((ride) => ({ rideId: ride.id, status: ride.status, driverId: ride.driverId || null })),
      nearbyDriversCountAtPickup: nearbyBefore.length,
      nearbySample: nearbyBefore.slice(0, 6),
    },
    scenarioB: {
      description: 'Two drivers race to accept same ride',
      targetRideId: targetRide.id,
      attempts: raceAcceptResults.map((result, index) => ({
        driverEmail: raceDrivers[index].email,
        httpStatus: result.status,
        ok: result.status === 200,
        message: (result.data as any)?.error?.message || null,
      })),
      finalRide: {
        rideId: targetRideFinal.id,
        status: targetRideFinal.status,
        acceptedDriverId: targetRideFinal.driverId || null,
      },
    },
    scenarioC: {
      description: 'Capacity pressure with remaining rides and remaining drivers',
      attempts: acceptanceAttempts,
      rideStates: ridesAfterCapacity.map((ride) => ({ rideId: ride.id, status: ride.status, driverId: ride.driverId || null })),
    },
    scenarioD: {
      description: 'Payment gating: CASH vs MOMO',
      cashRide: { rideId: cashRideAfter.id, status: cashRideAfter.status, paymentMethod: cashRideAfter.paymentMethod },
      momoRide: { rideId: momoRideAfter.id, status: momoRideAfter.status, paymentMethod: momoRideAfter.paymentMethod },
    },
    scenarioE: {
      description: 'Sparse area: no nearby drivers',
      rideId: farRideAfter.id,
      rideStatus: farRideAfter.status,
      nearbyDriversCount: farNearby.length,
      pickup: FAR_PICKUP,
    },
  };

  console.log(JSON.stringify({ success: true, report }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
});
