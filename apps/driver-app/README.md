# 🚗 DRIVER APP - QUICK START

## ✅ Prerequisites

**Backend must be running:**
```bash
# From project root
docker-compose up -d
```

## 📦 Installation

```bash
cd apps/driver-app
npm install
```

## 🏃 Run Development Server

```bash
npm start
```

Opens at: **http://localhost:4001**

## 🎯 Getting Started

### 1. Register as Driver
- Click "Sign Up"
- Fill in personal details
- Email: your-email@test.com
- Password: Password123! (min 8 chars, uppercase, lowercase, number)

### 2. Complete Driver Profile
After registration, you'll be redirected to profile setup:
- **Vehicle Type**: Economy / Comfort / Premium
- **Vehicle Make**: e.g., Toyota, Honda
- **Vehicle Model**: e.g., Vios, City
- **Vehicle Color**: e.g., White, Silver
- **License Plate**: e.g., 29A-12345
- **Driver License Number**: Your license ID

### 3. Go Online
- Toggle "Online" switch on dashboard
- GPS will start tracking your location
- You'll receive ride requests via Socket.IO

### 4. Accept Rides
When ride request arrives:
- **20 seconds countdown** to accept/reject
- See customer info, pickup/dropoff, fare
- Click "Accept Ride" to confirm

### 5. Complete Ride Flow
1. **Accepted** → Navigate to pickup location
2. **Arrived** → Click "Start Ride" when customer on board
3. **In Progress** → Navigate to dropoff
4. **Complete** → Click "Complete Ride" when arrived

## 🗺️ Map Features

- **Blue car marker** 🚗 = Your current location (real-time GPS)
- **Green marker** 📍 = Pickup location
- **Red marker** 🏁 = Dropoff location
- **Blue route line** = Navigation path

## 🔔 Real-time Features (Socket.IO)

- **New ride requests** with countdown timer
- **Ride timeout** if not accepted in 20s
- **Ride cancellation** by customer
- **Ride reassignment** to other drivers
- **Automatic GPS updates** every 15s

## 📊 Earnings Tracking

- Today's earnings displayed on dashboard
- Total rides completed
- Rating and statistics

## 🐛 Troubleshooting

### GPS not working?
- Allow location permission in browser
- Ensure GPS enabled on device
- Check browser console for errors

### Not receiving ride requests?
- Make sure you're **Online** (green chip in header)
- Check Socket.IO connection (console logs)
- Verify backend: `curl http://localhost:3000/health`

### Ride timeout immediately?
- Check system time is correct
- Backend uses 20s timeout by default
- Look for "ride:timeout" event in console

## 🏗️ Project Structure

```
src/
├── api/              - Backend API calls (auth, driver, ride)
├── components/
│   ├── map/          - Map components (MapView, Markers, RouteLine)
│   └── ride-request/ - Ride request modal with countdown
├── pages/            - Pages (Login, Dashboard, ActiveRide, etc.)
├── socket/           - Socket.IO integration (driver.socket.ts)
├── store/            - Redux slices (auth, driver, ride, ui)
├── types/            - TypeScript type definitions
├── utils/            - Helper functions (map, format)
├── App.tsx           - Root component with routing
└── index.tsx         - Entry point
```

## 🎨 Theme

- Primary: Blue #1976D2 (Professional)
- Secondary: Green #2E7D32 (Success)
- Font: Inter, Roboto

## 🔐 Authentication

- JWT tokens in localStorage
- Auto token refresh on 401
- Secure API calls with Bearer token

## 📱 Features

✅ Driver registration & profile setup  
✅ Online/Offline status toggle  
✅ Real-time GPS tracking (15s intervals)  
✅ Ride requests with countdown timer  
✅ Accept/Reject rides  
✅ Active ride tracking with map  
✅ Start/Complete ride flow  
✅ Earnings dashboard  
✅ Ride history  

## 🚀 Demo Workflow

1. **Register** → Fill profile → **Dashboard**
2. Toggle **"Online"** → GPS starts
3. Wait for ride request (or trigger from customer app)
4. **Accept within 20s** → Navigate to pickup
5. **Start ride** → Navigate to dropoff
6. **Complete** → Earnings updated

## 🔗 Integration

**Works with:**
- Customer App (port 4000)
- Backend API (port 3000)
- Socket.IO (port 3000)

**Test full flow:**
1. Open Customer App (4000) → Request ride
2. Open Driver App (4001) → Accept ride
3. See real-time updates in both apps

## 📞 Support

Backend: 108/108 tests ✅
Issues? Check `tests/comprehensive-test-report.txt`
