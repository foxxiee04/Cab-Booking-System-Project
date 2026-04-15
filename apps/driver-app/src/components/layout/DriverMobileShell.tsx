import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppBar,
  Avatar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Chip,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Slide,
  Snackbar,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import type { SlideProps } from '@mui/material';
import {
  AttachMoneyRounded,
  AccountBalanceWalletRounded,
  DriveEtaRounded,
  HistoryRounded,
  LogoutRounded,
  PersonRounded,
  TranslateRounded,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout } from '../../store/auth.slice';
import { hideNotification } from '../../store/ui.slice';
import { driverApi } from '../../api/driver.api';
import { rideApi } from '../../api/ride.api';
import { setProfile } from '../../store/driver.slice';
import { clearPendingRide, setCurrentRide } from '../../store/ride.slice';
import { driverSocketService } from '../../socket/driver.socket';
import { formatCurrency } from '../../utils/format.utils';
import RideRequestModal from '../ride-request/RideRequestModal';
import { Ride } from '../../types';

interface DriverMobileShellProps {
  children: React.ReactNode;
}

const NAV_HEIGHT = 72;

const tabs = [
  { value: '/dashboard', icon: <DriveEtaRounded />, labelKey: 'dashboard.title', fallback: 'Tổng quan' },
  { value: '/history', icon: <HistoryRounded />, labelKey: 'history.title', fallback: 'Chuyến đi' },
  { value: '/earnings', icon: <AttachMoneyRounded />, labelKey: 'earnings.title', fallback: 'Thu nhập' },
  { value: '/wallet', icon: <AccountBalanceWalletRounded />, labelKey: 'wallet.title', fallback: 'Ví tiền' },
  { value: '/profile', icon: <PersonRounded />, labelKey: 'profile.title', fallback: 'Tài khoản' },
];

const resolveTab = (pathname: string) => {
  const match = tabs.find((tab) => pathname === tab.value || pathname.startsWith(`${tab.value}/`));
  return match?.value || '/dashboard';
};

const NOTIFICATION_STYLES = {
  success: { bg: '#ecfdf3', border: '#22c55e', title: '#166534', text: '#14532d', icon: '#16a34a' },
  info:    { bg: '#eff6ff', border: '#3b82f6', title: '#1d4ed8', text: '#1e3a8a', icon: '#2563eb' },
  warning: { bg: '#fff7ed', border: '#f59e0b', title: '#b45309', text: '#7c2d12', icon: '#d97706' },
  error:   { bg: '#fef2f2', border: '#ef4444', title: '#b91c1c', text: '#7f1d1d', icon: '#dc2626' },
};
const NOTIFICATION_TITLES = { success: 'Thành công', error: 'Có lỗi xảy ra', warning: 'Lưu ý', info: 'Thông báo' };
const NotifTransition = (props: SlideProps) => <Slide {...props} direction="down" />;

const getApprovalStatusTone = (status?: string) => {
  switch (status) {
    case 'APPROVED':
      return { color: 'success' as const, labelKey: 'profile.approved', fallback: 'Da duoc duyet' };
    case 'REJECTED':
      return { color: 'error' as const, labelKey: 'profile.rejected', fallback: 'Bi tu choi' };
    case 'SUSPENDED':
      return { color: 'default' as const, labelKey: 'profile.suspended', fallback: 'Tam khoa' };
    case 'PENDING':
    default:
      return { color: 'warning' as const, labelKey: 'profile.pendingApproval', fallback: 'Cho duyet ho so' };
  }
};

