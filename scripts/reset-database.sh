#!/bin/bash
# ============================================
# Database Reset Script - Linux/Mac
# Drops all databases and re-runs migrations
# ============================================

set -e

echo "========================================"
echo "DATABASE RESET SCRIPT"
echo "========================================"
echo ""
echo "WARNING: This will delete ALL data!"
echo "Press Ctrl+C to cancel in 5 seconds..."
echo ""
sleep 5

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo ""
echo "[1/7] Resetting Auth Service Database..."
cd services/auth-service
npx prisma migrate reset --force --skip-seed

echo ""
echo "[2/7] Resetting User Service Database..."
cd ../user-service
npx prisma migrate reset --force --skip-seed

echo ""
echo "[3/7] Resetting Driver Service Database..."
cd ../driver-service
npx prisma migrate reset --force --skip-seed

echo ""
echo "[4/7] Resetting Booking Service Database..."
cd ../booking-service
npx prisma migrate reset --force --skip-seed

echo ""
echo "[5/7] Resetting Ride Service Database..."
cd ../ride-service
npx prisma migrate reset --force --skip-seed

echo ""
echo "[6/7] Resetting Payment Service Database..."
cd ../payment-service
npx prisma migrate reset --force --skip-seed

echo ""
echo "[7/7] Clearing MongoDB Collections..."
cd ../..
docker exec -it cab-mongodb mongosh --eval "use notification_db; db.dropDatabase(); use review_db; db.dropDatabase();"

echo ""
echo "========================================"
echo "DATABASE RESET COMPLETE"
echo "========================================"
echo ""
echo "All databases have been reset."
echo "Run ./scripts/seed-database.sh to populate with test data."
echo ""
