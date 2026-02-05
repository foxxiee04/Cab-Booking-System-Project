#!/bin/bash
# Script to automatically sync all Prisma schemas to PostgreSQL databases

set -e  # Exit on error

echo "🔄 Starting schema synchronization for all services..."

# Array of services that use Prisma (PostgreSQL)
PRISMA_SERVICES=(
  "auth-service"
  "user-service"
  "driver-service"
  "booking-service"
  "ride-service"
  "payment-service"
)

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to sync a single service
sync_service() {
  local service=$1
  echo ""
  echo "📦 Syncing schema for: $service"
  
  if docker compose exec -T "$service" npx prisma db push --skip-generate 2>&1; then
    echo -e "${GREEN}✅ $service schema synchronized successfully${NC}"
    return 0
  else
    echo -e "${RED}❌ Failed to sync $service schema${NC}"
    return 1
  fi
}

# Counter for success/failure
SUCCESS_COUNT=0
FAILED_COUNT=0
FAILED_SERVICES=()

# Sync each service
for service in "${PRISMA_SERVICES[@]}"; do
  if sync_service "$service"; then
    ((SUCCESS_COUNT++))
  else
    ((FAILED_COUNT++))
    FAILED_SERVICES+=("$service")
  fi
done

echo ""
echo "======================================"
echo "📊 Schema Synchronization Summary"
echo "======================================"
echo -e "${GREEN}✅ Successful: $SUCCESS_COUNT${NC}"
echo -e "${RED}❌ Failed: $FAILED_COUNT${NC}"

if [ $FAILED_COUNT -gt 0 ]; then
  echo ""
  echo -e "${YELLOW}Failed services:${NC}"
  for service in "${FAILED_SERVICES[@]}"; do
    echo "  - $service"
  done
  exit 1
fi

echo ""
echo "🎉 All schemas synchronized successfully!"
echo ""
echo "Verifying databases..."

# Verify PostgreSQL databases
echo ""
echo "📊 PostgreSQL Database Tables:"
for db in auth_db user_db driver_db booking_db ride_db payment_db; do
  echo -n "  $db: "
  COUNT=$(docker compose exec -T postgres psql -U postgres -d "$db" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' \n')
  if [ "$COUNT" -gt 0 ]; then
    echo -e "${GREEN}$COUNT tables${NC}"
  else
    echo -e "${YELLOW}0 tables${NC}"
  fi
done

echo ""
echo "✨ Schema synchronization complete!"
