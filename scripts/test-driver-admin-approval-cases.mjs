import { spawnSync } from 'node:child_process';

const GATEWAY = process.env.TEST_GATEWAY_URL || 'http://localhost:3000';
const AUTH = process.env.TEST_AUTH_URL || 'http://localhost:3001';

const password = 'Password@1';
const now = Date.now();
const phone = `0989${String(now).slice(-6)}`;

const imageDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBg1YgnP8AAAAASUVORK5CYII=';

function readCommandOutput(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    return '';
  }

  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

function stripAnsi(output) {
  return output.replace(/\u001b\[[0-9;]*m/g, '');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForOtpFromAuthLogs(phone, purpose = 'register') {
  const pattern = new RegExp(`\\[OTP\\]\\[${purpose}\\]\\s+${phone}:\\s*(\\d{6})`);
  const commands = [
    ['docker', ['logs', '--tail', '200', 'cab-auth-service']],
    ['docker', ['compose', 'logs', '--tail', '200', '--no-color', 'auth-service']],
    ['docker-compose', ['logs', '--tail', '200', '--no-color', 'auth-service']],
  ];

  for (let attempt = 0; attempt < 8; attempt += 1) {
    for (const [command, args] of commands) {
      const output = stripAnsi(readCommandOutput(command, args));
      const matches = [...output.matchAll(pattern)];
      const latest = matches[matches.length - 1];
      if (latest?.[1]) {
        return latest[1];
      }
    }

    await delay(500);
  }

  throw new Error(`Khong tim thay OTP cua ${phone} trong log auth-service.`);
}

function title(name) {
  return `CASE: ${name}`;
}

async function request(base, path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = { success: false, error: { message: 'Non-JSON response' } };
  }

  return { response, payload };
}

async function expectSuccess(base, path, options = {}, caseName = path) {
  const { response, payload } = await request(base, path, options);
  if (!response.ok || payload?.success === false) {
    throw new Error(`${caseName} expected success but failed: ${payload?.error?.message || response.statusText}`);
  }
  return payload;
}

async function expectFailure(base, path, options = {}, caseName = path) {
  const { response, payload } = await request(base, path, options);
  if (response.ok && payload?.success !== false) {
    throw new Error(`${caseName} expected failure but succeeded`);
  }
  return payload;
}

function authHeader(token) {
  return { authorization: `Bearer ${token}` };
}

(async () => {
  const results = [];

  try {
    // 1) Admin login success
    const adminLogin = await expectSuccess(AUTH, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@cabbooking.com', password }),
    }, 'admin login success');
    const adminToken = adminLogin.data.tokens.accessToken;
    results.push({ case: title('admin login success'), pass: true });

    // 2) Admin login fail (wrong password)
    await expectFailure(AUTH, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@cabbooking.com', password: 'wrong-password' }),
    }, 'admin login wrong password');
    results.push({ case: title('admin login wrong password'), pass: true });

    // 3) Driver register account + OTP verify
    await expectSuccess(AUTH, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        phone,
        password,
        role: 'DRIVER',
        firstName: 'Full',
        lastName: 'Case',
      }),
    }, 'driver auth register');

    const otp = await waitForOtpFromAuthLogs(phone, 'register');

    const verifyResp = await expectSuccess(AUTH, '/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    }, 'driver verify OTP');
    const driverToken = verifyResp.data.tokens.accessToken;
    const driverUserId = verifyResp.data.user.id;
    results.push({ case: title('driver login via OTP verify success'), pass: true, phone, driverUserId });

    // 4) Driver login fail (wrong password)
    await expectFailure(AUTH, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password: 'wrong-password' }),
    }, 'driver login wrong password');
    results.push({ case: title('driver login wrong password'), pass: true });

    // 5) Driver register profile fail due invalid class for CAR_4
    await expectFailure(GATEWAY, '/api/drivers/register', {
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
          imageUrl: imageDataUrl,
        },
        license: {
          class: 'A1',
          number: '123456789012',
          expiryDate: '2030-12-31',
        },
      }),
    }, 'driver profile register invalid class for cab');
    results.push({ case: title('driver register profile invalid class rejected'), pass: true });

    // 6) Driver register profile success with valid class + image
    const registerDriverResp = await expectSuccess(GATEWAY, '/api/drivers/register', {
      method: 'POST',
      headers: authHeader(driverToken),
      body: JSON.stringify({
        vehicle: {
          type: 'CAR_4',
          brand: 'Toyota',
          model: 'Vios',
          color: 'Black',
          plate: `51B${String(now).slice(-5)}`,
          year: 2022,
          imageUrl: imageDataUrl,
        },
        license: {
          class: 'B',
          number: '123456789012',
          expiryDate: '2030-12-31',
        },
      }),
    }, 'driver profile register valid');
    const driverId = registerDriverResp.data.driver.id;
    results.push({ case: title('driver register profile valid'), pass: true, driverId, status: registerDriverResp.data.driver.status });

    // 7) Admin pending list contains image + licenseClass
    const pending1 = await expectSuccess(GATEWAY, '/api/admin/drivers?status=PENDING&limit=100&offset=0', {
      method: 'GET',
      headers: authHeader(adminToken),
    }, 'admin get pending drivers');
    const row1 = (pending1.data.drivers || []).find((d) => d.id === driverId || d.userId === driverUserId);
    if (!row1 || !row1.vehicleImageUrl || row1.licenseClass !== 'B') {
      throw new Error('admin pending list missing vehicleImageUrl or licenseClass');
    }
    results.push({ case: title('admin sees image + license class in pending list'), pass: true });

    // 8) Approve works
    const approved = await expectSuccess(GATEWAY, `/api/admin/drivers/${driverId}/approve`, {
      method: 'POST',
      headers: authHeader(adminToken),
    }, 'approve driver');
    if (approved.data.driver.status !== 'APPROVED') {
      throw new Error('approve did not return APPROVED');
    }
    results.push({ case: title('admin approve works'), pass: true });

    // 9) Reject works (after approve, still should set REJECTED)
    const rejected = await expectSuccess(GATEWAY, `/api/admin/drivers/${driverId}/reject`, {
      method: 'POST',
      headers: authHeader(adminToken),
      body: JSON.stringify({ reason: 'Regression test reject' }),
    }, 'reject driver');
    if (rejected.data.driver.status !== 'REJECTED') {
      throw new Error('reject did not return REJECTED');
    }
    results.push({ case: title('admin reject works'), pass: true });

    // 10) Approve again so driver can proceed, then update profile invalid class fail
    await expectSuccess(GATEWAY, `/api/admin/drivers/${driverId}/approve`, {
      method: 'POST',
      headers: authHeader(adminToken),
    }, 'approve again');

    await expectFailure(GATEWAY, '/api/drivers/me', {
      method: 'PUT',
      headers: authHeader(driverToken),
      body: JSON.stringify({ vehicleType: 'CAR_7', licenseClass: 'A' }),
    }, 'driver profile update invalid class');
    results.push({ case: title('driver update invalid class rejected'), pass: true });

    // 11) Driver update valid class + image => pending again
    const updated = await expectSuccess(GATEWAY, '/api/drivers/me', {
      method: 'PUT',
      headers: authHeader(driverToken),
      body: JSON.stringify({
        vehicleType: 'CAR_7',
        licenseClass: 'D2',
        vehicleImageUrl: '/vehicle-images/yaris.jpg',
      }),
    }, 'driver profile update valid');

    if (updated.data.driver.status !== 'PENDING') {
      throw new Error('valid profile update did not reset status to PENDING');
    }
    results.push({ case: title('driver edit vehicle/license -> pending again'), pass: true });

    // 12) Admin pending list reflects updated class + image
    const pending2 = await expectSuccess(GATEWAY, '/api/admin/drivers?status=PENDING&limit=100&offset=0', {
      method: 'GET',
      headers: authHeader(adminToken),
    }, 'admin get pending drivers after update');
    const row2 = (pending2.data.drivers || []).find((d) => d.id === driverId);
    if (!row2 || row2.licenseClass !== 'D2' || !row2.vehicleImageUrl) {
      throw new Error('admin pending list missing updated licenseClass/image after update');
    }
    results.push({ case: title('admin sees updated class + image after edit'), pass: true });

    // 13) Static image endpoint responds
    const staticRes = await fetch(`${GATEWAY}/vehicle-images/yaris.jpg`);
    if (!staticRes.ok) {
      throw new Error('static vehicle image endpoint not accessible');
    }
    results.push({ case: title('vehicle image static endpoint accessible'), pass: true });

    console.log(JSON.stringify({ success: true, phone, driverId, results }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ success: false, phone, results, error: String(error?.message || error) }, null, 2));
    process.exit(1);
  }
})();
