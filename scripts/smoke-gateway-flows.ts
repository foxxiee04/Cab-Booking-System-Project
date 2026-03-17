type JsonValue = Record<string, any>;

const BASE_URL = (process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const DEFAULT_PASSWORD = process.env.SMOKE_PASSWORD || 'password123';

const accounts = {
  admin: process.env.SMOKE_ADMIN_EMAIL || 'admin@cabbooking.com',
  customer: process.env.SMOKE_CUSTOMER_EMAIL || 'customer1@example.com',
  driver: process.env.SMOKE_DRIVER_EMAIL || 'driver1@example.com',
};

interface LoginResult {
  user: {
    id: string;
    email: string;
    role: string;
    firstName?: string;
    lastName?: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

interface RequestResult<T = JsonValue> {
  status: number;
  data: T;
}

interface RideRecord {
  id: string;
  customerId: string;
  driverId?: string | null;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request<T = JsonValue>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<RequestResult<T>> {
  const headers = new Headers(init.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

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

  return {
    status: response.status,
    data,
  };
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function login(email: string): Promise<LoginResult> {
  const response = await request<{ success: boolean; data: LoginResult }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: DEFAULT_PASSWORD }),
  });

  assertCondition(response.status === 200, `Login failed for ${email}: ${response.status}`);
  return response.data.data;
}

async function getRide(rideId: string, token: string): Promise<RideRecord> {
  const response = await request<{ success: boolean; data: { ride: RideRecord } }>(`/api/rides/${rideId}`, {}, token);
  assertCondition(response.status === 200, `Get ride ${rideId} failed: ${response.status}`);
  return response.data.data.ride;
}

async function getCustomerActiveRide(token: string): Promise<RideRecord | null> {
  const response = await request<{ success: boolean; data: { ride: RideRecord | null } }>('/api/rides/customer/active', {}, token);
  assertCondition(response.status === 200, `Get customer active ride failed: ${response.status}`);
  return response.data.data.ride;
}

async function cancelRide(rideId: string, token: string) {
  const response = await request(`/api/rides/${rideId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'Smoke reset' }),
  }, token);

  assertCondition(response.status === 200, `Cancel ride ${rideId} failed: ${response.status}`);
}

async function createRide(token: string): Promise<RideRecord> {
  const response = await request<{ success: boolean; data: { ride: RideRecord } }>('/api/rides', {
    method: 'POST',
    body: JSON.stringify({
      pickup: {
        address: '227 Nguyen Van Cu, Q5, TP.HCM',
        lat: 10.7628,
        lng: 106.6825,
      },
      dropoff: {
        address: 'Saigon Centre, Le Loi, Q1, TP.HCM',
        lat: 10.7721,
        lng: 106.7002,
      },
      vehicleType: 'ECONOMY',
      paymentMethod: 'CASH',
    }),
  }, token);

  if (response.status === 400 && (response.data as any)?.error?.code === 'ACTIVE_RIDE_EXISTS') {
    const activeRide = await getCustomerActiveRide(token);
    assertCondition(activeRide, 'Customer has ACTIVE_RIDE_EXISTS but no active ride returned');
    return activeRide;
  }

  assertCondition(response.status === 201 || response.status === 200, `Create ride failed: ${response.status}`);
  return response.data.data.ride;
}

async function waitForRideStatus(rideId: string, token: string, allowedStatuses: string[], attempts = 8): Promise<RideRecord> {
  let latestRide = await getRide(rideId, token);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (allowedStatuses.includes(latestRide.status)) {
      return latestRide;
    }

    await sleep(1000);
    latestRide = await getRide(rideId, token);
  }

  throw new Error(`Ride ${rideId} did not reach one of [${allowedStatuses.join(', ')}], current status=${latestRide.status}`);
}

async function advanceRideToCompleted(ride: RideRecord, customerToken: string, driverToken: string, expectedDriverUserId: string) {
  let currentRide = ride;

  if (currentRide.status === 'COMPLETED') {
    return currentRide;
  }

  if (currentRide.driverId && currentRide.driverId !== expectedDriverUserId && currentRide.status !== 'REQUESTED') {
    await cancelRide(currentRide.id, customerToken);
    currentRide = await createRide(customerToken);
  }

  if (['CREATED', 'REQUESTED', 'FINDING_DRIVER'].includes(currentRide.status)) {
    const acceptResponse = await request(`/api/rides/${currentRide.id}/driver-accept`, {
      method: 'POST',
      body: JSON.stringify({}),
    }, driverToken);

    assertCondition(
      acceptResponse.status === 200 || acceptResponse.status === 201,
      `Driver accept failed: ${acceptResponse.status}`,
    );

    currentRide = await waitForRideStatus(currentRide.id, customerToken, ['ASSIGNED', 'PICKING_UP', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED']);
  }

  if (currentRide.status === 'ASSIGNED') {
    const pickupResponse = await request(`/api/rides/${currentRide.id}/pickup`, {
      method: 'POST',
      body: JSON.stringify({}),
    }, driverToken);

    assertCondition(pickupResponse.status === 200, `Pickup failed: ${pickupResponse.status}`);
    currentRide = await waitForRideStatus(currentRide.id, customerToken, ['PICKING_UP', 'IN_PROGRESS', 'COMPLETED']);
  }

  if (currentRide.status === 'ACCEPTED' || currentRide.status === 'PICKING_UP') {
    const startResponse = await request(`/api/rides/${currentRide.id}/start`, {
      method: 'POST',
      body: JSON.stringify({}),
    }, driverToken);

    assertCondition(startResponse.status === 200, `Start ride failed: ${startResponse.status}`);
    currentRide = await waitForRideStatus(currentRide.id, customerToken, ['IN_PROGRESS', 'COMPLETED']);
  }

  if (currentRide.status === 'IN_PROGRESS') {
    const completeResponse = await request(`/api/rides/${currentRide.id}/complete`, {
      method: 'POST',
      body: JSON.stringify({}),
    }, driverToken);

    assertCondition(completeResponse.status === 200, `Complete ride failed: ${completeResponse.status}`);
    currentRide = await waitForRideStatus(currentRide.id, customerToken, ['COMPLETED']);
  }

  assertCondition(currentRide.status === 'COMPLETED', `Ride ${currentRide.id} is not completed: ${currentRide.status}`);
  return currentRide;
}

async function main() {
  const [admin, customer, driver] = await Promise.all([
    login(accounts.admin),
    login(accounts.customer),
    login(accounts.driver),
  ]);

  const locationResponse = await request('/api/drivers/me/location', {
    method: 'POST',
    body: JSON.stringify({ lat: 10.7628, lng: 106.6825 }),
  }, driver.tokens.accessToken);
  assertCondition(locationResponse.status === 200, `Driver location update failed: ${locationResponse.status}`);

  const nearbyResponse = await request<{ success: boolean; data: { drivers: Array<JsonValue> } }>(
    '/api/drivers/nearby?lat=10.7628&lng=106.6825&radius=4',
    {},
    customer.tokens.accessToken,
  );
  assertCondition(nearbyResponse.status === 200, `Nearby drivers failed: ${nearbyResponse.status}`);
  const nearbyDrivers = nearbyResponse.data.data.drivers || [];
  assertCondition(nearbyDrivers.length > 0, 'Nearby drivers flow returned no drivers');

  let activeRide = await getCustomerActiveRide(customer.tokens.accessToken);
  if (activeRide && !['REQUESTED', 'ASSIGNED', 'ACCEPTED', 'PICKING_UP', 'IN_PROGRESS', 'COMPLETED'].includes(activeRide.status)) {
    activeRide = null;
  }

  const ride = activeRide || await createRide(customer.tokens.accessToken);
  const completedRide = await advanceRideToCompleted(
    ride,
    customer.tokens.accessToken,
    driver.tokens.accessToken,
    driver.user.id,
  );

  const reviewListResponse = await request<{ success: boolean; count?: number; reviews?: Array<JsonValue> }>(
    `/api/reviews/ride/${completedRide.id}`,
    {},
    customer.tokens.accessToken,
  );
  assertCondition(reviewListResponse.status === 200, `Get ride reviews failed: ${reviewListResponse.status}`);

  const existingReviews = reviewListResponse.data.reviews || [];
  if (existingReviews.length === 0) {
    const createReviewResponse = await request('/api/reviews', {
      method: 'POST',
      body: JSON.stringify({
        rideId: completedRide.id,
        bookingId: completedRide.id,
        type: 'CUSTOMER_TO_DRIVER',
        reviewerName: `${customer.user.firstName || 'Smoke'} ${customer.user.lastName || 'Customer'}`.trim(),
        revieweeId: completedRide.driverId || driver.user.id,
        revieweeName: `${driver.user.firstName || 'Smoke'} ${driver.user.lastName || 'Driver'}`.trim(),
        rating: 5,
        comment: 'Smoke test review',
      }),
    }, customer.tokens.accessToken);

    assertCondition(
      createReviewResponse.status === 201 || createReviewResponse.status === 200 || createReviewResponse.status === 409,
      `Create review failed: ${createReviewResponse.status}`,
    );
  }

  const reviewAfterCreate = await request<{ success: boolean; count?: number; reviews?: Array<JsonValue> }>(
    `/api/reviews/ride/${completedRide.id}`,
    {},
    customer.tokens.accessToken,
  );
  assertCondition(reviewAfterCreate.status === 200, `Re-fetch ride reviews failed: ${reviewAfterCreate.status}`);
  assertCondition((reviewAfterCreate.data.reviews || []).length > 0, 'Post-trip review flow returned no persisted review');

  const adminDriversResponse = await request<{ success: boolean; data: { drivers: Array<JsonValue>; total: number } }>(
    '/api/admin/drivers?limit=200',
    {},
    admin.tokens.accessToken,
  );
  assertCondition(adminDriversResponse.status === 200, `Admin drivers failed: ${adminDriversResponse.status}`);

  const adminDrivers = adminDriversResponse.data.data.drivers || [];
  const heatmapDrivers = adminDrivers.filter((driverRecord) => driverRecord.currentLocation?.lat != null && driverRecord.currentLocation?.lng != null);
  assertCondition(heatmapDrivers.length > 0, 'Admin heatmap flow returned no drivers with live coordinates');

  const summary = {
    nearbyDrivers: nearbyDrivers.length,
    completedRideId: completedRide.id,
    reviewCount: (reviewAfterCreate.data.reviews || []).length,
    adminDrivers: adminDrivers.length,
    heatmapDrivers: heatmapDrivers.length,
  };

  console.log(JSON.stringify({ success: true, summary }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
});