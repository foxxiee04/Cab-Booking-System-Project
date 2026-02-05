@echo off
REM Reset all databases and seed test data (Windows)
REM WARNING: This will DELETE ALL DATA - use only for development!

echo.
echo [33m^^!^^![0m WARNING: This will DELETE ALL DATA and recreate schemas!
echo.
pause

echo.
echo [36m^^=^^= Stopping containers and removing volumes ^^=^^=[0m
docker compose down -v

echo.
echo [36m^^=^^= Starting infrastructure ^^=^^=[0m
docker compose up -d postgres mongodb redis rabbitmq

echo.
echo Waiting for PostgreSQL to be ready...
timeout /t 10 >nul

echo.
echo [36m^^=^^= Applying Prisma schemas ^^=^^=[0m
set DATABASE_URL=postgresql://postgres:postgres@localhost:5433/auth_db
npx prisma db push --schema services/auth-service/prisma/schema.prisma
set DATABASE_URL=postgresql://postgres:postgres@localhost:5433/user_db
npx prisma db push --schema services/user-service/prisma/schema.prisma
set DATABASE_URL=postgresql://postgres:postgres@localhost:5433/driver_db
npx prisma db push --schema services/driver-service/prisma/schema.prisma
set DATABASE_URL=postgresql://postgres:postgres@localhost:5433/booking_db
npx prisma db push --schema services/booking-service/prisma/schema.prisma
set DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ride_db
npx prisma db push --schema services/ride-service/prisma/schema.prisma
set DATABASE_URL=postgresql://postgres:postgres@localhost:5433/payment_db
npx prisma db push --schema services/payment-service/prisma/schema.prisma

echo.
echo [36m^^=^^= Seeding test data ^^=^^=[0m
docker exec -i cab-postgres psql -U postgres < scripts\seed-data-fixed.sql

echo.
echo [32m^^✔^^^ Database reset and seed completed^^![0m
echo.
pause
