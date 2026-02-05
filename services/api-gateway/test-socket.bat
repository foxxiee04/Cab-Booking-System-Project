@echo off
REM Socket.io Test Client for Windows
REM Quick test script to verify Socket.io functionality

echo.
echo 🔌 Socket.io Connection Test
echo ==============================
echo.

REM Check if node is available
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed
    exit /b 1
)

REM Check if JWT_SECRET is set
if "%JWT_SECRET%"=="" (
    echo ⚠️  JWT_SECRET not set, using default 'dev-secret'
    set JWT_SECRET=dev-secret
)

echo 📝 Generating test JWT token...

REM Create test client
(
echo const io = require^('socket.io-client'^);
echo const jwt = require^('jsonwebtoken'^);
echo.
echo const JWT_SECRET = process.env.JWT_SECRET ^|^| 'dev-secret';
echo const GATEWAY_URL = process.env.GATEWAY_URL ^|^| 'http://localhost:3000';
echo.
echo // Generate JWT token for a test driver
echo const token = jwt.sign^(
echo   { 
echo     userId: 'driver-test-001',
echo     role: 'DRIVER',
echo     email: 'driver@test.com'
echo   },
echo   JWT_SECRET,
echo   { expiresIn: '1h' }
echo ^);
echo.
echo console.log^('\n🎫 JWT Token:', token.substring^(0, 50^) + '...\\n'^);
echo.
echo // Connect to Socket.io
echo console.log^('🔌 Connecting to', GATEWAY_URL, '...\\n'^);
echo.
echo const socket = io^(GATEWAY_URL, {
echo   auth: { token },
echo   transports: ['websocket', 'polling']
echo }^);
echo.
echo socket.on^('connect', ^(^) =^> {
echo   console.log^('✅ Connected to server!'^);
echo   console.log^('   Socket ID:', socket.id^);
echo   console.log^('   User: driver-test-001'^);
echo   console.log^('   Room: driver:driver-test-001\\n'^);
echo   
echo   // Test ping
echo   console.log^('📡 Sending ping...'^);
echo   socket.emit^('ping'^);
echo }^);
echo.
echo socket.on^('pong', ^(^) =^> {
echo   console.log^('✅ Pong received! Connection is healthy.\\n'^);
echo   console.log^('🎉 Socket.io is working correctly!\\n'^);
echo   console.log^('Listening for events...'^);
echo }^);
echo.
echo socket.on^('NEW_RIDE_AVAILABLE', ^(booking^) =^> {
echo   console.log^('\\n🚗 NEW RIDE AVAILABLE:'^);
echo   console.log^('   Booking ID:', booking.bookingId^);
echo   console.log^('   Pickup:', booking.pickup.address^);
echo   console.log^('   Dropoff:', booking.dropoff.address^);
echo   console.log^('   Fare:', booking.estimatedFare^);
echo   console.log^('   Distance:', booking.estimatedDistance, 'km\\n'^);
echo }^);
echo.
echo socket.on^('RIDE_STATUS_UPDATE', ^(update^) =^> {
echo   console.log^('\\n📊 RIDE STATUS UPDATE:'^);
echo   console.log^('   Ride ID:', update.rideId^);
echo   console.log^('   Status:', update.status^);
echo   console.log^('   Message:', update.message, '\\n'^);
echo }^);
echo.
echo socket.on^('RIDE_COMPLETED', ^(completion^) =^> {
echo   console.log^('\\n🏁 RIDE COMPLETED:'^);
echo   console.log^('   Ride ID:', completion.rideId^);
echo   console.log^('   Fare:', completion.fare^);
echo   console.log^('   Distance:', completion.distance, 'km'^);
echo   console.log^('   Duration:', completion.duration, 'min\\n'^);
echo }^);
echo.
echo socket.on^('connect_error', ^(error^) =^> {
echo   console.error^('\\n❌ Connection Error:', error.message^);
echo   if ^(error.message.includes^('Authentication'^)^) {
echo     console.error^('   → Check JWT_SECRET matches server'^);
echo   }
echo   process.exit^(1^);
echo }^);
echo.
echo socket.on^('disconnect', ^(reason^) =^> {
echo   console.log^('\\n⚠️  Disconnected:', reason^);
echo   if ^(reason === 'io server disconnect'^) {
echo     console.log^('   → Server forcefully disconnected'^);
echo   }
echo }^);
echo.
echo // Keep running
echo process.on^('SIGINT', ^(^) =^> {
echo   console.log^('\\n\\n👋 Disconnecting...'^);
echo   socket.disconnect^(^);
echo   process.exit^(0^);
echo }^);
echo.
echo console.log^('Press Ctrl+C to exit\\n'^);
) > test-socket-client.js

REM Run the test client
echo 🚀 Starting test client...
node test-socket-client.js

REM Cleanup
del test-socket-client.js

exit /b 0
