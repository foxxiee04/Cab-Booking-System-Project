import React, { useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import { useAppSelector } from './store/hooks';
import { socketService } from './socket/customer.socket';
import MobileAppShell from './components/layout/MobileAppShell';

import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import HomeMap from './pages/HomeMap';
import RideTracking from './pages/RideTracking';
import PaymentCallback from './pages/PaymentCallback';
import RideHistory from './pages/RideHistory';
import Profile from './pages/Profile';
import Activity from './pages/Activity';
import Messages from './pages/Messages';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// Public Route Component (redirect if authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  return !isAuthenticated ? <>{children}</> : <Navigate to="/home" replace />;
};

function App() {
  const { isAuthenticated, accessToken } = useAppSelector((state) => state.auth);

  // Connect socket when authenticated
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      socketService.connect(accessToken);
    }

    return () => {
      socketService.disconnect();
    };
  }, [isAuthenticated, accessToken]);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicRoute>
              <ForgotPassword />
            </PublicRoute>
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MobileAppShell>
                <Outlet />
              </MobileAppShell>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<HomeMap />} />
          <Route path="activity" element={<Activity />} />
          <Route path="messages" element={<Messages />} />
          <Route path="profile" element={<Profile />} />
          <Route path="history" element={<RideHistory />} />
        </Route>

        <Route
          path="/ride/:rideId"
          element={
            <ProtectedRoute>
              <RideTracking />
            </ProtectedRoute>
          }
        />

        <Route path="/payment/callback" element={<PaymentCallback />} />

        <Route path="*" element={<Navigate to={isAuthenticated ? '/home' : '/login'} replace />} />
      </Routes>
    </Box>
  );
}

export default App;
