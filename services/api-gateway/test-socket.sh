#!/bin/bash

# Socket.io Test Client
# Quick test script to verify Socket.io functionality

echo "🔌 Socket.io Connection Test"
echo "=============================="
echo ""

# Check if node is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

# Check if JWT_SECRET is set
if [ -z "$JWT_SECRET" ]; then
    echo "⚠️  JWT_SECRET not set, using default 'dev-secret'"
    JWT_SECRET="dev-secret"
fi

# Generate a test JWT token
echo "📝 Generating test JWT token..."
cat > test-socket-client.js << 'EOF'
const io = require('socket.io-client');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';

// Generate JWT token for a test driver
const token = jwt.sign(
  { 
    userId: 'driver-test-001',
    role: 'DRIVER',
    email: 'driver@test.com'
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('\n🎫 JWT Token:', token.substring(0, 50) + '...\n');

// Connect to Socket.io
console.log('🔌 Connecting to', GATEWAY_URL, '...\n');

const socket = io(GATEWAY_URL, {
  auth: { token },
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('✅ Connected to server!');
  console.log('   Socket ID:', socket.id);
  console.log('   User: driver-test-001');
  console.log('   Room: driver:driver-test-001\n');
  
  // Test ping
  console.log('📡 Sending ping...');
  socket.emit('ping');
});

socket.on('pong', () => {
  console.log('✅ Pong received! Connection is healthy.\n');
  console.log('🎉 Socket.io is working correctly!\n');
  console.log('Listening for events...');
});

socket.on('NEW_RIDE_AVAILABLE', (booking) => {
  console.log('\n🚗 NEW RIDE AVAILABLE:');
  console.log('   Booking ID:', booking.bookingId);
  console.log('   Pickup:', booking.pickup.address);
  console.log('   Dropoff:', booking.dropoff.address);
  console.log('   Fare:', booking.estimatedFare);
  console.log('   Distance:', booking.estimatedDistance, 'km\n');
});

socket.on('RIDE_STATUS_UPDATE', (update) => {
  console.log('\n📊 RIDE STATUS UPDATE:');
  console.log('   Ride ID:', update.rideId);
  console.log('   Status:', update.status);
  console.log('   Message:', update.message, '\n');
});

socket.on('RIDE_COMPLETED', (completion) => {
  console.log('\n🏁 RIDE COMPLETED:');
  console.log('   Ride ID:', completion.rideId);
  console.log('   Fare:', completion.fare);
  console.log('   Distance:', completion.distance, 'km');
  console.log('   Duration:', completion.duration, 'min\n');
});

socket.on('connect_error', (error) => {
  console.error('\n❌ Connection Error:', error.message);
  if (error.message.includes('Authentication')) {
    console.error('   → Check JWT_SECRET matches server');
  }
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log('\n⚠️  Disconnected:', reason);
  if (reason === 'io server disconnect') {
    console.log('   → Server forcefully disconnected');
  }
});

// Keep running
process.on('SIGINT', () => {
  console.log('\n\n👋 Disconnecting...');
  socket.disconnect();
  process.exit(0);
});

console.log('Press Ctrl+C to exit\n');
EOF

# Run the test client
echo "🚀 Starting test client..."
node test-socket-client.js

# Cleanup
rm test-socket-client.js
