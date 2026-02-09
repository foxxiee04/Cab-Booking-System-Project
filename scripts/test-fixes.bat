@echo off
REM Quick Test Script - Verify All Fixes
REM Run: test-fixes.bat

echo ==============================================
echo    Testing All Fixes
echo ==============================================
echo.

echo === Step 1: Restart Backend Services ===
echo Run: docker-compose restart driver-service
pause

echo.
echo === Step 2: Test Customer App ===
echo 1. Open: http://localhost:3002
echo 2. Login: customer1@gmail.com / Customer@123
echo 3. Book ride: TSN Airport to Landmark 81
echo 4. Check: Should have 3 steps (not 4)
echo 5. Check console: No errors?
echo.
set /p customer_ok="Customer app working? (y/n): "

echo.
echo === Step 3: Approve Driver ===
echo Run: npx tsx scripts/approve-drivers.ts
pause

echo.
echo === Step 4: Test Driver App ===
echo 1. Open: http://localhost:3003
echo 2. Login: driver1@cabsystem.vn / Driver@123
echo 3. Click 'Go Online'
echo 4. Check: Should be online (no approval error)
echo 5. Check console: Socket connected?
echo.
set /p driver_ok="Driver app online? (y/n): "

echo.
echo === Step 5: Test End-to-End ===
echo 1. Customer: Book a ride
echo 2. Driver: Should receive notification
echo 3. Check driver console: NEW_RIDE_AVAILABLE event?
echo 4. Check RideRequestModal: No crashes?
echo 5. Modal shows: Customer, Pickup, Dropoff, Fare
echo.
set /p e2e_ok="Ride request working? (y/n): "

echo.
echo === Summary ===
echo Customer App: %customer_ok%
echo Driver App: %driver_ok%
echo End-to-End: %e2e_ok%

if "%customer_ok%"=="y" if "%driver_ok%"=="y" if "%e2e_ok%"=="y" (
    echo.
    echo ========================================
    echo    All tests passed! System working!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo    Some tests failed. Check logs.
    echo ========================================
)

pause
