#!/bin/bash

# Clear all data from MongoDB and PostgreSQL
# WARNING: This will DELETE ALL DATA - use only for development!

echo "🗑️  Clearing all database data..."

# MongoDB: Drop collections in cab_auth
echo "📦 Clearing MongoDB (cab_auth)..."
docker exec cab-mongodb mongosh cab_auth --eval "
  db.users.deleteMany({});
  db.refreshtokens.deleteMany({});
  console.log('✅ cab_auth cleared');
"

# MongoDB: Drop collections in cab_driver_service
echo "📦 Clearing MongoDB (cab_driver_service)..."
docker exec cab-mongodb mongosh cab_driver_service --eval "
  db.drivers.deleteMany({});
  console.log('✅ cab_driver_service cleared');
"

# PostgreSQL: Truncate all tables in cab_rides
echo "📦 Clearing PostgreSQL (cab_rides)..."
docker exec cab-postgres psql -U postgres -d cab_rides -c "
  TRUNCATE TABLE \"RideStateTransition\" CASCADE;
  TRUNCATE TABLE \"Ride\" CASCADE;
  SELECT 'cab_rides cleared' as status;
"

# PostgreSQL: Truncate all tables in cab_payments
echo "📦 Clearing PostgreSQL (cab_payments)..."
docker exec cab-postgres psql -U postgres -d cab_payments -c "
  TRUNCATE TABLE \"OutboxEvent\" CASCADE;
  TRUNCATE TABLE \"Payment\" CASCADE;
  TRUNCATE TABLE \"Fare\" CASCADE;
  SELECT 'cab_payments cleared' as status;
"

echo "✅ All database data cleared successfully!"
echo "⚠️  All collections/tables are now EMPTY"
