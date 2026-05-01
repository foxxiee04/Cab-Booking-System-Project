#!/bin/bash
# ============================================
#  Cab Booking System - Database Reset Script
#  Resets all PostgreSQL + MongoDB databases,
#  re-runs Prisma migrations, then seeds data.
# ============================================

set -e

echo "============================================"
echo " Cab Booking System - Database Reset"
echo "============================================"
echo ""

POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5433}
POSTGRES_USER=${POSTGRES_USER:-postgres}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}
MONGO_HOST=${MONGO_HOST:-localhost}
MONGO_PORT=${MONGO_PORT:-27017}
MONGO_USER=${MONGO_USER:-mongo}
MONGO_PASSWORD=${MONGO_PASSWORD:-mongo}

export PGPASSWORD=$POSTGRES_PASSWORD

echo "[1/4] Dropping and recreating PostgreSQL databases..."
echo ""

for db in auth_db booking_db driver_db payment_db ride_db user_db wallet_db; do
    echo "  Dropping $db..."
    psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d postgres -c "DROP DATABASE IF EXISTS $db WITH (FORCE);" 2>/dev/null || true
    echo "  Creating $db..."
    psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d postgres -c "CREATE DATABASE $db;" 2>/dev/null || true
done

echo ""
echo "[2/4] Dropping MongoDB databases..."
echo ""

mongosh --host $MONGO_HOST --port $MONGO_PORT -u $MONGO_USER -p $MONGO_PASSWORD --authenticationDatabase admin --eval "
  db.getSiblingDB('notification_db').dropDatabase();
  db.getSiblingDB('review_db').dropDatabase();
  print('MongoDB databases dropped');
" 2>/dev/null || echo "  MongoDB drop skipped (not available or already clean)"

echo ""
echo "[3/4] Running Prisma migrations..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

for service in auth-service booking-service driver-service payment-service ride-service user-service wallet-service; do
    echo "  Migrating $service..."
    cd "$PROJECT_DIR/services/$service"
    # Derive DB name from service name
    DB_NAME="${service//-service/_db}"
    DB_NAME="${DB_NAME/driver_db/driver_db}"
    export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${DB_NAME}?schema=public"
    npx prisma db push --accept-data-loss 2>/dev/null \
        || echo "  Warning: $service db push skipped"
    npx prisma generate 2>/dev/null || true
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
