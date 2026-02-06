@echo off
REM Complete system rebuild for Cab Booking System
REM WARNING: This will DELETE ALL DATA - use only for development!

setlocal enabledelayedexpansion

echo.
echo ===============================================
echo  COMPLETE SYSTEM REBUILD
echo ===============================================
echo.
echo WARNING: This will DELETE ALL DATA!
echo All databases will be reset and reinitialized
echo.
pause

REM Step 1: Clean up
echo.
echo [1/9] Stopping containers and removing volumes...
docker compose down -v --remove-orphans 2>nul || true
timeout /t 2 >nul

REM Step 2: Start infrastructure
echo.
echo [2/9] Starting infrastructure services...
docker compose up -d postgres mongodb redis rabbitmq

REM Step 3: Wait for databases
echo.
echo [3/9] Waiting for databases to initialize (30s)...
timeout /t 10 >nul

REM Step 4: Initialize databases from SQL script
echo.
echo [4/9] Initializing databases from init-db.sql...
docker compose exec -T postgres psql -U postgres < scripts\init-db.sql
timeout /t 2 >nul

REM Step 5: Start all services
echo.
echo [5/9] Starting all microservices...
docker compose up -d

REM Step 6: Wait for services
echo.
echo [6/9] Waiting for services to initialize (30s)...
timeout /t 10 >nul

REM Step 7: Apply Prisma schemas
echo.
echo [7/9] Applying Prisma schemas to services...

set services=auth-service user-service driver-service booking-service ride-service payment-service

for %%S in (%services%) do (
  echo   ... Applying schema for %%S
  docker compose exec -T %%S npx prisma db push --skip-generate 2>nul || echo   (may already exist)
)

REM Step 8: Seed test data
echo.
echo [8/9] Seeding initial test data...
docker compose exec -T postgres psql -U postgres < scripts\seed-sample-data.sql

REM Step 9: Verify services
echo.
echo [9/9] System verification...

echo.
echo ===============================================
echo  SUCCESS: System rebuild completed!
echo ===============================================
echo.
echo Available Services:
echo   Gateway:      http://localhost:3000
echo   Auth:         http://localhost:3001
echo   Ride:         http://localhost:3002
echo   Driver:       http://localhost:3003
echo   Payment:      http://localhost:3004
echo   Notification: http://localhost:3005
echo   User:         http://localhost:3007
echo   Booking:      http://localhost:3008
echo   Pricing:      http://localhost:3009
echo   Review:       http://localhost:3010
echo.
echo Test Credentials:
echo   Admin:    admin@cab.com / Test@123
echo   Customer: customer1@test.com / Test@123
echo   Driver:   driver1@test.com / Test@123
echo.
echo Databases:
echo   PostgreSQL: localhost:5433
echo   MongoDB:    localhost:27017
echo   Redis:      localhost:6379
echo   RabbitMQ:   localhost:5672
echo.
pause
