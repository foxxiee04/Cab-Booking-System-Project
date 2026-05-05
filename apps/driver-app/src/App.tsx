import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from './store/hooks';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ProfileSetup from './pages/ProfileSetup';
import Dashboard from './pages/Dashboard';
import ActiveRide from './pages/ActiveRide';
import RideDemoPage from './pages/RideDemoPage';
import Account from './pages/Account';
import Earnings from './pages/Earnings';
import History from './pages/History';
import Profile from './pages/Profile';
import DriverMobileShell from './components/layout/DriverMobileShell';
import Wallet from './pages/Wallet';
import WalletTopUpReturn from './pages/WalletTopUpReturn';
import AIAssistWidget from './components/AIAssistWidget';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Public Route Component (redirect if authenticated)
const PublicRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  return !isAuthenticated ? children : <Navigate to="/dashboard" replace />;
};

// Authenticated shell that includes global widgets
const AuthenticatedShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  return (
    <>
      {children}
      {isAuthenticated && <AIAssistWidget />}
    </>
  );
};

const App: React.FC = () => {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthenticatedShell>
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

        {/* Protected Routes */}
        <Route
          path="/profile-setup"
          element={
            <ProtectedRoute>
              <ProfileSetup />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DriverMobileShell>
                <Outlet />
              </DriverMobileShell>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="active-ride" element={<ActiveRide />} />
          <Route path="account" element={<Account />} />
          <Route path="earnings" element={<Earnings />} />
          <Route path="history" element={<History />} />
          <Route path="profile" element={<Profile />} />
          <Route path="wallet" element={<Wallet />} />
        </Route>

        <Route path="/demo" element={<RideDemoPage />} />
        <Route path="/wallet/topup/return" element={<WalletTopUpReturn />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </AuthenticatedShell>
    </Router>
  );
};

export default App;
