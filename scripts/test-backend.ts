/**
 * ============================================
 * BACKEND BUSINESS LOGIC TESTING SCRIPT
 * ============================================
 * Tests backend APIs directly without frontend
 * Validates business rules, state transitions, permissions
 */

import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

// Test credentials
const ADMIN_CREDS = { email: 'admin@cabsystem.vn', password: 'Admin@123' };
const DRIVER_CREDS = { email: 'driver1@cabsystem.vn', password: 'Driver@123' };
const CUSTOMER_CREDS = { email: 'customer1@gmail.com', password: 'Customer@123' };

let adminToken: string;
let driverToken: string;
let customerToken: string;
let driverId: string;
let customerId: string;
let testRideId: string;

function log(test: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, details?: any) {
  results.push({ test, status, message, details });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} ${test}: ${message}`);
  if (details) {
    console.log(`   Details:`, JSON.stringify(details, null, 2));
  }
}

async function testAuthenticationFlow() {
  console.log('\n🔐 ===== AUTHENTICATION & AUTHORIZATION =====\n');
  
  try {
    // Test 1: Admin login
    const adminRes = await axios.post(`${API_BASE_URL}/api/auth/login`, ADMIN_CREDS);
    adminToken = adminRes.data.data.tokens.accessToken;
    log('AUTH-001', 'PASS', 'Admin login successful', { role: 'ADMIN' });
    
    // Test 2: Driver login
    const driverRes = await axios.post(`${API_BASE_URL}/api/auth/login`, DRIVER_CREDS);
    driverToken = driverRes.data.data.tokens.accessToken;
    log('AUTH-002', 'PASS', 'Driver login successful', { role: 'DRIVER' });
    
    // Test 3: Customer login
    const customerRes = await axios.post(`${API_BASE_URL}/api/auth/login`, CUSTOMER_CREDS);
    customerToken = customerRes.data.data.tokens.accessToken;
    customerId = customerRes.data.data.user.id;
    log('AUTH-003', 'PASS', 'Customer login successful', { role: 'CUSTOMER', customerId });
    
    // Test 4: Invalid credentials
    try {
      await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email: 'invalid@test.com',
        password: 'wrong',
      });
      log('AUTH-004', 'FAIL', 'Should reject invalid credentials', null);
    } catch (err: any) {
      if (err.response?.status === 401) {
        log('AUTH-004', 'PASS', 'Correctly rejected invalid credentials', null);
      } else {
        log('AUTH-004', 'FAIL', `Unexpected error: ${err.message}`, null);
      }
    }
    
    // Test 5: Protected route without token
    try {
      await axios.get(`${API_BASE_URL}/api/users/profile`);
      log('AUTH-005', 'FAIL', 'Should reject unauthenticated request', null);
    } catch (err: any) {
      if (err.response?.status === 401) {
        log('AUTH-005', 'PASS', 'Correctly rejected unauthenticated request', null);
      } else {
        log('AUTH-005', 'FAIL', `Unexpected error: ${err.message}`, null);
      }
    }
    
  } catch (error: any) {
    log('AUTH-ERROR', 'FAIL', `Authentication tests failed: ${error.message}`, null);
  }
}

async function testUserManagement() {
  console.log('\n👤 ===== USER MANAGEMENT =====\n');
  
  const adminClient = axios.create({
    baseURL: API_BASE_URL,
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  
  try {
    // Test 1: Admin can get all users
    const usersRes = await adminClient.get('/api/auth/users');
    log('USER-001', 'PASS', `Admin retrieved ${usersRes.data.length || usersRes.data.users?.length || 0} users`, null);
    
    // Test 2: Get customer profile
    const customerClient = axios.create({
      baseURL: API_BASE_URL,
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    
    const profileRes = await customerClient.get('/api/auth/me');
    log('USER-002', 'PASS', 'Customer retrieved own profile', { email: profileRes.data.email });
    
    // Test 3: Customer cannot access admin endpoints
    try {
      await customerClient.get('/api/admin/statistics');
      log('USER-003', 'FAIL', 'Customer should not access admin endpoints', null);
    } catch (err: any) {
      if (err.response?.status === 403 || err.response?.status === 401) {
        log('USER-003', 'PASS', 'Correctly blocked customer from admin endpoint', null);
      } else {
        log('USER-003', 'FAIL', `Unexpected error: ${err.message}`, null);
      }
    }
    
  } catch (error: any) {
    log('USER-ERROR', 'FAIL', `User management tests failed: ${error.message}`, null);
  }
}

async function testDriverManagement() {
  console.log('\n🚗 ===== DRIVER MANAGEMENT =====\n');
  
  const driverClient = axios.create({
    baseURL: API_BASE_URL,
    headers: { Authorization: `Bearer ${driverToken}` },
  });
  
  try {
    // Test 1: Get driver profile
    const profileRes = await driverClient.get('/api/drivers/me');
    driverId = profileRes.data.id;
    log('DRIVER-001', 'PASS', 'Driver retrieved profile', {
      status: profileRes.data.status,
      availability: profileRes.data.availabilityStatus,
      vehicle: `${profileRes.data.vehicleBrand} ${profileRes.data.vehicleModel}`,
    });
    
    // Test 2: Driver can update availability
    if (profileRes.data.status === 'APPROVED') {
      const updateRes = await driverClient.patch('/api/drivers/availability', {
        availabilityStatus: 'ONLINE',
      });
      log('DRIVER-002', 'PASS', 'Driver updated availability to ONLINE', null);
    } else {
      log('DRIVER-002', 'SKIP', 'Driver not approved, cannot go online', null);
    }
    
    // Test 3: Driver can get ride history
    const ridesRes = await driverClient.get('/api/rides/driver/history');
    log('DRIVER-003', 'PASS', `Driver retrieved ${ridesRes.data.length || ridesRes.data.rides?.length || 0} rides`, null);
    
    // Test 4: Get available rides
    const availableRes = await driverClient.get('/api/rides/available', {
      params: { lat: 10.7946, lng: 106.7218 },
    });
    log('DRIVER-004', 'PASS', `Driver retrieved available rides`, { count: availableRes.data.length || 0 });
    
  } catch (error: any) {
    log('DRIVER-ERROR', 'FAIL', `Driver management tests failed: ${error.message}`, { error: error.response?.data });
  }
}

async function testRideLifecycle() {
  console.log('\n🚕 ===== RIDE LIFECYCLE =====\n');
  
  const customerClient = axios.create({
    baseURL: API_BASE_URL,
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  
  const driverClient = axios.create({
    baseURL: API_BASE_URL,
    headers: { Authorization: `Bearer ${driverToken}` },
  });
  
  try {
    // Test 1: Customer creates a booking
    const bookingRes = await customerClient.post('/api/bookings', {
      pickupAddress: 'Sân bay Tân Sơn Nhất',
      pickupLat: 10.8186,
      pickupLng: 106.6517,
      dropoffAddress: 'Landmark 81',
      dropoffLat: 10.7946,
      dropoffLng: 106.7218,
      vehicleType: 'ECONOMY',
      paymentMethod: 'CASH',
    });
    
    const bookingId = bookingRes.data.data?.booking?.id || bookingRes.data.id;
    log('RIDE-001', 'PASS', 'Customer created booking', { bookingId, status: bookingRes.data.data?.booking?.status || bookingRes.data.status });
    
    // Test 2: Get estimated fare
    const pricingRes = await customerClient.post('/api/pricing/estimate', {
      pickupLat: 10.8186,
      pickupLng: 106.6517,
      dropoffLat: 10.7946,
      dropoffLng: 106.7218,
      vehicleType: 'ECONOMY',
    });
    log('RIDE-002', 'PASS', 'Got pricing estimate', {
      estimatedFare: pricingRes.data.data?.fare || pricingRes.data.estimatedFare,
      distance: pricingRes.data.data?.distance || pricingRes.data.distance,
    });
    
    // Test 3: Confirm booking
    const confirmRes = await customerClient.post(`/api/bookings/${bookingId}/confirm`);
    log('RIDE-003', 'PASS', 'Booking confirmed', { status: confirmRes.data.data?.booking?.status || confirmRes.data.status });
    
    // Test 4: Customer gets ride history
    const historyRes = await customerClient.get('/api/rides/customer/history');
    log('RIDE-004', 'PASS', `Customer retrieved ride history`, {
      count: historyRes.data.length || historyRes.data.rides?.length || 0,
    });
    
    // Test 5: Customer cannot accept rides (permission check)
    try {
      await customerClient.post('/api/rides/some-ride-id/accept');
      log('RIDE-005', 'FAIL', 'Customer should not be able to accept rides', null);
    } catch (err: any) {
      if (err.response?.status === 403 || err.response?.status === 404) {
        log('RIDE-005', 'PASS', 'Correctly blocked customer from accepting rides', null);
      } else {
        log('RIDE-005', 'FAIL', `Unexpected error: ${err.message}`, null);
      }
    }
    
  } catch (error: any) {
    log('RIDE-ERROR', 'FAIL', `Ride lifecycle tests failed: ${error.message}`, {
      error: error.response?.data,
      status: error.response?.status,
    });
  }
}

async function testPaymentFlow() {
  console.log('\n💳 ===== PAYMENT PROCESSING =====\n');
  
  const customerClient = axios.create({
    baseURL: API_BASE_URL,
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  
  try {
    // Test 1: Get payment history
    const paymentsRes = await customerClient.get('/api/payments/customer/history');
    log('PAYMENT-001', 'PASS', `Retrieved payment history`, {
      count: paymentsRes.data.length || paymentsRes.data.payments?.length || 0,
    });
    
    // Test 2: Check payment methods
    const methodsRes = await customerClient.get('/api/payments/methods');
    log('PAYMENT-002', 'PASS', 'Retrieved available payment methods', {
      methods: methodsRes.data.methods || methodsRes.data,
    });
    
  } catch (error: any) {
    log('PAYMENT-ERROR', 'FAIL', `Payment tests failed: ${error.message}`, {
      error: error.response?.data,
    });
  }
}

async function testAdminFunctions() {
  console.log('\n👨‍💼 ===== ADMIN FUNCTIONS =====\n');
  
  const adminClient = axios.create({
    baseURL: API_BASE_URL,
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  
  try {
    // Test 1: Get all rides
    const ridesRes = await adminClient.get('/api/admin/rides');
    log('ADMIN-001', 'PASS', `Admin retrieved all rides`, {
      count: ridesRes.data.length || ridesRes.data.rides?.length || 0,
    });
    
    // Test 2: Get statistics
    const statsRes = await adminClient.get('/api/admin/statistics');
    log('ADMIN-002', 'PASS', 'Admin retrieved statistics', { stats: statsRes.data });
    
    // Test 3: Get all drivers
    const driversRes = await adminClient.get('/api/admin/drivers');
    log('ADMIN-003', 'PASS', `Admin retrieved all drivers`, {
      count: driversRes.data.length || driversRes.data.drivers?.length || 0,
    });
    
    // Test 4: Approve/reject driver
    const pendingDriversRes = await adminClient.get('/api/admin/drivers?status=PENDING');
    const pendingDrivers = pendingDriversRes.data.drivers || pendingDriversRes.data || [];
    
    if (pendingDrivers.length > 0) {
      const pendingDriver = pendingDrivers[0];
      const approveRes = await adminClient.patch(`/api/admin/drivers/${pendingDriver.id}/status`, {
        status: 'APPROVED',
      });
      log('ADMIN-004', 'PASS', 'Admin approved driver', { driverId: pendingDriver.id });
    } else {
      log('ADMIN-004', 'SKIP', 'No pending drivers to approve', null);
    }
    
  } catch (error: any) {
    log('ADMIN-ERROR', 'FAIL', `Admin tests failed: ${error.message}`, {
      error: error.response?.data,
      status: error.response?.status,
    });
  }
}

async function testServiceHealth() {
  console.log('\n🏥 ===== SERVICE HEALTH CHECKS =====\n');
  
  const services = [
    { name: 'API Gateway', url: `${API_BASE_URL}/health` },
    { name: 'Auth Service', url: `http://localhost:3001/health` },
    { name: 'User Service', url: `http://localhost:3007/health` },
    { name: 'Driver Service', url: `http://localhost:3003/health` },
    { name: 'Booking Service', url: `http://localhost:3008/health` },
    { name: 'Ride Service', url: `http://localhost:3002/health` },
    { name: 'Payment Service', url: `http://localhost:3004/health` },
    { name: 'Pricing Service', url: `http://localhost:3009/health` },
    { name: 'Notification Service', url: `http://localhost:3005/health` },
    { name: 'Review Service', url: `http://localhost:3010/health` },
  ];
  
  for (const service of services) {
    try {
      const res = await axios.get(service.url, { timeout: 5000 });
      if (res.status === 200) {
        log(`HEALTH-${service.name}`, 'PASS', `${service.name} is healthy`, null);
      } else {
        log(`HEALTH-${service.name}`, 'FAIL', `${service.name} returned status ${res.status}`, null);
      }
    } catch (error: any) {
      log(`HEALTH-${service.name}`, 'FAIL', `${service.name} is unreachable`, {
        error: error.message,
      });
    }
  }
}

