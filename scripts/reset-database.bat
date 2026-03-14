@echo off
REM ============================================
REM  Cab Booking System - Database Reset Script
REM  Resets all PostgreSQL + MongoDB databases
REM ============================================

echo ============================================
echo  Cab Booking System - Database Reset
echo ============================================
echo.

set POSTGRES_HOST=localhost
set POSTGRES_PORT=5433
set POSTGRES_USER=postgres
set POSTGRES_PASSWORD=postgres123
set MONGO_HOST=localhost
set MONGO_PORT=27017
set MONGO_USER=admin
set MONGO_PASSWORD=admin123

echo [1/4] Dropping and recreating PostgreSQL databases...
echo.

for %%d in (auth_db booking_db driver_db payment_db ride_db user_db) do (
    echo   Dropping %%d...
    psql -h %POSTGRES_HOST% -p %POSTGRES_PORT% -U %POSTGRES_USER% -c "DROP DATABASE IF EXISTS %%d;" 2>nul
    echo   Creating %%d...
    psql -h %POSTGRES_HOST% -p %POSTGRES_PORT% -U %POSTGRES_USER% -c "CREATE DATABASE %%d;" 2>nul
)

echo.
echo [2/4] Dropping MongoDB databases...
echo.

mongosh --host %MONGO_HOST% --port %MONGO_PORT% -u %MONGO_USER% -p %MONGO_PASSWORD% --authenticationDatabase admin --eval "db.getSiblingDB('notification_db').dropDatabase(); db.getSiblingDB('review_db').dropDatabase(); print('MongoDB databases dropped');" 2>nul

echo.
echo [3/4] Running Prisma migrations...
echo.

cd /d "%~dp0.."

for %%s in (auth-service booking-service driver-service payment-service ride-service user-service) do (
    echo   Migrating %%s...
    cd services\%%s
    call npx prisma migrate deploy 2>nul || call npx prisma db push --accept-data-loss 2>nul
    cd ..\..
)

echo.
echo [4/4] Seeding database...
echo.

call npx tsx scripts\seed-database.ts

echo.
echo ============================================
echo  Database reset complete!
echo ============================================
