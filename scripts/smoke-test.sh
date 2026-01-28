#!/bin/bash

# ============================================
# Smoke Test Script for Cab Booking System
# ============================================

HOST=${1:-localhost:3000}
FAILED=0

echo "================================================"
echo "  SMOKE TESTS - Cab Booking System"
echo "  Target: $HOST"
echo "================================================"
echo ""

# Helper function to test endpoint
test_endpoint() {
    local name=$1
    local endpoint=$2
    local expected_code=$3
    local method=${4:-GET}
    
    echo -n "Testing $name... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" -X $method "http://$HOST$endpoint")
    
    if [ "$response" == "$expected_code" ]; then
        echo "✓ PASS ($response)"
    else
        echo "✗ FAIL (Expected: $expected_code, Got: $response)"
        FAILED=$((FAILED+1))
    fi
}

# Test API Gateway Health
test_endpoint "API Gateway Health" "/health" "200"

# Test Auth Service (through gateway)
test_endpoint "Auth Service - Register Endpoint" "/api/auth/register" "400" "POST"
test_endpoint "Auth Service - Login Endpoint" "/api/auth/login" "400" "POST"

# Test Ride Service
test_endpoint "Ride Service (Unauthorized)" "/api/rides" "401"

# Test Driver Service
test_endpoint "Driver Service (Unauthorized)" "/api/drivers" "401"

# Test Pricing Service
test_endpoint "Pricing Service - Estimate" "/api/pricing/estimate" "400" "POST"

# Test AI Service (public endpoint)
test_endpoint "AI Service - Estimate" "/api/ai/ride/estimate" "400" "POST"

echo ""
echo "================================================"
echo "  SMOKE TEST RESULTS"
echo "================================================"

if [ $FAILED -eq 0 ]; then
    echo "✓ All smoke tests passed!"
    exit 0
else
    echo "✗ $FAILED test(s) failed"
    exit 1
fi
