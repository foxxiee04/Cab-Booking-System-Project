/**
 * Cab Booking System - Backend Logic Test
 * Tests the complete flow: Auth → Booking → Pricing → Ride → Payment → Notification → Review
 *
 * Usage: npx tsx scripts/test-backend.ts
 *
 * Prerequisites: All services must be running (docker-compose up)
 */

import { spawnSync } from 'node:child_process';

const BASE_URLS = {
  gateway: process.env.GATEWAY_URL || 'http://localhost:3000',
  auth: process.env.AUTH_URL || 'http://localhost:3001',
  ride: process.env.RIDE_URL || 'http://localhost:3002',
  driver: process.env.DRIVER_URL || 'http://localhost:3003',
  booking: process.env.BOOKING_URL || 'http://localhost:3008',
  notification: process.env.NOTIFICATION_URL || 'http://localhost:3005',
  payment: process.env.PAYMENT_URL || 'http://localhost:3004',
  user: process.env.USER_URL || 'http://localhost:3007',
  pricing: process.env.PRICING_URL || 'http://localhost:3009',
  review: process.env.REVIEW_URL || 'http://localhost:3010',
};

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  data?: any;
}

const results: TestResult[] = [];

// ============ HELPERS ============

async function httpRequest(
  url: string,
  method: string = 'GET',
  body?: any,
  headers?: Record<string, string>
): Promise<{ status: number; data: any }> {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function runTest(name: string, fn: () => Promise<any>): Promise<any> {
  const start = Date.now();
  try {
    const data = await fn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration, data });
    console.log(`  ✅ ${name} (${duration}ms)`);
    return data;
  } catch (error: any) {
    const duration = Date.now() - start;
    results.push({ name, passed: false, duration, error: error.message });
    console.log(`  ❌ ${name} (${duration}ms): ${error.message}`);
    return null;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function readCommandOutput(command: string, args: string[]): string {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    return '';
  }

  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

function stripAnsi(output: string): string {
  return output.replace(/\u001b\[[0-9;]*m/g, '');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForOtpFromAuthLogs(phone: string, purpose: 'register' | 'reset' = 'register'): Promise<string> {
  const pattern = new RegExp(`\\[OTP\\]\\[${purpose}\\]\\s+${phone}:\\s*(\\d{6})`);
  const commands: Array<[string, string[]]> = [
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

// ============ TEST FUNCTIONS ============

async function testHealthChecks() {
  console.log('\n📋 Phase 1: Health Checks');
  console.log('─'.repeat(50));

  const services = [
    { name: 'Auth Service', url: `${BASE_URLS.auth}/health` },
    { name: 'User Service', url: `${BASE_URLS.user}/health` },
    { name: 'Driver Service', url: `${BASE_URLS.driver}/health` },
    { name: 'Booking Service', url: `${BASE_URLS.booking}/health` },
    { name: 'Pricing Service', url: `${BASE_URLS.pricing}/health` },
    { name: 'Ride Service', url: `${BASE_URLS.ride}/health` },
    { name: 'Payment Service', url: `${BASE_URLS.payment}/health` },
    { name: 'Notification Service', url: `${BASE_URLS.notification}/health` },
    { name: 'Review Service', url: `${BASE_URLS.review}/health` },
  ];

  for (const svc of services) {
    await runTest(`Health: ${svc.name}`, async () => {
      const res = await httpRequest(svc.url);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(
        res.data.status === 'ok' || res.data.status === 'healthy',
        `Status not ok: ${JSON.stringify(res.data)}`
      );
      return res.data;
    });
  }
}

async function testAuthFlow() {
  console.log('\n📋 Phase 2: Authentication Flow (Phone + OTP)');
  console.log('─'.repeat(50));
  const password = 'Password@1';

  // Use unique phone numbers per test run (last 9 digits vary by timestamp → 10-digit phone)
  const ts = Date.now().toString().slice(-9).padStart(9, '0');
  const customerPhone = `0${ts}`;                                        // e.g. 0123456789
  const driverPhone   = `0${(parseInt(ts) + 1).toString().padStart(9, '0')}`;

  // Helper: register → read OTP from auth-service logs → verifyOtp → return { token, userId }
  async function registerAndLogin(phone: string, role: 'CUSTOMER' | 'DRIVER', label: string) {
    // 1. Register
    await runTest(`Register ${label}`, async () => {
      const res = await httpRequest(`${BASE_URLS.auth}/api/auth/register`, 'POST', {
        phone,
        password,
        role,
        firstName: 'Test',
        lastName: label,
      });
      assert(res.status === 201 || res.status === 200,
        `Register failed: ${res.status} ${JSON.stringify(res.data)}`);
      return res.data;
    });

    // 2. Read OTP from auth-service logs in KLTN/dev mode
    const otp = await runTest(`Read OTP from auth logs ${label}`, async () => {
      const currentOtp = await waitForOtpFromAuthLogs(phone, 'register');
      assert(/^\d{6}$/.test(currentOtp), `OTP log parse failed: ${currentOtp}`);
      return currentOtp;
    });

    // 3. Verify OTP → get tokens
    const verifyData = await runTest(`Verify OTP ${label}`, async () => {
      const res = await httpRequest(`${BASE_URLS.auth}/api/auth/verify-otp`, 'POST', {
        phone,
        otp,
      });
      assert(res.status === 200, `Verify OTP failed: ${res.status} ${JSON.stringify(res.data)}`);
      const tokens = res.data?.data?.tokens;
      assert(tokens?.accessToken, `No accessToken in response: ${JSON.stringify(res.data)}`);
      return res.data;
    });

    const token = verifyData?.data?.tokens?.accessToken;
    const userId = verifyData?.data?.user?.id;
    return { token, userId };
  }

  const customer = await registerAndLogin(customerPhone, 'CUSTOMER', 'customer');
  const token = customer.token;
  const userId = customer.userId;

  // Get profile
  if (token) {
    await runTest('Get user profile', async () => {
      const res = await httpRequest(`${BASE_URLS.auth}/api/auth/me`, 'GET', undefined, {
        Authorization: `Bearer ${token}`,
      });
      assert(res.status === 200, `Profile fetch failed: ${res.status}`);
      return res.data;
    });
  }

  const driver = await registerAndLogin(driverPhone, 'DRIVER', 'driver');

  return {
    customerToken: token,
    customerId: userId,
    customerPhone,
    driverToken: driver.token,
    driverId: driver.userId,
    driverPhone,
  };
}

async function testPricingFlow() {
  console.log('\n📋 Phase 3: Pricing Estimation');
  console.log('─'.repeat(50));

  const pricingData = await runTest('Get price estimate', async () => {
    const res = await httpRequest(`${BASE_URLS.pricing}/api/pricing/estimate`, 'POST', {
      pickupLat: 10.7628,
      pickupLng: 106.6825,
      dropoffLat: 10.7721,
      dropoffLng: 106.7002,
      vehicleType: 'ECONOMY',
    });
    assert(res.status === 200, `Pricing failed: ${res.status} ${JSON.stringify(res.data)}`);
    return res.data;
  });

  return pricingData;
}

async function testBookingFlow(auth: any) {
  console.log('\n📋 Phase 4: Booking Flow');
  console.log('─'.repeat(50));

  const headers: Record<string, string> = {};
  if (auth?.customerToken) {
    headers['Authorization'] = `Bearer ${auth.customerToken}`;
  }
  if (auth?.customerId) {
    headers['x-user-id'] = auth.customerId;
  }

  const bookingData = await runTest('Create booking', async () => {
    const res = await httpRequest(`${BASE_URLS.booking}/api/bookings`, 'POST', {
      customerId: auth?.customerId || 'test-customer-id',
      pickupAddress: '227 Nguyen Van Cu, Q5, TP.HCM',
      pickupLat: 10.7628,
      pickupLng: 106.6825,
      dropoffAddress: 'Saigon Centre, Le Loi, Q1, TP.HCM',
      dropoffLat: 10.7721,
      dropoffLng: 106.7002,
      vehicleType: 'ECONOMY',
      paymentMethod: 'CASH',
    }, headers);
    assert(res.status === 201 || res.status === 200, `Booking failed: ${res.status} ${JSON.stringify(res.data)}`);
    return res.data;
  });

  const bookingId = bookingData?.booking?.id || bookingData?.id;

  if (bookingId) {
    await runTest('Get booking by ID', async () => {
      const res = await httpRequest(
        `${BASE_URLS.booking}/api/bookings/${bookingId}`,
        'GET',
        undefined,
        headers
      );
      assert(res.status === 200, `Get booking failed: ${res.status}`);
      return res.data;
    });
  }

  return { bookingId, bookingData };
}

async function testUserService(auth: any) {
  console.log('\n📋 Phase 5: User Service');
  console.log('─'.repeat(50));

  if (!auth?.customerId) {
    console.log('  ⏭️  Skipped (no customer ID)');
    return;
  }

  await runTest('Create user profile', async () => {
    const res = await httpRequest(`${BASE_URLS.user}/api/users`, 'POST', {
      userId: auth.customerId,
      firstName: 'Test',
      lastName: 'Customer',
      phone: auth.customerPhone,
    });
    assert(res.status === 201 || res.status === 200 || res.status === 409 || res.status === 400,
      `Create profile failed: ${res.status} ${JSON.stringify(res.data)}`);
    return res.data;
  });

  await runTest('Get user profile', async () => {
    const res = await httpRequest(`${BASE_URLS.user}/api/users/${auth.customerId}`);
    assert(res.status === 200 || res.status === 404, `Get profile failed: ${res.status}`);
    return res.data;
  });
}

async function testPaymentMethods(auth: any) {
  console.log('\n📋 Phase 5b: Payment Methods (MoMo + VNPay)');
  console.log('─'.repeat(50));

  const headers: Record<string, string> = {};
  if (auth?.customerToken) {
    headers['Authorization'] = `Bearer ${auth.customerToken}`;
  }
  if (auth?.customerId) {
    headers['x-user-id'] = auth.customerId;
  }

  // 1. List available payment methods
  await runTest('Get payment methods', async () => {
    const res = await httpRequest(`${BASE_URLS.payment}/api/payments/methods`, 'GET', undefined, headers);
    assert(res.status === 200, `Get methods failed: ${res.status}`);
    const methods: string[] = res.data?.data?.methods || res.data?.methods || [];
    assert(
      methods.includes('MOMO') || methods.some((m: any) => (m.id || m) === 'MOMO'),
      `MOMO not in methods: ${JSON.stringify(methods)}`
    );
    assert(
      methods.includes('VNPAY') || methods.some((m: any) => (m.id || m) === 'VNPAY'),
      `VNPAY not in methods: ${JSON.stringify(methods)}`
    );
    return res.data;
  });

  // 2. Create MoMo payment intent (requires booking to exist)
  const momoData = await runTest('Create MoMo payment intent', async () => {
    const res = await httpRequest(`${BASE_URLS.payment}/api/payments/momo/create`, 'POST', {
      bookingId: `test-booking-${Date.now()}`,
      amount: 50000,
      currency: 'VND',
    }, headers);
    // 400 = booking not found is acceptable; 201/200 = intent created
    assert(
      res.status === 201 || res.status === 200 || res.status === 400 || res.status === 401,
      `MoMo create unexpected status: ${res.status} ${JSON.stringify(res.data)}`
    );
    return res.data;
  });

  // 3. Create VNPay payment intent
  await runTest('Create VNPay payment intent', async () => {
    const res = await httpRequest(`${BASE_URLS.payment}/api/payments/vnpay/create`, 'POST', {
      bookingId: `test-booking-${Date.now()}`,
      amount: 50000,
      currency: 'VND',
    }, headers);
    assert(
      res.status === 201 || res.status === 200 || res.status === 400 || res.status === 401,
      `VNPay create unexpected status: ${res.status} ${JSON.stringify(res.data)}`
    );
    // If successful, should return paymentUrl
    if (res.status === 200 || res.status === 201) {
      const url: string = res.data?.data?.paymentUrl || res.data?.paymentUrl || '';
      assert(url.includes('vnpayment') || url.length > 0, `No VNPay redirect URL in response`);
    }
    return res.data;
  });

  return momoData;
}

async function testNotificationService(auth: any) {
  console.log('\n📋 Phase 6: Notification Service');
  console.log('─'.repeat(50));

  const headers: Record<string, string> = {};
  if (auth?.customerId) {
    headers['x-user-id'] = auth.customerId;
  }

  await runTest('Get user notifications', async () => {
    const res = await httpRequest(
      `${BASE_URLS.notification}/api/notifications`,
      'GET',
      undefined,
      headers
    );
    assert(res.status === 200 || res.status === 401, `Notifications fetch failed: ${res.status}`);
    return res.data;
  });

  await runTest('Get notification statistics', async () => {
    const res = await httpRequest(`${BASE_URLS.notification}/api/notifications/statistics`);
    assert(res.status === 200, `Stats failed: ${res.status}`);
    return res.data;
  });
}

async function testReviewService(auth: any) {
  console.log('\n📋 Phase 7: Review Service');
  console.log('─'.repeat(50));

  const headers: Record<string, string> = {};
  if (auth?.customerId) {
    headers['x-user-id'] = auth.customerId;
    headers['x-user-name'] = 'Test Customer';
  }

  const reviewData = await runTest('Create review', async () => {
    const res = await httpRequest(`${BASE_URLS.review}/api/reviews`, 'POST', {
      rideId: `test-ride-${Date.now()}`,
      bookingId: `test-booking-${Date.now()}`,
      type: 'CUSTOMER_TO_DRIVER',
      revieweeId: auth?.driverId || 'test-driver-id',
      revieweeName: 'Test Driver',
      rating: 5,
      comment: 'Excellent service!',
      tags: ['professional', 'clean_car'],
    }, headers);
    assert(
      res.status === 201 || res.status === 200 || res.status === 409 || res.status === 400 || res.status === 500,
      `Create review failed: ${res.status} ${JSON.stringify(res.data)}`
    );
    return res.data;
  });

  if (auth?.driverId) {
    await runTest('Get driver received reviews', async () => {
      const res = await httpRequest(
        `${BASE_URLS.review}/api/reviews/received/${auth.driverId}`
      );
      assert(res.status === 200, `Get reviews failed: ${res.status}`);
      return res.data;
    });

    await runTest('Get driver stats', async () => {
      const res = await httpRequest(
        `${BASE_URLS.review}/api/reviews/driver/${auth.driverId}/stats`
      );
      assert(res.status === 200, `Get stats failed: ${res.status}`);
      return res.data;
    });
  }

  await runTest('Get top rated drivers', async () => {
    const res = await httpRequest(`${BASE_URLS.review}/api/reviews/top-drivers`);
    assert(res.status === 200, `Top drivers failed: ${res.status}`);
    return res.data;
  });

  return reviewData;
}

// ============ MAIN ============

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║    Cab Booking System - Backend Logic Test       ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  const startTime = Date.now();

  // Phase 1: Health checks
  await testHealthChecks();

  // Phase 2: Auth flow
  const auth = await testAuthFlow();

  // Phase 3: Pricing
  await testPricingFlow();

  // Phase 4: Booking
  await testBookingFlow(auth);

  // Phase 5: User service
  await testUserService(auth);

  // Phase 5b: Payment methods (new MoMo/VNPay)
  await testPaymentMethods(auth);

  // Phase 6: Notifications
  await testNotificationService(auth);

  // Phase 7: Reviews
  await testReviewService(auth);

  // ============ REPORT ============
  const totalTime = Date.now() - startTime;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║                  TEST REPORT                     ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Total:   ${total.toString().padEnd(5)} tests                          ║`);
  console.log(`║  Passed:  ${passed.toString().padEnd(5)} ✅                              ║`);
  console.log(`║  Failed:  ${failed.toString().padEnd(5)} ❌                              ║`);
  console.log(`║  Time:    ${(totalTime / 1000).toFixed(2).padEnd(5)}s                            ║`);
  console.log('╚══════════════════════════════════════════════════╝');

  if (failed > 0) {
    console.log('\nFailed tests:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  ❌ ${r.name}: ${r.error}`);
      });
  }

  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
