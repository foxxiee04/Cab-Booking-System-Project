/**
 * WebSocket Real-time Updates Test
 * Tests Socket.io connections for customers and drivers
 */

import io, { Socket } from 'socket.io-client';
import axios from 'axios';

const API_BASE = 'http://localhost:3000';

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

interface TestResult {
  testId: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function addResult(testId: string, passed: boolean, message: string, details?: any) {
  results.push({ testId, passed, message, details });
  const icon = passed ? '✅' : '❌';
  const color = passed ? 'green' : 'red';
  log(`${icon} ${testId}: ${message}`, color);
  if (details) {
    console.log(`   Details:`, JSON.stringify(details, null, 2));
  }
}

async function loginCustomer(): Promise<string> {
  const response = await axios.post(`${API_BASE}/api/auth/login`, {
    email: 'customer1@gmail.com',
    password: 'Customer@123',
  });
  return response.data.data.tokens.accessToken;
}

async function loginDriver(): Promise<string> {
  const response = await axios.post(`${API_BASE}/api/auth/login`, {
    email: 'driver1@cabsystem.vn',
    password: 'Driver@123',
  });
  return response.data.data.tokens.accessToken;
}

function createSocketClient(token: string): Socket {
  return io(API_BASE, {
    auth: { token },
    transports: ['websocket'],
  });
}

async function testCustomerConnection(): Promise<Socket | null> {
  try {
    const token = await loginCustomer();
    const socket = createSocketClient(token);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.disconnect();
        reject(new Error('Connection timeout'));
      }, 5000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        addResult('WS-001', true, 'Customer connected to WebSocket', {
          socketId: socket.id,
          connected: socket.connected,
        });
        resolve(socket);
      });

      socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        addResult('WS-001', false, `Customer connection failed: ${error.message}`);
        reject(error);
      });
    });
  } catch (error: any) {
    addResult('WS-001', false, `Customer connection error: ${error.message}`);
    return null;
  }
}

async function testDriverConnection(): Promise<Socket | null> {
  try {
    const token = await loginDriver();
    const socket = createSocketClient(token);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.disconnect();
        reject(new Error('Connection timeout'));
      }, 5000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        addResult('WS-002', true, 'Driver connected to WebSocket', {
          socketId: socket.id,
          connected: socket.connected,
        });
        resolve(socket);
      });

      socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        addResult('WS-002', false, `Driver connection failed: ${error.message}`);
        reject(error);
      });
    });
  } catch (error: any) {
    addResult('WS-002', false, `Driver connection error: ${error.message}`);
    return null;
  }
}

async function testPingPong(socket: Socket, testId: string, role: string): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      addResult(testId, false, `${role} ping-pong timeout`);
      resolve();
    }, 3000);

    socket.once('pong', () => {
      clearTimeout(timeout);
      addResult(testId, true, `${role} ping-pong successful`);
      resolve();
    });

    socket.emit('ping');
  });
}

async function testRideNotifications(
  customerSocket: Socket,
  driverSocket: Socket
): Promise<void> {
  log('\n🔔 Testing ride notification events...', 'cyan');

  // Setup listeners
  let customerReceivedNew = false;
  let driverReceivedNew = false;
  let statusUpdateReceived = false;

  driverSocket.on('NEW_RIDE_AVAILABLE', (data) => {
    driverReceivedNew = true;
    addResult('WS-005', true, 'Driver received NEW_RIDE_AVAILABLE event', data);
  });

  customerSocket.on('RIDE_STATUS_UPDATE', (data) => {
    statusUpdateReceived = true;
    addResult('WS-006', true, 'Customer received RIDE_STATUS_UPDATE event', data);
  });

  driverSocket.on('RIDE_STATUS_UPDATE', (data) => {
    addResult('WS-007', true, 'Driver received RIDE_STATUS_UPDATE event', data);
  });

  // Create a booking to trigger events
  try {
    const customerToken = await loginCustomer();
    const response = await axios.post(
      `${API_BASE}/api/bookings`,
      {
        pickupLocation: {
          address: 'Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội',
          geoPoint: { lat: 21.0055, lng: 105.8428 }
        },
        dropoffLocation: {
          address: 'Số 100 Nguyễn Văn Cừ, Long Biên, Hà Nội',
          geoPoint: { lat: 21.0355, lng: 105.8588 }
        },
        vehicleType: 'ECONOMY',
        paymentMethod: 'CASH',
      },
      {
        headers: { Authorization: `Bearer ${customerToken}` },
      }
    );

    log(`   Booking created: ${response.data.data.booking.id}`, 'blue');

    // Wait for events
    await new Promise((resolve) => setTimeout(resolve, 3000));

    if (!driverReceivedNew) {
      addResult('WS-005', false, 'Driver did not receive NEW_RIDE_AVAILABLE event', {
        note: 'Driver may be too far from pickup location or not ONLINE',
      });
    }
  } catch (error: any) {
    const errorMsg = error.response?.data 
      ? JSON.stringify(error.response.data)
      : error.message;
    addResult('WS-NOTIFY', false, `Failed to create test booking: ${errorMsg}`);
  }
}

async function runTests() {
  log('\n🧪 ========================================', 'cyan');
  log('🧪 WEBSOCKET REAL-TIME UPDATES TEST', 'cyan');
  log('🧪 ========================================\n', 'cyan');

  log(`API Base URL: ${API_BASE}\n`);

  log('⏳ Connecting to WebSocket server...\n', 'yellow');

  // Test 1: Customer connection
  const customerSocket = await testCustomerConnection();
  if (!customerSocket) {
    log('\n❌ Customer connection failed, aborting tests', 'red');
    process.exit(1);
  }

  // Test 2: Driver connection
  const driverSocket = await testDriverConnection();
  if (!driverSocket) {
    log('\n❌ Driver connection failed, aborting tests', 'red');
    customerSocket.disconnect();
    process.exit(1);
  }

  // Test 3: Customer ping-pong
  await testPingPong(customerSocket, 'WS-003', 'Customer');

  // Test 4: Driver ping-pong
  await testPingPong(driverSocket, 'WS-004', 'Driver');

  // Test 5-7: Ride notifications
  await testRideNotifications(customerSocket, driverSocket);

  // Cleanup
  await new Promise((resolve) => setTimeout(resolve, 2000));
  customerSocket.disconnect();
  driverSocket.disconnect();

  // Print summary
  log('\n📊 ========================================', 'cyan');
  log('📊 TEST SUMMARY', 'cyan');
  log('📊 ========================================\n', 'cyan');

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  const successRate = ((passed / total) * 100).toFixed(1);

  log(`Total Tests: ${total}`, 'cyan');
  log(`✅ Passed: ${passed}`, 'green');
  log(`❌ Failed: ${failed}`, failed > 0 ? 'red' : 'green');
  log(`Success Rate: ${successRate}%`, failed > 0 ? 'yellow' : 'green');

  log('\n========================================\n', 'cyan');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  log(`\n❌ Test suite failed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
