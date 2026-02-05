# 🚀 QUICK START - CUSTOMER APP

## ✅ Prerequisites

1. **Backend services running:**
```bash
# From project root
docker-compose up -d
```

2. **Verify backend:**
```bash
curl http://localhost:3000/health
# Should return: {"status":"ok","services":...}
```

## 📦 Installation

```bash
cd apps/customer-app
npm install
```

## 🏃 Run Development Server

```bash
npm start
```

App will open at: **http://localhost:4001**

## 🎯 Test the App

### 1. Login with Demo Account
```
Email: customer@test.com
Password: Password123!
```

### 2. Or Register New Account
- Click "Sign Up"
- Fill in the form
- Role is automatically "CUSTOMER"

### 3. Book a Ride
1. Allow location permission
2. Search for dropoff location
3. View fare estimate
4. Select vehicle type & payment
5. Click "Request Ride"
6. Wait for driver assignment (20s)

## 🗺️ Map Features

- **OpenStreetMap** integration
- **Green marker** 📍 = Pickup location
- **Red marker** 🏁 = Dropoff location  
- **Blue car** 🚗 = Driver location (real-time)
- **Blue line** = Route

## 🔄 Real-time Features

Connected via Socket.IO:
- Driver assignment notifications
- Driver location updates (every 10-30s)
- Ride status changes
- Driver timeout alerts

## 🐛 Troubleshooting

### Map not loading?
- Check internet connection
- Clear browser cache
- Open browser console (F12)

### Can't login?
```bash
# Check backend
curl http://localhost:3000/api/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"customer@test.com","password":"Password123!"}'
```

### Socket not connecting?
- Verify backend: `curl http://localhost:3000/health`
- Check browser console for WebSocket errors
- Ensure port 3000 is not blocked

## 📁 Project Structure

```
src/
├── api/          - Backend API calls
├── components/   - React components
│   ├── map/      - Map components (MapView, Markers, RouteLine)
│   └── common/   - Shared UI components
├── pages/        - Page components (Login, HomeMap, etc.)
├── store/        - Redux slices (auth, ride, location, ui)
├── socket/       - Socket.IO integration
├── types/        - TypeScript types
├── utils/        - Helper functions
└── App.tsx       - Root component with routing
```

## 🎨 Theme

- Primary: Green #2E7D32 (Eco-friendly, Trust)
- Secondary: Blue #1976D2 (Professional)
- Font: Inter, Roboto

## 🔐 Authentication

- JWT tokens stored in localStorage
- Auto token refresh on 401
- Protected routes with redirect

## 📞 Support

Backend: 108/108 tests passing ✅
Report: `tests/comprehensive-test-report.txt`
