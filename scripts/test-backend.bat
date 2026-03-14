@echo off
REM ============================================
REM  Cab Booking System - Backend Test Runner
REM ============================================

echo Running backend logic tests...
echo.

cd /d "%~dp0.."
npx tsx scripts\test-backend.ts
