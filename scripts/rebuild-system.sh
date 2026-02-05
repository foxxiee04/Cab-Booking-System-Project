#!/bin/bash

# Complete system rebuild for Cab Booking System
# This script will: stop all services, remove volumes, rebuild images, start fresh, apply schemas, and seed data
# WARNING: This will DELETE ALL DATA - use only for development!

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}===============================================${NC}"
echo -e "${YELLOW}🔄 Cab Booking System - Complete Rebuild${NC}"
echo -e "${YELLOW}===============================================${NC}"
echo -e "${RED}⚠️  WARNING: This will DELETE ALL DATA!${NC}"
echo -e "${RED}⚠️  All databases will be reset and reinitialized${NC}"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Step 1: Clean up
echo -e "${BLUE}📦 Step 1: Stopping containers and removing volumes...${NC}"
docker compose down -v --remove-orphans 2>/dev/null || true

sleep 2

# Step 2: Start infrastructure
echo -e "${BLUE}📦 Step 2: Starting infrastructure services...${NC}"
docker compose up -d postgres mongodb redis rabbitmq

# Step 3: Wait for databases
echo -e "${BLUE}⏳ Step 3: Waiting for databases to initialize (30s)...${NC}"
sleep 5

# Verify PostgreSQL
echo -e "${BLUE}🔍 Verifying PostgreSQL readiness...${NC}"
for i in {1..12}; do
  if docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
    break
  fi
  if [ $i -eq 12 ]; then
    echo -e "${RED}❌ PostgreSQL did not start${NC}"
    exit 1
  fi
  sleep 5
done

# Verify MongoDB
echo -e "${BLUE}🔍 Verifying MongoDB readiness...${NC}"
for i in {1..12}; do
  if docker compose exec -T mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ MongoDB is ready${NC}"
    break
  fi
  if [ $i -eq 12 ]; then
    echo -e "${RED}❌ MongoDB did not start${NC}"
    exit 1
  fi
  sleep 5
done

# Step 4: Initialize databases from SQL script
echo -e "${BLUE}🌱 Step 4: Initializing databases from init-db.sql...${NC}"
docker compose exec -T postgres psql -U postgres < scripts/init-db.sql

sleep 2

# Step 5: Start all services
echo -e "${BLUE}📦 Step 5: Starting all microservices...${NC}"
docker compose up -d

# Step 6: Wait for services
echo -e "${BLUE}⏳ Step 6: Waiting for all services to initialize (30s)...${NC}"
sleep 10

# Step 7: Apply Prisma schemas
echo -e "${BLUE}📐 Step 7: Applying Prisma schemas to services...${NC}"

declare -a services=(
  "auth-service"
  "user-service"
  "driver-service"
  "booking-service"
  "ride-service"
  "payment-service"
)

for service in "${services[@]}"; do
  echo -e "${BLUE}  → Applying schema for $service...${NC}"
  if docker compose exec -T "$service" npx prisma db push --skip-generate 2>/dev/null; then
    echo -e "${GREEN}    ✅ $service schema applied${NC}"
  else
    echo -e "${YELLOW}    ⚠️  $service schema may already exist${NC}"
  fi
done

# Step 8: Seed test data
echo -e "${BLUE}🌱 Step 8: Seeding initial test data...${NC}"
docker compose exec -T postgres psql -U postgres < scripts/seed-data-fixed.sql

# Step 9: Verify all services
echo -e "${BLUE}🔍 Step 9: Verifying all services...${NC}"

declare -a service_ports=(
  "3000:api-gateway"
  "3001:auth-service"
  "3002:ride-service"
  "3003:driver-service"
  "3004:payment-service"
  "3005:notification-service"
  "3007:user-service"
  "3008:booking-service"
  "3009:pricing-service"
  "3010:review-service"
)

for port_info in "${service_ports[@]}"; do
  port="${port_info%%:*}"
  service="${port_info##*:}"
  
  if curl -s http://localhost:$port/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ $service (port $port) is healthy${NC}"
  else
    echo -e "${YELLOW}⚠️  $service (port $port) may still be initializing${NC}"
  fi
done

echo ""
echo -e "${GREEN}===============================================${NC}"
echo -e "${GREEN}✅ System rebuild completed successfully!${NC}"
echo -e "${GREEN}===============================================${NC}"
echo ""
echo -e "${BLUE}Available Services:${NC}"
echo "  🌐 API Gateway:       http://localhost:3000"
echo "  🔐 Auth Service:      http://localhost:3001"
echo "  🚗 Ride Service:      http://localhost:3002"
echo "  🚙 Driver Service:    http://localhost:3003"
echo "  💳 Payment Service:   http://localhost:3004"
echo "  📢 Notification:      http://localhost:3005"
echo "  👤 User Service:      http://localhost:3007"
echo "  📅 Booking Service:   http://localhost:3008"
echo "  💰 Pricing Service:   http://localhost:3009"
echo "  ⭐ Review Service:    http://localhost:3010"
echo ""
echo -e "${BLUE}Test Credentials:${NC}"
echo "  Admin:    admin@cab.com / Test@123"
echo "  Customer: customer1@test.com / Test@123"
echo "  Driver:   driver1@test.com / Test@123"
echo ""
echo -e "${BLUE}Databases:${NC}"
echo "  PostgreSQL: localhost:5433 (user: postgres, password: from .env)"
echo "  MongoDB:    localhost:27017 (user: admin, password: from .env)"
echo "  Redis:      localhost:6379"
echo "  RabbitMQ:   localhost:5672 (Admin: http://localhost:15672)"
echo ""
