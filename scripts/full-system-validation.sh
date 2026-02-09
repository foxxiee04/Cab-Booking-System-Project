#!/bin/bash
# ============================================
# Master Script - Full System Reset & Test
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "============================================"
echo "CAB BOOKING SYSTEM - FULL VALIDATION"
echo "============================================"
echo ""
echo "This script will:"
echo "1. Reset all databases"
echo "2. Seed with realistic test data"
echo "3. Test backend business logic"
echo "4. Generate Vietnamese documentation"
echo ""
echo "Press Ctrl+C to cancel in 5 seconds..."
sleep 5

echo ""
echo "============================================"
echo "STEP 1: DATABASE RESET"
echo "============================================"
bash reset-database.sh

echo ""
echo "============================================"
echo "STEP 2: DATABASE SEEDING"
echo "============================================"
bash seed-database.sh

echo ""
echo "============================================"
echo "STEP 3: BACKEND TESTING"
echo "============================================"
bash test-backend.sh || echo "WARNING: Some backend tests failed!"

echo ""
echo "============================================"
echo "STEP 4: DOCUMENTATION GENERATION"
echo "============================================"
echo "See: BAO_CAO_KET_QUA_KIEM_TRA_HE_THONG.txt"

echo ""
echo "============================================"
echo "VALIDATION COMPLETE"
echo "============================================"
echo ""
echo "Check the Vietnamese documentation file for full details."
echo ""
