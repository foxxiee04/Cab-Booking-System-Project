@echo off
REM ============================================
REM Database Seeding Script - Windows
REM Populates databases with realistic test data
REM ============================================

cd /d "%~dp0.."

echo ========================================
echo DATABASE SEEDING SCRIPT
echo ========================================
echo.
echo This will populate all databases with test data
echo.

echo Installing dependencies if needed...
call npm install -D tsx bcryptjs @types/bcryptjs 2>nul

echo.
echo Running seed script...
call npx tsx scripts/seed-database.ts

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Seeding failed!
    exit /b 1
)

echo.
echo ========================================
echo SEEDING COMPLETE
echo ========================================
echo.
