@echo off
REM Clear all data from MongoDB and PostgreSQL for Windows
REM WARNING: This will DELETE ALL DATA - use only for development!

echo.
echo [33m^^!^^![0m WARNING: This will DELETE ALL DATA from all databases!
echo.
pause

echo.
echo [36m^^=^^= Clearing MongoDB (cab_auth) ^^=^^=[0m
docker exec cab-mongodb mongosh cab_auth --eval "db.users.deleteMany({}); db.refreshtokens.deleteMany({}); console.log('✅ cab_auth cleared');"

echo.
echo [36m^^=^^= Clearing MongoDB (cab_driver_service) ^^=^^=[0m
docker exec cab-mongodb mongosh cab_driver_service --eval "db.drivers.deleteMany({}); console.log('✅ cab_driver_service cleared');"

echo.
echo [36m^^=^^= Clearing PostgreSQL (cab_rides) ^^=^^=[0m
docker exec cab-postgres psql -U postgres -d cab_rides -c "TRUNCATE TABLE \"RideStateTransition\" CASCADE; TRUNCATE TABLE \"Ride\" CASCADE; SELECT 'cab_rides cleared' as status;"

echo.
echo [36m^^=^^= Clearing PostgreSQL (cab_payments) ^^=^^=[0m
docker exec cab-postgres psql -U postgres -d cab_payments -c "TRUNCATE TABLE \"OutboxEvent\" CASCADE; TRUNCATE TABLE \"Payment\" CASCADE; TRUNCATE TABLE \"Fare\" CASCADE; SELECT 'cab_payments cleared' as status;"

echo.
echo [32m^^✔^^^ All database data cleared successfully^^![0m
echo [33mAll collections/tables are now EMPTY[0m
echo.
pause