const DriverMobileShell: React.FC<DriverMobileShellProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { t, i18n } = useTranslation();
  const { user, accessToken } = useAppSelector((state) => state.auth);
  const { currentRide, pendingRide } = useAppSelector((state) => state.ride);
  const { isOnline, profile } = useAppSelector((state) => state.driver);
  const notification = useAppSelector((state) => state.ui.notification);

  const currentTab = resolveTab(location.pathname);

  const [profileAnchorEl, setProfileAnchorEl] = React.useState<null | HTMLElement>(null);
  const [langAnchorEl, setLangAnchorEl] = React.useState<null | HTMLElement>(null);

  // ── Global ride request popup ──────────────────────────────────────────
  const [newRidePopup, setNewRidePopup] = useState<Ride | null>(null);
  const [rideLoading, setRideLoading] = useState(false);
  const seenRidePopupIdsRef = useRef<Set<string>>(new Set());

  // Connect/disconnect socket based on online status (global, not per page)
  useEffect(() => {
    if (isOnline && accessToken) {
      driverSocketService.connect(accessToken);
    } else {
      driverSocketService.disconnect();
    }

    return () => {
      driverSocketService.disconnect();
    };
  }, [isOnline, accessToken]);

  // Show popup when a new pending ride arrives (regardless of current tab)
  useEffect(() => {
    if (newRidePopup || !isOnline || currentRide) {
      return;
    }

    if (pendingRide && !seenRidePopupIdsRef.current.has(pendingRide.id)) {
      seenRidePopupIdsRef.current.add(pendingRide.id);
      setNewRidePopup(pendingRide);

      // Browser notification
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const fareText = pendingRide.fare ? formatCurrency(pendingRide.fare) : '';
        const pickupText = pendingRide.pickupLocation?.address || 'Điểm đón gần bạn';
        const notification = new Notification('Có cuốc mới', { body: `${fareText} - ${pickupText}` });
        window.setTimeout(() => notification.close(), 7000);
      }
    }
  }, [currentRide, isOnline, newRidePopup, pendingRide]);

  const handleAcceptPopupRide = async () => {
    if (!newRidePopup) return;
    setRideLoading(true);
    try {
      const response = await rideApi.acceptRide(newRidePopup.id);
      const acceptedRide = response.data.ride;
      if (!acceptedRide?.pickupLocation?.lat || !acceptedRide?.dropoffLocation?.lat) {
        try {
          const fullRideRes = await rideApi.getRide(newRidePopup.id);
          dispatch(setCurrentRide(fullRideRes.data.ride));
        } catch {
          dispatch(setCurrentRide(acceptedRide));
        }
      } else {
        dispatch(setCurrentRide(acceptedRide));
      }
      dispatch(clearPendingRide());
      setNewRidePopup(null);
      navigate('/active-ride');
    } catch (err: any) {
      console.error('Accept ride from popup failed:', err);
      if (err.response?.status === 409 || err.response?.status === 404) {
        dispatch(clearPendingRide());
      }
    } finally {
      setRideLoading(false);
    }
  };

  const handleRejectPopupRide = () => {
    if (newRidePopup) {
      dispatch(clearPendingRide());
    }
    setNewRidePopup(null);
  };

  useEffect(() => {
    if (profile) {
      return;
    }

    let isMounted = true;

    const hydrateProfile = async () => {
      try {
        const response = await driverApi.getProfile();
        if (isMounted) {
          dispatch(setProfile(response.data.driver));
        }
      } catch {
        // Keep shell resilient on routes that do not require profile details.
      }
    };

    void hydrateProfile();

    return () => {
      isMounted = false;
    };
  }, [dispatch, profile]);

  const notifStyle = notification ? NOTIFICATION_STYLES[notification.type] : null;
  const handleNotifClose = (_: React.SyntheticEvent | Event, reason?: string) => {
    if (reason !== 'clickaway') dispatch(hideNotification());
  };

  const effectiveOnline = isOnline || profile?.isOnline || false;
  const approvalStatusTone = getApprovalStatusTone(profile?.status);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
    setProfileAnchorEl(null);
  };

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
    setLangAnchorEl(null);
  };

  const shellMaxWidth = { xs: '100%', md: 1160 };

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #f8fbff 0%, #eef6ff 42%, #ffffff 100%)',
      }}
    >
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          backgroundColor: 'rgba(255,255,255,0.76)',
          backdropFilter: 'blur(18px)',
          color: 'text.primary',
          borderBottom: '1px solid rgba(148, 163, 184, 0.18)',
        }}
      >
        <Toolbar sx={{ minHeight: 60, width: shellMaxWidth, mx: 'auto', px: { xs: 2, sm: 2.5 } }}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" sx={{ rowGap: 0.5 }}>
              <Typography variant="subtitle1" sx={{ color: 'primary.main', fontWeight: 900, letterSpacing: '0.04em' }}>
                CabDriver
              </Typography>
              <Chip
                size="small"
                color={currentRide ? 'primary' : effectiveOnline ? 'success' : 'default'}
                variant={currentRide || effectiveOnline ? 'filled' : 'outlined'}
                label={currentRide ? 'Đang có cuốc' : effectiveOnline ? 'Trực tuyến' : 'Ngoại tuyến'}
                sx={{ fontWeight: 700, fontSize: '0.7rem' }}
              />
            </Stack>
          </Box>

          <IconButton onClick={(event) => setLangAnchorEl(event.currentTarget)} sx={{ mr: 1 }}>
            <TranslateRounded />
          </IconButton>

          <IconButton onClick={(event) => setProfileAnchorEl(event.currentTarget)}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
              {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
            </Avatar>
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          pt: 'calc(68px + env(safe-area-inset-top))',
          pb: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom) + 56px)`,
          px: { xs: 1.5, sm: 2 },
          minHeight: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {profile?.status && profile.status !== 'APPROVED' && (
          <Box
            sx={{
              width: shellMaxWidth,
              mx: 'auto',
              mb: 1.5,
              px: 2,
              py: 1,
              borderRadius: 2,
              bgcolor: approvalStatusTone.color === 'error' ? '#fef2f2' : approvalStatusTone.color === 'warning' ? '#fffbeb' : '#f0f9ff',
              border: `1px solid ${approvalStatusTone.color === 'error' ? '#fca5a5' : approvalStatusTone.color === 'warning' ? '#fcd34d' : '#93c5fd'}`,
              textAlign: 'center',
            }}
          >
            <Typography variant="body2" fontWeight={700} sx={{ color: approvalStatusTone.color === 'error' ? '#b91c1c' : approvalStatusTone.color === 'warning' ? '#92400e' : '#1e40af' }}>
              {t(approvalStatusTone.labelKey, approvalStatusTone.fallback)}
            </Typography>
          </Box>
        )}
        <Box sx={{ minHeight: '100%', width: shellMaxWidth, mx: 'auto' }}>{children}</Box>
      </Box>

      <Paper
        elevation={16}
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          width: shellMaxWidth,
          mx: 'auto',
          bottom: 'calc(12px + env(safe-area-inset-bottom))',
          borderRadius: 4,
          overflow: 'hidden',
          backgroundColor: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(18px)',
          border: '1px solid rgba(148, 163, 184, 0.16)',
          zIndex: (theme) => theme.zIndex.appBar,
        }}
      >
        <BottomNavigation
          showLabels
          value={currentTab}
          onChange={(_event, value) => navigate(value)}
          sx={{ height: 72, bgcolor: 'transparent' }}
        >
          {tabs.map((tab) => (
            <BottomNavigationAction
              key={tab.value}
              value={tab.value}
              icon={tab.icon}
              label={t(tab.labelKey, tab.fallback)}
            />
          ))}
        </BottomNavigation>
      </Paper>

      <Menu anchorEl={profileAnchorEl} open={Boolean(profileAnchorEl)} onClose={() => setProfileAnchorEl(null)}>
        <MenuItem disabled sx={{ opacity: 1 }}>
          <Box>
            <Typography variant="subtitle2" fontWeight={700}>
              {user?.firstName} {user?.lastName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {user?.email}
            </Typography>
          </Box>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { navigate('/profile'); setProfileAnchorEl(null); }}>
          <PersonRounded fontSize="small" style={{ marginRight: 8 }} />
          {t('shell.accountCenter', 'Hồ sơ tài xế')}
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <LogoutRounded fontSize="small" style={{ marginRight: 8 }} />
          {t('dashboard.logout', 'Đăng xuất')}
        </MenuItem>
      </Menu>

      <Menu anchorEl={langAnchorEl} open={Boolean(langAnchorEl)} onClose={() => setLangAnchorEl(null)}>
        <MenuItem onClick={() => handleLanguageChange('vi')} selected={i18n.language === 'vi'}>
          Tiếng Việt
        </MenuItem>
        <MenuItem onClick={() => handleLanguageChange('en')} selected={i18n.language === 'en'}>
          English
        </MenuItem>
      </Menu>

      {/* Global notification Snackbar — mirrors customer app style */}
      <Snackbar
        open={Boolean(notification)}
        onClose={handleNotifClose}
        autoHideDuration={notification?.persistMs ?? 5000}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        TransitionComponent={NotifTransition}
        sx={{ top: { xs: 70, sm: 80 } }}
      >
        <Alert
          severity={notification?.type ?? 'info'}
          variant="standard"
          onClose={handleNotifClose}
          sx={{
            width: '100%',
            minWidth: { xs: 'min(92vw, 320px)', sm: 380 },
            borderRadius: 3,
            border: `1.5px solid ${notifStyle?.border ?? '#3b82f6'}`,
            backgroundColor: notifStyle?.bg ?? '#eff6ff',
            boxShadow: '0 22px 48px rgba(15,23,42,0.24)',
            '& .MuiAlert-icon': { color: notifStyle?.icon ?? '#2563eb' },
          }}
        >
          <Typography variant="subtitle2" fontWeight={800} sx={{ color: notifStyle?.title ?? '#1d4ed8' }}>
            {notification?.title || NOTIFICATION_TITLES[notification?.type ?? 'info']}
          </Typography>
          <Typography variant="body2" sx={{ color: notifStyle?.text ?? '#1e3a8a' }}>
            {notification?.message}
          </Typography>
        </Alert>
      </Snackbar>

      {/* Global ride request popup — visible on all tabs */}
      <RideRequestModal
        ride={newRidePopup}
        timeoutSeconds={20}
        open={Boolean(newRidePopup)}
        loading={rideLoading}
        onAccept={handleAcceptPopupRide}
        onReject={handleRejectPopupRide}
        onTimeout={() => setNewRidePopup(null)}
      />
    </Box>
  );
};

export default DriverMobileShell;