#!/bin/bash
# ============================================
# Database Seeding Script - Linux/Mac
# Populates databases with realistic test data
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "========================================"
echo "DATABASE SEEDING SCRIPT"
echo "========================================"
echo ""
echo "This will populate all databases with test data"
echo ""

echo "Installing dependencies if needed..."
npm install -D tsx bcryptjs @types/bcryptjs 2>/dev/null || true

echo ""
echo "Running seed script..."
npx tsx scripts/seed-database.ts

echo ""
echo "========================================"
echo "SEEDING COMPLETE"
echo "========================================"
echo ""
