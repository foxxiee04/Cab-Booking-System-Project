@echo off
setlocal EnableDelayedExpansion
REM ============================================
REM  Cab Booking System - Database Reset Script
REM  Resets all PostgreSQL + MongoDB databases
REM ============================================

echo ============================================
echo  Cab Booking System - Database Reset
echo ============================================
echo.

if not defined POSTGRES_HOST set POSTGRES_HOST=localhost
if not defined POSTGRES_PORT set POSTGRES_PORT=5433
if not defined POSTGRES_USER set POSTGRES_USER=postgres
if not defined POSTGRES_PASSWORD set POSTGRES_PASSWORD=postgres
set PGPASSWORD=%POSTGRES_PASSWORD%
if not defined MONGO_HOST set MONGO_HOST=localhost
if not defined MONGO_PORT set MONGO_PORT=27017
if not defined MONGO_USER set MONGO_USER=mongo
if not defined MONGO_PASSWORD set MONGO_PASSWORD=mongo

echo [1/4] Dropping and recreating PostgreSQL databases...
echo.

for %%d in (auth_db booking_db driver_db payment_db ride_db user_db) do (
    echo   Dropping %%d...
    psql -h %POSTGRES_HOST% -p %POSTGRES_PORT% -U %POSTGRES_USER% -d postgres -c "DROP DATABASE IF EXISTS %%d WITH (FORCE);"
    if errorlevel 1 exit /b 1
    echo   Creating %%d...
    psql -h %POSTGRES_HOST% -p %POSTGRES_PORT% -U %POSTGRES_USER% -d postgres -c "CREATE DATABASE %%d;"
    if errorlevel 1 exit /b 1
)

echo.
echo [2/4] Dropping MongoDB databases...
echo.

mongosh --host %MONGO_HOST% --port %MONGO_PORT% -u %MONGO_USER% -p %MONGO_PASSWORD% --authenticationDatabase admin --eval "db.getSiblingDB('notification_db').dropDatabase(); db.getSiblingDB('review_db').dropDatabase(); print('MongoDB databases dropped');"
if errorlevel 1 exit /b 1

echo.
echo [3/4] Running Prisma migrations...
echo.

cd /d "%~dp0.."

for %%s in (auth-service booking-service driver-service payment-service ride-service user-service) do (
    echo   Migrating %%s...
    set DB_NAME=
    if "%%s"=="auth-service" set DB_NAME=auth_db
    if "%%s"=="booking-service" set DB_NAME=booking_db
    if "%%s"=="driver-service" set DB_NAME=driver_db
    if "%%s"=="payment-service" set DB_NAME=payment_db
    if "%%s"=="ride-service" set DB_NAME=ride_db
    if "%%s"=="user-service" set DB_NAME=user_db
    cd services\%%s
    set "DATABASE_URL=postgresql://%POSTGRES_USER%:%POSTGRES_PASSWORD%@%POSTGRES_HOST%:%POSTGRES_PORT%/!DB_NAME!?schema=public"
    call npx prisma migrate deploy
    call npx prisma db push --accept-data-loss
    if errorlevel 1 exit /b 1
    call npx prisma generate
    if errorlevel 1 exit /b 1
    cd ..\..
)

echo.
echo [4/4] Seeding database...
echo.

call npx tsx scripts\seed-database.ts
if errorlevel 1 exit /b 1

echo.
echo ============================================
echo  Database reset complete!
echo ============================================
