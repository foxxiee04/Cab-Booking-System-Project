#!/bin/bash
# ============================================
# Backend Business Logic Testing - Linux/Mac
# Tests all backend APIs and business rules
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "========================================"
echo "BACKEND BUSINESS LOGIC TESTING"
echo "========================================"
echo ""
echo "This will test all backend services and APIs"
echo "Make sure all services are running (docker-compose up)"
echo ""

echo "Installing test dependencies..."
npm install -D axios 2>/dev/null || true

echo ""
echo "Running backend tests..."
npx tsx scripts/test-backend.ts

echo ""
echo "========================================"
echo "TESTING COMPLETE"
echo "========================================"
echo ""
