#!/bin/bash

# Complete database reset for Cab Booking System
# WARNING: This will DELETE ALL DATA and REBUILD from scratch - use only for development!

set -e

echo "🗑️  Complete database reset starting..."

# Stop and remove all containers and volumes
echo "📦 Stopping containers and removing volumes..."
docker compose down -v

# Wait for cleanup
sleep 2

echo "📦 Starting fresh infrastructure..."
docker compose up -d postgres mongodb redis rabbitmq

# Wait for databases to be ready
echo "⏳ Waiting for databases to initialize..."
sleep 10

# Verify PostgreSQL is ready
echo "🔍 Verifying PostgreSQL..."
docker compose exec -T postgres pg_isready -U postgres || exit 1

# Verify MongoDB is ready
echo "🔍 Verifying MongoDB..."
docker compose exec -T mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1 || exit 1

# Seed initial data
echo "🌱 Seeding initial test data..."
docker compose exec -T postgres psql -U postgres -f /docker-entrypoint-initdb.d/init.sql

# Apply Prisma schemas for all PostgreSQL services
echo "📐 Applying Prisma schemas..."
for service in auth-service user-service driver-service booking-service ride-service payment-service; do
  echo "  → Applying schema for $service..."
  docker compose exec -T "$service" npx prisma db push --skip-generate || true
done

echo "✅ Database reset completed successfully!"
echo "✅ All services ready for use"
