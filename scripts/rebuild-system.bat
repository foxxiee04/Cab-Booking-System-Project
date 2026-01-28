@echo off
REM ==============================================
REM Clean and Rebuild Cab Booking System
REM ==============================================

echo.
echo ================================================
echo  CLEAN AND REBUILD CAB BOOKING SYSTEM
echo ================================================
echo.

REM Step 1: Stop and remove all containers
echo [1/6] Stopping all containers...
docker-compose down

echo.
echo [2/6] Removing all containers...
docker rm -f $(docker ps -aq) 2>nul

REM Step 2: Remove images
echo.
echo [3/6] Removing project images...
docker rmi $(docker images "cab-*" -q) 2>nul
docker rmi $(docker images "*booking*" -q) 2>nul

REM Step 3: Clean volumes (databases)
echo.
echo [4/6] Removing volumes (databases will be wiped)...
docker volume rm cab-booking-system-project_postgres_data 2>nul
docker volume rm cab-booking-system-project_mongo_data 2>nul
docker volume rm cab-booking-system-project_redis_data 2>nul
docker volume prune -f

REM Step 4: Clean networks
echo.
echo [5/6] Cleaning networks...
docker network prune -f

REM Step 5: Rebuild and start
echo.
echo [6/6] Rebuilding and starting services...
docker-compose up --build -d

echo.
echo ================================================
echo  REBUILD COMPLETE!
echo ================================================
echo.
echo Services starting up...
echo - API Gateway: http://localhost:3000
echo - Mongo Express: http://localhost:8081
echo - Grafana: http://localhost:3030
echo - Prometheus: http://localhost:9090
echo.
echo Use "docker-compose logs -f" to view logs
echo Use "docker-compose ps" to check status
echo.

pause
