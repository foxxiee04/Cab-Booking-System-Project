const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const AUTH_URL = process.env.SMOKE_AUTH_URL || 'http://localhost:3001';

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = { success: false, error: { message: 'Non-JSON response' } };
  }

  if (!response.ok || payload?.success === false) {
    const message = payload?.error?.message || `${response.status} ${response.statusText}`;
    throw new Error(`${path} failed: ${message}`);
  }

  return payload;
}

async function authRequest(path, options = {}) {
  const response = await fetch(`${AUTH_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = { success: false, error: { message: 'Non-JSON response' } };
  }

  if (!response.ok || payload?.success === false) {
    const message = payload?.error?.message || `${response.status} ${response.statusText}`;
    throw new Error(`AUTH ${path} failed: ${message}`);
  }

  return payload;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

const now = Date.now();
const newDriverPhone = `0988${String(now).slice(-6)}`;
const newDriverEmail = `smoke.driver.${now}@example.com`;
const password = 'Password@1';

const image1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBg1YgnP8AAAAASUVORK5CYII=';
const image2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAn8B9W4xQ7kAAAAASUVORK5CYII=';

const summary = {
  createdUserPhone: newDriverPhone,
  createdUserEmail: newDriverEmail,
  registerDriverStatus: null,
  adminSeenVehicleImage: false,
  adminSeenLicenseClass: false,
  rejectStatus: null,
  approveStatus: null,
  updateStatus: null,
};

try {
  const adminLogin = await authRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone: '0900000001', password }),
  });

  const adminToken = adminLogin.data.tokens.accessToken;

  await authRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      phone: newDriverPhone,
      password,
      role: 'DRIVER',
      firstName: 'Smoke',
      lastName: 'Driver',
    }),
  });

  const otpResp = await authRequest(`/api/auth/dev/otp/${newDriverPhone}?purpose=register`, { method: 'GET' });
  const otp = otpResp.data.otp;

  const verifyResp = await authRequest('/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone: newDriverPhone, otp }),
  });

  const driverToken = verifyResp.data.tokens.accessToken;
  const driverUserId = verifyResp.data.user.id;

  const registerDriverResp = await request('/api/drivers/register', {
    method: 'POST',
    headers: authHeader(driverToken),
    body: JSON.stringify({
      vehicle: {
        type: 'CAR_4',
        brand: 'Toyota',
        model: 'Vios',
        color: 'Black',
        plate: `51A${String(now).slice(-5)}`,
        year: 2022,
        imageUrl: image1,
      },
      license: {
        class: 'B',
        number: '123456789012',
        expiryDate: '2030-12-31',
      },
    }),
  });

  const driverId = registerDriverResp.data.driver.id;
  summary.registerDriverStatus = registerDriverResp.data.driver.status;

  const meAfterRegister = await request('/api/drivers/me', {
    method: 'GET',
    headers: authHeader(driverToken),
  });

  assert(meAfterRegister.data.driver.licenseClass === 'B', 'driver licenseClass after register must be B');
  assert(Boolean(meAfterRegister.data.driver.vehicleImageUrl), 'driver vehicleImageUrl after register must exist');

  const adminDriversAfterRegister = await request('/api/admin/drivers?status=PENDING&limit=200&page=1', {
    method: 'GET',
    headers: authHeader(adminToken),
  });

  const pendingDriver = (adminDriversAfterRegister.data.drivers || []).find((d) => d.userId === driverUserId || d.id === driverId);
  assert(Boolean(pendingDriver), 'admin must see newly registered driver in PENDING list');
  summary.adminSeenVehicleImage = Boolean(pendingDriver.vehicleImageUrl);
  summary.adminSeenLicenseClass = Boolean(pendingDriver.licenseClass === 'B');

  const rejectResp = await request(`/api/admin/drivers/${driverId}/reject`, {
    method: 'POST',
    headers: authHeader(adminToken),
    body: JSON.stringify({ reason: 'Smoke test reject path' }),
  });
  summary.rejectStatus = rejectResp.data.driver.status;
  assert(rejectResp.data.driver.status === 'REJECTED', 'reject endpoint must set status REJECTED');

  const approveResp = await request(`/api/admin/drivers/${driverId}/approve`, {
    method: 'POST',
    headers: authHeader(adminToken),
  });
  summary.approveStatus = approveResp.data.driver.status;
  assert(approveResp.data.driver.status === 'APPROVED', 'approve endpoint must set status APPROVED');

  const updateResp = await request('/api/drivers/me', {
    method: 'PUT',
    headers: authHeader(driverToken),
    body: JSON.stringify({
      vehicleType: 'CAR_7',
      vehicleImageUrl: image2,
      licenseClass: 'D2',
    }),
  });

  summary.updateStatus = updateResp.data.driver.status;
  assert(updateResp.data.driver.status === 'PENDING', 'editing vehicle/license fields must revert status to PENDING');
  assert(updateResp.data.driver.licenseClass === 'D2', 'licenseClass must be updated to D2');
  assert(Boolean(updateResp.data.driver.vehicleImageUrl), 'vehicleImageUrl must remain populated after update');

  const adminDriversAfterUpdate = await request('/api/admin/drivers?status=PENDING&limit=200&page=1', {
    method: 'GET',
    headers: authHeader(adminToken),
  });

  const pendingAfterUpdate = (adminDriversAfterUpdate.data.drivers || []).find((d) => d.id === driverId);
  assert(Boolean(pendingAfterUpdate), 'driver must appear in pending list after profile update');
  assert(pendingAfterUpdate.licenseClass === 'D2', 'admin list must expose updated licenseClass D2');
  assert(Boolean(pendingAfterUpdate.vehicleImageUrl), 'admin list must expose updated vehicleImageUrl');

  console.log(JSON.stringify({ success: true, summary }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ success: false, summary, error: String(error?.message || error) }, null, 2));
  process.exit(1);
}
