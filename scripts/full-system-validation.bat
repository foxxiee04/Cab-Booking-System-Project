@echo off
REM ============================================
REM Master Script - Full System Reset & Test
REM ============================================

cd /d "%~dp0"

echo.
echo ============================================
echo CAB BOOKING SYSTEM - FULL VALIDATION
echo ============================================
echo.
echo This script will:
echo 1. Reset all databases
echo 2. Seed with realistic test data
echo 3. Test backend business logic
echo 4. Generate Vietnamese documentation
echo.
echo Press Ctrl+C to cancel, or
pause

echo.
echo ============================================
echo STEP 1: DATABASE RESET
echo ============================================
call reset-database.bat
if %errorlevel% neq 0 (
    echo ERROR: Database reset failed!
    exit /b 1
)

echo.
echo ============================================
echo STEP 2: DATABASE SEEDING
echo ============================================
call seed-database.bat
if %errorlevel% neq 0 (
    echo ERROR: Database seeding failed!
    exit /b 1
)

echo.
echo ============================================
echo STEP 3: BACKEND TESTING
echo ============================================
call test-backend.bat
if %errorlevel% neq 0 (
    echo WARNING: Some backend tests failed!
    echo Continue to documentation generation...
)

echo.
echo ============================================
echo STEP 4: DOCUMENTATION GENERATION
echo ============================================
echo See: BAO_CAO_KET_QUA_KIEM_TRA_HE_THONG.txt

echo.
echo ============================================
echo VALIDATION COMPLETE
echo ============================================
echo.
echo Check the Vietnamese documentation file for full details.
echo.
pause
