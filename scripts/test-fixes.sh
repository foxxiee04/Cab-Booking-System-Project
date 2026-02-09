#!/bin/bash

# Quick Test Script - Verify All Fixes
# Run: bash test-fixes.sh

echo "🧪 Testing All Fixes..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "${YELLOW}=== Step 1: Restart Backend Services ===${NC}"
echo "Run: docker-compose restart driver-service"
echo "Press Enter when done..."
read

echo ""
echo "${YELLOW}=== Step 2: Test Customer App ===${NC}"
echo "1. Open: http://localhost:3002"
echo "2. Login: customer1@gmail.com / Customer@123"
echo "3. Book ride: TSN Airport → Landmark 81"
echo "4. Check: Should have 3 steps (not 4)"
echo "5. Check console: No errors?"
echo ""
read -p "Customer app working? (y/n): " customer_ok

if [ "$customer_ok" != "y" ]; then
    echo "${RED}❌ Customer app has issues${NC}"
else
    echo "${GREEN}✅ Customer app OK${NC}"
fi

echo ""
echo "${YELLOW}=== Step 3: Approve Driver ===${NC}"
echo "Run: npx tsx scripts/approve-drivers.ts"
echo "Press Enter when done..."
read

echo ""
echo "${YELLOW}=== Step 4: Test Driver App ===${NC}"
echo "1. Open: http://localhost:3003"
echo "2. Login: driver1@cabsystem.vn / Driver@123"
echo "3. Click 'Go Online'"
echo "4. Check: Should be online (no approval error)"
echo "5. Check console: Socket connected?"
echo ""
read -p "Driver app online? (y/n): " driver_ok

if [ "$driver_ok" != "y" ]; then
    echo "${RED}❌ Driver app has issues${NC}"
else
    echo "${GREEN}✅ Driver app OK${NC}"
fi

echo ""
echo "${YELLOW}=== Step 5: Test End-to-End ===${NC}"
echo "1. Customer: Book a ride"
echo "2. Driver: Should receive notification"
echo "3. Check driver console: NEW_RIDE_AVAILABLE event?"
echo "4. Check RideRequestModal: No crashes?"
echo "5. Modal shows: Customer, Pickup, Dropoff, Fare"
echo ""
read -p "Ride request working? (y/n): " e2e_ok

if [ "$e2e_ok" != "y" ]; then
    echo "${RED}❌ E2E has issues${NC}"
    echo ""
    echo "📝 Check these:"
    echo "  - Driver console for errors"
    echo "  - Customer console for errors"
    echo "  - Network tab → WebSocket messages"
else
    echo "${GREEN}✅ E2E Working!${NC}"
fi

echo ""
echo "${YELLOW}=== Summary ===${NC}"
echo "Customer App: ${customer_ok}"
echo "Driver App: ${driver_ok}"
echo "End-to-End: ${e2e_ok}"

if [ "$customer_ok" == "y" ] && [ "$driver_ok" == "y" ] && [ "$e2e_ok" == "y" ]; then
    echo ""
    echo "${GREEN}🎉 All tests passed! System is working!${NC}"
else
    echo ""
    echo "${RED}⚠️  Some tests failed. Check console logs.${NC}"
fi