// ============================================
// MAIN TEST EXECUTION
// ============================================

async function main() {
  console.log('\n🧪 ========================================');
  console.log('🧪 BACKEND BUSINESS LOGIC TESTING');
  console.log('🧪 ========================================\n');
  
  console.log(`API Base URL: ${API_BASE_URL}\n`);
  
  // Wait for services to be ready
  console.log('⏳ Waiting for services to be ready...\n');
  await new Promise((resolve) => setTimeout(resolve, 2000));
  
  // Run all test suites
  await testServiceHealth();
  await testAuthenticationFlow();
  await testUserManagement();
  await testDriverManagement();
  await testRideLifecycle();
  await testPaymentFlow();
  await testAdminFunctions();
  
  // Print summary
  console.log('\n📊 ========================================');
  console.log('📊 TEST SUMMARY');
  console.log('📊 ========================================\n');
  
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;
  const total = results.length;
  
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`Success Rate: ${((passed / (total - skipped)) * 100).toFixed(1)}%\n`);
  
  if (failed > 0) {
    console.log('Failed tests:');
    results
      .filter((r) => r.status === 'FAIL')
      .forEach((r) => {
        console.log(`  ❌ ${r.test}: ${r.message}`);
      });
  }
  
  console.log('\n========================================\n');
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
