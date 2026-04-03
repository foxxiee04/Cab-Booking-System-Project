import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Badge,
  Popover,
  Paper,
  Stack,
  Chip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  DirectionsCar,
  People,
  DriveEta,
  AttachMoney,
  TrendingUp,
  Article,
  Logout,
  AccountCircle,
  AdminPanelSettings,
  FactCheck,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAppSelector, useAppDispatch } from './store/hooks';
import { logout } from './store/auth.slice';
import { adminSocketService } from './socket/admin.socket';
import { adminApi } from './api/admin.api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Rides from './pages/Rides';
import Drivers from './pages/Drivers';
import DriverApprovals from './pages/DriverApprovals';
import Customers from './pages/Customers';
import Payments from './pages/Payments';
import Pricing from './pages/Pricing';
import Logs from './pages/Logs';
import Profile from './pages/Profile';

const DRAWER_WIDTH = 260;

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const PublicRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  return !isAuthenticated ? children : <Navigate to="/dashboard" replace />;
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifs, setRecentNotifs] = useState<Array<{ id: string; title: string; detail: string; tone: string; timestamp: string }>>([]);
  const maxNotifHistory = 20;
  const { t } = useTranslation();

  // Subscribe to realtime admin events for notification bell
  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = adminSocketService.subscribeToEvents((event) => {
      setUnreadCount((n) => n + 1);
      setRecentNotifs((prev) => [event, ...prev].slice(0, maxNotifHistory));
    });
    return unsub;
  }, [isAuthenticated]);

  // Fetch pending driver approvals count
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchCount = async () => {
      try {
        const res = await adminApi.getDrivers({ status: 'PENDING', limit: 1, offset: 0 });
        const drivers = res.data?.drivers || [];
        // API may return total count in meta; fall back to array length
        const total = (res.data as any)?.total ?? (res.data as any)?.meta?.total ?? drivers.length;
        setPendingApprovalCount(total);
      } catch {
        // non-critical
      }
    };
    void fetchCount();
    const id = window.setInterval(() => void fetchCount(), 30_000);
    return () => window.clearInterval(id);
  }, [isAuthenticated]);

  const handleLogout = () => {
    dispatch(logout());
    adminSocketService.disconnect();
    navigate('/login');
  };

  const menuItems = [
    { text: t('menu.dashboard'), icon: <DashboardIcon />, path: '/dashboard' },
    { text: t('menu.profile'), icon: <AccountCircle />, path: '/profile' },
    { text: t('menu.rides'), icon: <DirectionsCar />, path: '/rides' },
    { text: t('menu.drivers'), icon: <DriveEta />, path: '/drivers' },
    {
      text: t('menu.approvals'),
      icon: (
        <Badge badgeContent={pendingApprovalCount} color="error" max={99}>
          <FactCheck />
        </Badge>
      ),
      path: '/driver-approvals',
    },
    { text: t('menu.customers'), icon: <People />, path: '/customers' },
    { text: t('menu.payments'), icon: <AttachMoney />, path: '/payments' },
    { text: t('menu.pricing'), icon: <TrendingUp />, path: '/pricing' },
    { text: t('menu.logs'), icon: <Article />, path: '/logs' },
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: `calc(100% - ${DRAWER_WIDTH}px)`,
          ml: `${DRAWER_WIDTH}px`,
        }}
      >
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {t('app.title')}
          </Typography>

          {/* Notification Bell */}
          <IconButton
            sx={{ color: 'white', mr: 1 }}
            onClick={(e) => {
              setNotifAnchorEl(e.currentTarget);
              setUnreadCount(0);
            }}
          >
            <Badge badgeContent={unreadCount} color="error" max={99}>
              <NotificationsIcon />
            </Badge>
          </IconButton>
          <Popover
            open={Boolean(notifAnchorEl)}
            anchorEl={notifAnchorEl}
            onClose={() => setNotifAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{ sx: { width: 360, maxHeight: 480, borderRadius: 2 } }}
          >
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle1" fontWeight={700}>Thông báo</Typography>
            </Box>
            {recentNotifs.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">Chưa có thông báo mới</Typography>
              </Box>
            ) : (
              <Stack sx={{ maxHeight: 400, overflow: 'auto' }}>
                {recentNotifs.map((notif) => (
                  <Box
                    key={notif.id}
                    sx={{
                      px: 2, py: 1.5,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Chip
                        size="small"
                        label={notif.title}
                        color={notif.tone === 'success' ? 'success' : notif.tone === 'warning' ? 'warning' : 'info'}
                        sx={{ fontWeight: 700, fontSize: 11 }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto !important' }}>
                        {new Date(notif.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">{notif.detail}</Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Popover>

          <IconButton
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{ color: 'white' }}
          >
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
              {user?.firstName?.[0]}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
          >
            <MenuItem disabled>
              <AccountCircle sx={{ mr: 1 }} />
              {`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'Admin'}
            </MenuItem>
            <MenuItem onClick={() => { setAnchorEl(null); navigate('/profile'); }}>
              <AccountCircle sx={{ mr: 1 }} />
              {t('menu.profile')}
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <Logout sx={{ mr: 1 }} />
              {t('menu.logout')}
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Toolbar sx={{ justifyContent: 'center', py: 2 }}>
          <AdminPanelSettings sx={{ fontSize: 32, color: 'primary.main', mr: 1 }} />
          <Typography variant="h6" fontWeight="bold">
            {t('app.admin')}
          </Typography>
        </Toolbar>
        <Divider />
        <List>
          {menuItems.map((item) => (
            <ListItemButton
              key={item.text}
              onClick={() => {
                navigate(item.path);
                if (item.path === '/driver-approvals') setPendingApprovalCount(0);
              }}
              selected={window.location.pathname === item.path}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: 'background.default',
          minHeight: '100vh',
          mt: 8,
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: 1440,
            mx: 'auto',
            px: { xs: 2, md: 3 },
            pb: { xs: 2, md: 3 },
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

const App: React.FC = () => {
  const { isAuthenticated, accessToken } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      adminSocketService.connect(accessToken);
    }

    return () => {
      adminSocketService.disconnect();
    };
  }, [isAuthenticated, accessToken]);

  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Layout>
                <Profile />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/rides"
          element={
            <ProtectedRoute>
              <Layout>
                <Rides />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/drivers"
          element={
            <ProtectedRoute>
              <Layout>
                <Drivers />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/driver-approvals"
          element={
            <ProtectedRoute>
              <Layout>
                <DriverApprovals />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers"
          element={
            <ProtectedRoute>
              <Layout>
                <Customers />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/payments"
          element={
            <ProtectedRoute>
              <Layout>
                <Payments />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/pricing"
          element={
            <ProtectedRoute>
              <Layout>
                <Pricing />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/logs"
          element={
            <ProtectedRoute>
              <Layout>
                <Logs />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
