# 🛠️ ADMIN DASHBOARD - QUICK START

## ✅ Prerequisites

**Backend must be running:**
```bash
# From project root
docker-compose up -d
```

## 📦 Installation

```bash
cd apps/admin-dashboard
npm install
```

## 🏃 Run Development Server

```bash
npm start
```

Opens at: **http://localhost:4002**

## 🎯 Getting Started

### 1. Login as Admin
```
Email: admin@test.com
Password: Admin123!
```

**Note**: Only accounts with role='ADMIN' can access this dashboard

### 2. Dashboard Overview
- **System Statistics**: Real-time rides, drivers, customers, revenue
- **Ride Status Breakdown**: Pending, Active, Completed, Cancelled
- **Payment Status**: Pending, Completed, Failed
- **Driver Status**: Online, Offline, Busy

### 3. Manage Surge Pricing
Navigate to **Pricing** page:
- Adjust surge multiplier: 1.0x - 3.0x
- See real-time fare example
- Color-coded guidelines:
  - 🟢 1.0-1.2x: Normal demand
  - 🟠 1.3-1.7x: Moderate demand
  - 🔴 1.8-3.0x: High demand

## 🔔 Real-time Features (Socket.IO)

Admin dashboard receives live updates:
- ✅ `ride:created` - New ride notifications
- ✅ `ride:completed` - Ride completion updates
- ✅ `driver:online` / `driver:offline` - Driver status changes
- ✅ `payment:completed` - Payment confirmations

Stats auto-refresh every 30 seconds + socket updates

## 📊 Features Implemented

### ✅ Currently Available:
1. **Dashboard** - System overview with real-time stats
2. **Pricing Management** - Surge pricing control with slider
3. **Authentication** - Admin-only access
4. **Real-time Updates** - Socket.IO integration
5. **Responsive Layout** - Desktop-first design

### 🚧 Placeholder Pages (TODO):
- **Rides Management** - Table with filters
- **Drivers Management** - Driver list with performance metrics
- **Customers Management** - Customer database
- **Payments Management** - Transaction history
- **System Logs** - Log viewer with search

## 🎨 Theme

- Primary: Purple #667eea
- Secondary: Purple #764ba2
- Background: Light Gray #F5F7FA
- Font: Inter, Roboto

## 🏗️ Project Structure

```
src/
├── api/              - Backend API calls
│   ├── auth.api.ts   - Login
│   ├── admin.api.ts  - Stats, Rides, Drivers, Customers
│   └── pricing.api.ts - Surge pricing
├── pages/            - Page components
│   ├── Login.tsx     - Admin login
│   ├── Dashboard.tsx - Main overview
│   ├── Pricing.tsx   - Surge pricing management
│   └── [Other].tsx   - Placeholder pages
├── socket/           - Socket.IO integration
│   └── admin.socket.ts - Real-time event listeners
├── store/            - Redux slices
│   ├── auth.slice.ts
│   ├── admin.slice.ts
│   └── ui.slice.ts
├── types/            - TypeScript definitions
├── utils/            - Helper functions
└── App.tsx           - Root component with layout
```

## 🔐 Security

- Admin role verification on login
- JWT token authentication
- Auto token refresh
- Protected routes

## 🚀 Usage

### View System Stats
1. Login as admin
2. Dashboard shows live metrics
3. Auto-refresh every 30s

### Adjust Surge Pricing
1. Go to **Pricing** page
2. Move slider to desired multiplier
3. Add reason (optional)
4. Click "Update Surge Pricing"
5. Changes apply immediately system-wide

### Monitor Real-time Activity
- Watch dashboard for live updates
- Notifications appear for new events
- Stats counters update automatically

## 🔗 Integration

**Connects to:**
- Customer App (4000) - Monitors customer activity
- Driver App (4001) - Tracks driver status
- Backend API (3000) - All system data
- Socket.IO (3000) - Real-time events

**Test workflow:**
1. Open Admin Dashboard (4002)
2. Create ride from Customer App (4000)
3. See "New ride created" notification
4. Driver accepts → "Ride completed" update
5. Revenue counter increases automatically

## 📈 Next Steps

To complete the dashboard:
1. Implement Rides table with DataGrid
2. Add Drivers management with charts
3. Build Customers table with search
4. Create Payments history view
5. Implement Logs viewer with filters
6. Add charts (Recharts) for analytics
7. Export data functionality

## 📞 Support

Backend: 108/108 tests ✅
Issues? Check `tests/comprehensive-test-report.txt`

---

**Admin Dashboard ready for system monitoring! 🛠️**
