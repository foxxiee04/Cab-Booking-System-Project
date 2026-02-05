@echo off
REM System verification and health check script for Windows
REM This script verifies that all components of the Cab Booking System are properly configured

setlocal enabledelayedexpansion

set CHECKS_PASSED=0
set CHECKS_FAILED=0
set CHECKS_WARNING=0

echo.
echo ===============================================================
echo    Cab Booking System - Configuration Verification
echo ===============================================================
echo.

REM 1. Root Configuration Files
echo [1] Root Configuration Files
set files=package.json .env.example docker-compose.yml docker-compose.prod.yml docker-stack.yml tsconfig.base.json README.md
for %%F in (%files%) do (
  if exist "%%F" (
    echo [OK] %%F
    set /a CHECKS_PASSED+=1
  ) else (
    echo [FAIL] %%F
    set /a CHECKS_FAILED+=1
  )
)
echo.

REM 2. Environment Configuration
echo [2] Environment Configuration
if exist ".env" (
  echo [OK] .env
  set /a CHECKS_PASSED+=1
) else (
  echo [FAIL] .env
  set /a CHECKS_FAILED+=1
)

if exist "env\" (
  echo [OK] env\
  set /a CHECKS_PASSED+=1
) else (
  echo [FAIL] env\
  set /a CHECKS_FAILED+=1
)

set env_files=gateway.env auth.env user.env driver.env booking.env ride.env payment.env pricing.env notification.env review.env
for %%F in (%env_files%) do (
  if exist "env\%%F" (
    echo [OK] env\%%F
    set /a CHECKS_PASSED+=1
  ) else (
    echo [FAIL] env\%%F
    set /a CHECKS_FAILED+=1
  )
)
echo.

REM 3. Database Scripts
echo [3] Database Scripts
set db_files=scripts\init-db.sql scripts\seed-data-fixed.sql scripts\rebuild-system.sh scripts\rebuild-system.bat scripts\clear-db.sh scripts\DATABASE_RESET.md
for %%F in (%db_files%) do (
  if exist "%%F" (
    echo [OK] %%F
    set /a CHECKS_PASSED+=1
  ) else (
    echo [FAIL] %%F
    set /a CHECKS_FAILED+=1
  )
)
echo.

REM 4. Shared Utilities
echo [4] Shared Utilities
if exist "shared\" (
  echo [OK] shared\
  set /a CHECKS_PASSED+=1
) else (
  echo [FAIL] shared\
  set /a CHECKS_FAILED+=1
)

set shared_dirs=shared shared\types shared\utils
for %%D in (%shared_dirs%) do (
  if exist "%%D\" (
    echo [OK] %%D\
    set /a CHECKS_PASSED+=1
  ) else (
    echo [FAIL] %%D\
    set /a CHECKS_FAILED+=1
  )
)
echo.

REM 5. Core Microservices
echo [5] Microservices
set services=api-gateway auth-service user-service driver-service booking-service ride-service payment-service pricing-service notification-service review-service
for %%S in (%services%) do (
  if exist "services\%%S\" (
    echo [OK] services\%%S\
    set /a CHECKS_PASSED+=1
  ) else (
    echo [FAIL] services\%%S\
    set /a CHECKS_FAILED+=1
  )
)
echo.

REM 6. Service Configuration Files
echo [6] Service Configuration
for %%S in (%services%) do (
  if exist "services\%%S\package.json" (
    echo [OK] services\%%S\package.json
    set /a CHECKS_PASSED+=1
  )
  if exist "services\%%S\Dockerfile" (
    echo [OK] services\%%S\Dockerfile
    set /a CHECKS_PASSED+=1
  )
)
echo.

REM 7. Prisma Schemas
echo [7] Prisma Database Schemas
set prisma_services=auth-service user-service driver-service booking-service ride-service payment-service
for %%S in (%prisma_services%) do (
  if exist "services\%%S\prisma\schema.prisma" (
    echo [OK] services\%%S\prisma\schema.prisma
    set /a CHECKS_PASSED+=1
  ) else (
    echo [FAIL] services\%%S\prisma\schema.prisma
    set /a CHECKS_FAILED+=1
  )
)
echo.

REM 8. Database Initialization
echo [8] Database Initialization
findstr /L "CREATE DATABASE auth_db" scripts\init-db.sql >nul 2>&1
if !ERRORLEVEL! equ 0 (
  echo [OK] auth_db defined in init-db.sql
  set /a CHECKS_PASSED+=1
) else (
  echo [FAIL] auth_db not found in init-db.sql
  set /a CHECKS_FAILED+=1
)
echo.

REM 9. Documentation
echo [9] Documentation
if exist "IMPLEMENTATION_SUMMARY.md" (
  echo [OK] IMPLEMENTATION_SUMMARY.md
  set /a CHECKS_PASSED+=1
) else (
  echo [FAIL] IMPLEMENTATION_SUMMARY.md
  set /a CHECKS_FAILED+=1
)

if exist "REBUILD_STATUS.md" (
  echo [OK] REBUILD_STATUS.md
  set /a CHECKS_PASSED+=1
) else (
  echo [FAIL] REBUILD_STATUS.md
  set /a CHECKS_FAILED+=1
)
echo.

REM Summary
echo ===============================================================
echo                          SUMMARY
echo ===============================================================
echo.
echo Passed:   %CHECKS_PASSED%
echo Failed:   %CHECKS_FAILED%
echo.

if %CHECKS_FAILED% equ 0 (
  echo SUCCESS: System configuration is COMPLETE and READY
  echo.
  echo Next steps:
  echo   1. Ensure .env file has correct credentials
  echo   2. Run: scripts\rebuild-system.bat
  echo   3. Wait for all services to start
  echo   4. Test: curl http://localhost:3000/health
  echo.
) else (
  echo FAILED: System configuration has errors
  echo.
  echo Please fix the above errors before proceeding.
  echo See IMPLEMENTATION_SUMMARY.md for details.
  echo.
)

pause
