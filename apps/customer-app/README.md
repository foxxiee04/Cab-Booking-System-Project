# 🚖 CAB BOOKING - CUSTOMER APP

Professional ride-hailing customer application built with React 18, TypeScript, Redux Toolkit, and OpenStreetMap.

## 📋 Features

✅ **Authentication**
- Login / Register with email & password
- JWT token-based authentication
- Auto token refresh
- Persistent sessions

✅ **Real-time Map**
- OpenStreetMap integration with Leaflet.js
- Current location detection
- Interactive map with click-to-select
- Custom markers (pickup, dropoff, driver)
- Route visualization

✅ **Ride Booking**
- Search locations with OSM Nominatim
- Select pickup & dropoff locations
- Fare estimation with surge pricing
- AI-powered ETA prediction
- Multiple vehicle types
- Payment method selection

✅ **Live Tracking**
- Real-time driver location updates (Socket.IO)
- Driver information display
- Ride status tracking
- ETA updates

✅ **Ride Management**
- View active ride
- Cancel ride
- Ride history
- Payment receipts

## 🛠️ Tech Stack

- **Framework**: React 18 + TypeScript
- **State Management**: Redux Toolkit
- **UI Library**: Material-UI (MUI)
- **Maps**: Leaflet + React-Leaflet + OpenStreetMap
- **Real-time**: Socket.IO Client
- **HTTP Client**: Axios
- **Form Handling**: React Hook Form + Zod
- **Routing**: React Router v6

## 📦 Installation

### 1. Install Dependencies

```bash
cd apps/customer-app
npm install
```

### 2. Environment Configuration

The `.env.development` file is already configured for local development:

```env
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_SOCKET_URL=http://localhost:3000
REACT_APP_AI_API_URL=http://localhost:8000/api
REACT_APP_NOMINATIM_URL=https://nominatim.openstreetmap.org
REACT_APP_OSRM_URL=http://router.project-osrm.org
```

## 🚀 Running the App

### 1. Start Backend Services

Make sure all backend services are running:

```bash
# From project root
cd ../..
docker-compose up -d
```

Verify services are healthy:
```bash
curl http://localhost:3000/health
```

### 2. Start Customer App

```bash
cd apps/customer-app
npm start
```

The app will open at **http://localhost:4000**

## 📱 Using the App

### First Time Setup

1. **Register Account**
   - Click "Sign Up"
   - Enter email, password, first name, last name
   - Role is automatically set to "CUSTOMER"
   - Click "Create Account"

2. **Login**
   - Enter your email and password
   - Click "Sign In"
   - You'll be redirected to the home map

### Booking a Ride

1. **Set Pickup Location**
   - Your current location is detected automatically
   - Or search for a location
   - Or click on the map

2. **Set Dropoff Location**
   - Search for destination
   - Or click on the map

3. **Get Fare Estimate**
   - View estimated fare
   - See surge multiplier (if any)
   - Check estimated distance & time

4. **Select Options**
   - Choose vehicle type (Economy/Comfort/Premium)
   - Select payment method (Cash/MoMo/Visa)

5. **Request Ride**
   - Click "Request Ride"
   - Wait for driver assignment (20s timeout)

### During Ride

- **Track Driver**: See driver location in real-time
- **Driver Info**: View driver details (name, vehicle, rating)
- **Ride Status**: Monitor ride progress
- **Cancel**: Cancel ride if needed (before pickup)

### After Ride

- **Payment**: Automatic payment processing
- **Receipt**: View payment details
- **History**: Check past rides
- **Rating**: Rate your driver (feature coming soon)

## 🗂️ Project Structure

```
apps/customer-app/
├── public/
│   └── index.html          # HTML template
├── src/
│   ├── api/                # API services
│   │   ├── auth.api.ts     # Authentication
│   │   ├── ride.api.ts     # Ride operations
│   │   ├── pricing.api.ts  # Fare estimation
│   │   ├── payment.api.ts  # Payments
│   │   └── axios.config.ts # Axios setup
│   ├── components/         # React components
│   │   ├── map/            # Map components
│   │   │   ├── MapView.tsx
│   │   │   ├── PickupMarker.tsx
│   │   │   ├── DropoffMarker.tsx
│   │   │   ├── DriverMarker.tsx
│   │   │   └── RouteLine.tsx
│   │   ├── booking/        # Booking components
│   │   └── common/         # Shared components
│   ├── pages/              # Page components
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── HomeMap.tsx     # Main booking interface
│   │   ├── RideTracking.tsx
│   │   ├── RideHistory.tsx
│   │   └── Profile.tsx
│   ├── store/              # Redux store
│   │   ├── auth.slice.ts   # Auth state
│   │   ├── ride.slice.ts   # Ride state
│   │   ├── location.slice.ts
│   │   ├── ui.slice.ts
│   │   ├── index.ts        # Store config
│   │   └── hooks.ts        # Typed hooks
│   ├── socket/             # Socket.IO
│   │   └── customer.socket.ts
│   ├── types/              # TypeScript types
│   │   └── index.ts
│   ├── utils/              # Utility functions
│   │   ├── map.utils.ts    # Map/location utilities
│   │   └── format.utils.ts # Formatters
│   ├── App.tsx             # Root component
│   └── index.tsx           # Entry point
├── package.json
├── tsconfig.json
└── .env.development
```

## 🔧 Development

### Running Tests

```bash
npm test
```

### Build for Production

```bash
npm run build
```

### Code Style

- Follow TypeScript best practices
- Use functional components with hooks
- Use Redux Toolkit for state management
- Keep components small and focused
- Extract reusable logic to custom hooks

## 🐛 Troubleshooting

### Map not loading

- Check internet connection (OSM tiles require internet)
- Clear browser cache
- Check browser console for errors

### Location not detected

- Allow location permission in browser
- Check if HTTPS is enabled (required for geolocation)
- Fallback to manual location selection

### Socket connection errors

- Verify backend is running: `curl http://localhost:3000/health`
- Check browser console for WebSocket errors
- Ensure correct SOCKET_URL in `.env`

### Authentication issues

- Check if auth service is running
- Verify token in localStorage
- Try logout and login again

## 📚 API Documentation

See [FRONTEND-DEVELOPMENT-GUIDE.txt](../../FRONTEND-DEVELOPMENT-GUIDE.txt) for complete API documentation.

## 🔐 Security Notes

- Tokens are stored in localStorage (consider httpOnly cookies for production)
- Always use HTTPS in production
- Never commit `.env` files with sensitive data
- Implement rate limiting for API calls

## 🚀 Next Steps

To complete the customer app:

1. **Complete remaining pages** (see TODO in source files)
2. **Add rating system** after ride completion
3. **Implement payment method management**
4. **Add ride sharing feature**
5. **Implement push notifications**
6. **Add offline support with service workers**
7. **Optimize bundle size** with code splitting
8. **Add E2E tests** with Cypress

## 📞 Support

For issues or questions:
- Check backend test report: `tests/comprehensive-test-report.txt`
- Backend status: All 108 tests passing (100%)
- Review API documentation in the guide

## 📄 License

Part of the Cab Booking System project.
