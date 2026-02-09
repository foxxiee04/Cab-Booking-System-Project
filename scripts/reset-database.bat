@echo off
REM ============================================
REM Database Reset Script - Windows
REM Drops all databases and re-runs migrations
REM ============================================

echo ========================================
echo DATABASE RESET SCRIPT
echo ========================================
echo.
echo WARNING: This will delete ALL data!
echo Press Ctrl+C to cancel
echo.
pause

cd /d "%~dp0.."

echo.
echo [1/7] Resetting Auth Service Database...
cd services\auth-service
call npx prisma migrate reset --force --skip-seed
if %errorlevel% neq 0 (
    echo ERROR: Auth database reset failed
    exit /b 1
)

echo.
echo [2/7] Resetting User Service Database...
cd ..\user-service
call npx prisma migrate reset --force --skip-seed
if %errorlevel% neq 0 (
    echo ERROR: User database reset failed
    exit /b 1
)

echo.
echo [3/7] Resetting Driver Service Database...
cd ..\driver-service
call npx prisma migrate reset --force --skip-seed
if %errorlevel% neq 0 (
    echo ERROR: Driver database reset failed
    exit /b 1
)

echo.
echo [4/7] Resetting Booking Service Database...
cd ..\booking-service
call npx prisma migrate reset --force --skip-seed
if %errorlevel% neq 0 (
    echo ERROR: Booking database reset failed
    exit /b 1
)

echo.
echo [5/7] Resetting Ride Service Database...
cd ..\ride-service
call npx prisma migrate reset --force --skip-seed
if %errorlevel% neq 0 (
    echo ERROR: Ride database reset failed
    exit /b 1
)

echo.
echo [6/7] Resetting Payment Service Database...
cd ..\payment-service
call npx prisma migrate reset --force --skip-seed
if %errorlevel% neq 0 (
    echo ERROR: Payment database reset failed
    exit /b 1
)

echo.
echo [7/7] Clearing MongoDB Collections...
cd ..\..
docker exec -it cab-mongodb mongosh --eval "use notification_db; db.dropDatabase(); use review_db; db.dropDatabase();"

echo.
echo ========================================
echo DATABASE RESET COMPLETE
echo ========================================
echo.
echo All databases have been reset.
echo Run seed-database.bat to populate with test data.
echo.
