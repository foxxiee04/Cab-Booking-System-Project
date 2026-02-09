@echo off
REM ============================================
REM Backend Business Logic Testing - Windows
REM Tests all backend APIs and business rules
REM ============================================

cd /d "%~dp0.."

echo ========================================
echo BACKEND BUSINESS LOGIC TESTING
echo ========================================
echo.
echo This will test all backend services and APIs
echo Make sure all services are running (docker-compose up)
echo.

echo Installing test dependencies...
call npm install -D axios 2>nul

echo.
echo Running backend tests...
call npx tsx scripts/test-backend.ts

echo.
echo ========================================
echo TESTING COMPLETE
echo ========================================
echo.
