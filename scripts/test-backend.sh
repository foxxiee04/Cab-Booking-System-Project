#!/bin/bash
# ============================================
#  Cab Booking System - Backend Test Runner
# ============================================

echo "Running backend logic tests..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"
npx tsx scripts/test-backend.ts
