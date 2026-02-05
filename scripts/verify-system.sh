#!/bin/bash

# System verification and health check script
# This script verifies that all components of the Cab Booking System are properly configured

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

# Functions
check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✅${NC} File exists: $1"
    ((CHECKS_PASSED++))
    return 0
  else
    echo -e "${RED}❌${NC} File missing: $1"
    ((CHECKS_FAILED++))
    return 1
  fi
}

check_directory() {
  if [ -d "$1" ]; then
    echo -e "${GREEN}✅${NC} Directory exists: $1"
    ((CHECKS_PASSED++))
    return 0
  else
    echo -e "${RED}❌${NC} Directory missing: $1"
    ((CHECKS_FAILED++))
    return 1
  fi
}

check_content() {
  if grep -q "$2" "$1" 2>/dev/null; then
    echo -e "${GREEN}✅${NC} Found '$2' in $1"
    ((CHECKS_PASSED++))
    return 0
  else
    echo -e "${RED}❌${NC} Missing '$2' in $1"
    ((CHECKS_FAILED++))
    return 1
  fi
}

check_docker_compose() {
  if docker compose config > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC} docker-compose.yml is valid"
    ((CHECKS_PASSED++))
    return 0
  else
    echo -e "${RED}❌${NC} docker-compose.yml is invalid"
    ((CHECKS_FAILED++))
    return 1
  fi
}

check_service() {
  if [ -d "services/$1" ]; then
    local checks=0
    [ -f "services/$1/package.json" ] && ((checks++))
    [ -f "services/$1/Dockerfile" ] && ((checks++))
    [ -f "services/$1/tsconfig.json" ] && ((checks++))
    
    if [ $checks -eq 3 ]; then
      echo -e "${GREEN}✅${NC} Service complete: $1"
      ((CHECKS_PASSED++))
      return 0
    else
      echo -e "${YELLOW}⚠️ ${NC} Service incomplete: $1 ($checks/3 files)"
      ((CHECKS_WARNING++))
      return 0
    fi
  else
    echo -e "${RED}❌${NC} Service missing: $1"
    ((CHECKS_FAILED++))
    return 1
  fi
}

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Cab Booking System - Configuration Verification${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# 1. Root Configuration Files
echo -e "${YELLOW}[1] Root Configuration Files${NC}"
check_file "package.json"
check_file ".env.example"
check_file "docker-compose.yml"
check_file "docker-compose.prod.yml"
check_file "docker-stack.yml"
check_file "tsconfig.base.json"
check_file "README.md"
echo ""

# 2. Environment Configuration
echo -e "${YELLOW}[2] Environment Configuration${NC}"
check_file ".env"
check_directory "env"
check_file "env/gateway.env"
check_file "env/auth.env"
check_file "env/user.env"
check_file "env/driver.env"
check_file "env/booking.env"
check_file "env/ride.env"
check_file "env/payment.env"
check_file "env/pricing.env"
check_file "env/notification.env"
check_file "env/review.env"
echo ""

# 3. Database Scripts
echo -e "${YELLOW}[3] Database Scripts${NC}"
check_file "scripts/init-db.sql"
check_file "scripts/seed-data-fixed.sql"
check_file "scripts/rebuild-system.sh"
check_file "scripts/rebuild-system.bat"
check_file "scripts/clear-db.sh"
check_file "scripts/DATABASE_RESET.md"
echo ""

# 4. Shared Utilities
echo -e "${YELLOW}[4] Shared Utilities${NC}"
check_directory "shared"
check_file "shared/package.json"
check_file "shared/tsconfig.json"
check_directory "shared/types"
check_directory "shared/utils"
echo ""

# 5. Core Microservices
echo -e "${YELLOW}[5] Microservices${NC}"
check_service "api-gateway"
check_service "auth-service"
check_service "user-service"
check_service "driver-service"
check_service "booking-service"
check_service "ride-service"
check_service "payment-service"
check_service "pricing-service"
check_service "notification-service"
check_service "review-service"
echo ""

# 6. Prisma Schemas
echo -e "${YELLOW}[6] Prisma Database Schemas${NC}"
check_file "services/auth-service/prisma/schema.prisma"
check_file "services/user-service/prisma/schema.prisma"
check_file "services/driver-service/prisma/schema.prisma"
check_file "services/booking-service/prisma/schema.prisma"
check_file "services/ride-service/prisma/schema.prisma"
check_file "services/payment-service/prisma/schema.prisma"
echo ""

# 7. Docker Configuration Validation
echo -e "${YELLOW}[7] Docker Compose Files${NC}"
check_docker_compose
check_content "docker-compose.yml" "postgres:" && true
check_content "docker-compose.yml" "mongodb:" && true
check_content "docker-compose.yml" "redis:" && true
check_content "docker-compose.yml" "rabbitmq:" && true
check_content "docker-compose.yml" "api-gateway" && true
check_content "docker-compose.yml" "auth-service" && true
check_content "docker-compose.yml" "user-service" && true
echo ""

# 8. Database Initialization
echo -e "${YELLOW}[8] Database Initialization${NC}"
check_content "scripts/init-db.sql" "CREATE DATABASE auth_db"
check_content "scripts/init-db.sql" "CREATE DATABASE user_db"
check_content "scripts/init-db.sql" "CREATE DATABASE driver_db"
check_content "scripts/init-db.sql" "CREATE DATABASE booking_db"
check_content "scripts/init-db.sql" "CREATE DATABASE ride_db"
check_content "scripts/init-db.sql" "CREATE DATABASE payment_db"
echo ""

# 9. Seed Data
echo -e "${YELLOW}[9] Seed Data${NC}"
check_content "scripts/seed-data-fixed.sql" "admin@cab.com"
check_content "scripts/seed-data-fixed.sql" "customer1@test.com"
check_content "scripts/seed-data-fixed.sql" "driver1@test.com"
check_content "scripts/seed-data-fixed.sql" "auth_db"
check_content "scripts/seed-data-fixed.sql" "user_db"
check_content "scripts/seed-data-fixed.sql" "driver_db"
echo ""

# 10. Documentation
echo -e "${YELLOW}[10] Documentation${NC}"
check_file "IMPLEMENTATION_SUMMARY.md"
check_file "REBUILD_STATUS.md"
check_file "scripts/DATABASE_RESET.md"
echo ""

# 11. API Gateway Configuration
echo -e "${YELLOW}[11] API Gateway Configuration${NC}"
check_file "services/api-gateway/src/config/index.ts"
check_file "services/api-gateway/src/routes/proxy.ts"
check_content "services/api-gateway/src/config/index.ts" "auth-service" && true
check_content "services/api-gateway/src/config/index.ts" "user-service" && true
check_content "services/api-gateway/src/config/index.ts" "review-service" && true
echo ""

# Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                        SUMMARY${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}Passed:${NC}   $CHECKS_PASSED"
echo -e "${YELLOW}Warning:${NC}  $CHECKS_WARNING"
echo -e "${RED}Failed:${NC}   $CHECKS_FAILED"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ System configuration is COMPLETE and READY${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Ensure .env file has correct credentials"
  echo "  2. Run: ./scripts/rebuild-system.sh (or .bat on Windows)"
  echo "  3. Wait for all services to start"
  echo "  4. Test: curl http://localhost:3000/health"
  echo ""
  exit 0
else
  echo -e "${RED}❌ System configuration has ERRORS${NC}"
  echo ""
  echo "Please fix the above errors before proceeding."
  echo "See IMPLEMENTATION_SUMMARY.md for details."
  echo ""
  exit 1
fi
