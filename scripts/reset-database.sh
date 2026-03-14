#!/bin/bash
# ============================================
#  Cab Booking System - Database Reset Script
#  Resets all PostgreSQL + MongoDB databases
# ============================================

set -e

echo "============================================"
echo " Cab Booking System - Database Reset"
echo "============================================"
echo ""

POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5433}
POSTGRES_USER=${POSTGRES_USER:-postgres}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres123}
MONGO_HOST=${MONGO_HOST:-localhost}
MONGO_PORT=${MONGO_PORT:-27017}
MONGO_USER=${MONGO_USER:-admin}
MONGO_PASSWORD=${MONGO_PASSWORD:-admin123}

export PGPASSWORD=$POSTGRES_PASSWORD

echo "[1/4] Dropping and recreating PostgreSQL databases..."
echo ""

for db in auth_db booking_db driver_db payment_db ride_db user_db; do
    echo "  Dropping $db..."
    psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -c "DROP DATABASE IF EXISTS $db;" 2>/dev/null || true
    echo "  Creating $db..."
    psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -c "CREATE DATABASE $db;" 2>/dev/null || true
done

echo ""
echo "[2/4] Dropping MongoDB databases..."
echo ""

mongosh --host $MONGO_HOST --port $MONGO_PORT -u $MONGO_USER -p $MONGO_PASSWORD --authenticationDatabase admin --eval "
  db.getSiblingDB('notification_db').dropDatabase();
  db.getSiblingDB('review_db').dropDatabase();
  print('MongoDB databases dropped');
" 2>/dev/null || echo "  MongoDB drop skipped (not available)"

echo ""
echo "[3/4] Running Prisma migrations..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

for service in auth-service booking-service driver-service payment-service ride-service user-service; do
    echo "  Migrating $service..."
    cd "$PROJECT_DIR/services/$service"
    npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss 2>/dev/null || echo "  Warning: $service migration skipped"
done

cd "$PROJECT_DIR"

echo ""
echo "[4/4] Seeding database..."
echo ""

npx tsx scripts/seed-database.ts

echo ""
echo "============================================"
echo " Database reset complete!"
echo "============================================"
