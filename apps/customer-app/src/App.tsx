import React, { useEffect } from 'react';
import { Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Slide, SlideProps, Snackbar, Typography } from '@mui/material';
import { LocalTaxiRounded } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { socketService } from './socket/customer.socket';
import { hideNotification } from './store/ui.slice';
import MobileAppShell from './components/layout/MobileAppShell';

import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import HomeMap from './pages/HomeMap';
import RideTracking from './pages/RideTracking';
import RideDemoPage from './pages/RideDemoPage';
import PaymentCallback from './pages/PaymentCallback';
import PaymentMockGateway from './pages/PaymentMockGateway';
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

const NOTIFICATION_TITLES = {
  success: 'Cập nhật chuyến đi',
  error: 'Có lỗi xảy ra',
  warning: 'Lưu ý',
  info: 'Thông báo',
};

const NotificationTransition = (props: SlideProps) => <Slide {...props} direction="down" />;

function App() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isAuthenticated, accessToken } = useAppSelector((state) => state.auth);
  const notification = useAppSelector((state) => state.ui.notification);

  const handleNotificationClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }

    dispatch(hideNotification());
  };

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
      {notification && (
        <Snackbar
          open
          onClose={handleNotificationClose}
          autoHideDuration={notification.persistMs ?? 5000}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          TransitionComponent={NotificationTransition}
        >
          <Alert
            severity={notification.type}
            variant="filled"
            icon={notification.type === 'success' && notification.rideId ? <LocalTaxiRounded fontSize="inherit" /> : undefined}
            onClose={handleNotificationClose}
            action={notification.rideId ? (
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  handleNotificationClose();
                  navigate(`/ride/${notification.rideId}`);
                }}
              >
                Xem chuyến
              </Button>
            ) : undefined}
            sx={{
              width: '100%',
              minWidth: { xs: 'min(92vw, 320px)', sm: 380 },
              alignItems: 'flex-start',
              borderRadius: 3,
              boxShadow: '0 22px 48px rgba(15,23,42,0.24)',
              '& .MuiAlert-message': {
                width: '100%',
              },
            }}
          >
            <Typography variant="subtitle2" fontWeight={800}>
              {notification.title || NOTIFICATION_TITLES[notification.type]}
            </Typography>
            <Typography variant="body2">
              {notification.message}
            </Typography>
          </Alert>
        </Snackbar>
      )}

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
        <Route path="/payment/sandbox-gateway" element={<PaymentMockGateway />} />
        <Route path="/payment/mock-gateway" element={<PaymentMockGateway />} />
        <Route path="/demo" element={<RideDemoPage />} />

        <Route path="*" element={<Navigate to={isAuthenticated ? '/home' : '/login'} replace />} />
      </Routes>
    </Box>
  );
}

export default App;
