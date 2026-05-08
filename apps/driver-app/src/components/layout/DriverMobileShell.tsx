import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppBar,
  Avatar,
  Badge,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
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
  BlockRounded,
  CheckCircleOutlineRounded,
  DriveEtaRounded,
  HistoryRounded,
  HourglassTopRounded,
  LogoutRounded,
  NotificationsRounded,
  PersonRounded,
  TranslateRounded,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout } from '../../store/auth.slice';
import {
  hideNotification,
  markAllNotificationsRead,
  showNotification,
} from '../../store/ui.slice';
import { driverApi } from '../../api/driver.api';
import { rideApi } from '../../api/ride.api';

import { walletApi } from '../../api/wallet.api';
import { setProfile } from '../../store/driver.slice';
import { clearPendingRide, setCurrentRide } from '../../store/ride.slice';
import { driverSocketService } from '../../socket/driver.socket';
import { WalletBalance } from '../../api/wallet.api';
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
  { value: '/account', icon: <PersonRounded />, labelKey: 'profile.title', fallback: 'Tài khoản' },
];

const resolveTab = (pathname: string) => {
  if (pathname === '/profile' || pathname.startsWith('/profile/')) {
    return '/account';
  }

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

const formatNotificationTimestamp = (createdAt: string) => {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return 'Vừa xong';
  }

  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
};


const DriverMobileShell: React.FC<DriverMobileShellProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { t, i18n } = useTranslation();
  const { user, accessToken } = useAppSelector((state) => state.auth);
  const { currentRide, pendingRide, revokedFeedRideIds } = useAppSelector((state) => state.ride);
  const { isOnline, profile } = useAppSelector((state) => state.driver);
  const { notification, notificationHistory } = useAppSelector((state) => state.ui);

  const currentTab = resolveTab(location.pathname);
  const unreadNotificationCount = notificationHistory.filter((item) => !item.read).length;

  const [profileAnchorEl, setProfileAnchorEl] = React.useState<null | HTMLElement>(null);
  const [langAnchorEl, setLangAnchorEl] = React.useState<null | HTMLElement>(null);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [walletState, setWalletState] = React.useState<WalletBalance | null>(null);

  // effectiveOnline: true when either Redux online flag or profile.isOnline is set
  const effectiveOnline = isOnline || Boolean(profile?.isOnline);

  // ── Global ride request popup ──────────────────────────────────────────
  const [newRidePopup, setNewRidePopup] = useState<Ride | null>(null);
  const [rideLoading, setRideLoading] = useState(false);
  const seenRidePopupIdsRef = useRef<Set<string>>(new Set());
  const previousApprovalStatusRef = useRef<string | null>(null);

  // Keep socket connected for all authenticated drivers so approval changes arrive without reload.
  useEffect(() => {
    if (accessToken) {
      driverSocketService.connect(accessToken);
    } else {
      driverSocketService.disconnect();
    }

    return () => {
      driverSocketService.disconnect();
    };
  }, [accessToken]);

  // Show popup when a new pending ride arrives (regardless of current tab)
  useEffect(() => {
    if (newRidePopup || !effectiveOnline || currentRide) {
      return;
    }

    if (pendingRide && !seenRidePopupIdsRef.current.has(pendingRide.id)) {
      seenRidePopupIdsRef.current.add(pendingRide.id);
      setNewRidePopup(pendingRide);
      dispatch(showNotification({
        type: 'info',
        title: 'Có cuốc xe mới',
        message: `${pendingRide.pickupLocation?.address || 'Điểm đón gần bạn'}${pendingRide.fare ? ` - ${formatCurrency(pendingRide.fare)}` : ''}`,
        rideId: pendingRide.id,
        persistMs: 7000,
      }));

      // Browser notification
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const fareText = pendingRide.fare ? formatCurrency(pendingRide.fare) : '';
        const pickupText = pendingRide.pickupLocation?.address || 'Điểm đón gần bạn';
        const notification = new Notification('Có cuốc mới', { body: `${fareText} - ${pickupText}` });
        window.setTimeout(() => notification.close(), 7000);
      }
    }
  }, [currentRide, dispatch, effectiveOnline, newRidePopup, pendingRide]);

  useEffect(() => {
    if (!newRidePopup?.id) {
      return;
    }
    if (revokedFeedRideIds.includes(newRidePopup.id)) {
      setNewRidePopup(null);
    }
  }, [newRidePopup, revokedFeedRideIds]);

  useEffect(() => {
    if (!pendingRide || !newRidePopup || pendingRide.id !== newRidePopup.id) {
      return;
    }

    if (
      pendingRide !== newRidePopup
      && (
        pendingRide.customer?.phoneNumber !== newRidePopup.customer?.phoneNumber
        || pendingRide.customer?.avatar !== newRidePopup.customer?.avatar
        || pendingRide.customer?.firstName !== newRidePopup.customer?.firstName
        || pendingRide.fare !== newRidePopup.fare
      )
    ) {
      setNewRidePopup(pendingRide);
    }
  }, [newRidePopup, pendingRide]);

  useEffect(() => {
    if (!pendingRide && !newRidePopup && !currentRide) {
      seenRidePopupIdsRef.current.clear();
    }
  }, [currentRide, newRidePopup, pendingRide]);

  const handleAcceptPopupRide = async () => {
    if (!newRidePopup) return;
    setRideLoading(true);
    try {
      const response = await rideApi.acceptRide(newRidePopup.id);
      const acceptedRide = response.data.ride;
      if (
        !acceptedRide?.pickupLocation?.lat
        || !acceptedRide?.dropoffLocation?.lat
        || !acceptedRide?.customer?.firstName
      ) {
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
      // Notify server immediately so re-dispatch skips this driver without waiting 30s timeout
      rideApi.declineOffer(newRidePopup.id).catch(() => {});
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

  useEffect(() => {
    previousApprovalStatusRef.current = null;
  }, [user?.id]);

  useEffect(() => {
    const currentApprovalStatus = profile?.status || null;

    if (!currentApprovalStatus) {
      previousApprovalStatusRef.current = null;
      return;
    }

    const previousApprovalStatus = previousApprovalStatusRef.current;
    previousApprovalStatusRef.current = currentApprovalStatus;

    if (!previousApprovalStatus || previousApprovalStatus === currentApprovalStatus) {
      return;
    }

    if (currentApprovalStatus === 'APPROVED') {
      dispatch(showNotification({
        type: 'success',
        title: 'Hồ sơ đã được duyệt',
        message: 'Tài khoản tài xế đã được duyệt. Bạn có thể bật trực tuyến và nhận chuyến ngay.',
        persistMs: 7000,
      }));
      return;
    }

    if (currentApprovalStatus === 'REJECTED') {
      dispatch(showNotification({
        type: 'warning',
        title: 'Hồ sơ cần cập nhật',
        message: 'Hồ sơ tài xế chưa được duyệt. Vui lòng kiểm tra lại thông tin hồ sơ.',
        persistMs: 7000,
      }));
    }
  }, [dispatch, profile?.status]);

  useEffect(() => {
    if (!accessToken || profile?.status !== 'PENDING') {
      return;
    }

    let isMounted = true;
    let isFetching = false;

    const syncPendingApprovalStatus = async () => {
      if (isFetching) {
        return;
      }

      isFetching = true;
      try {
        const response = await driverApi.getProfile();
        if (!isMounted) {
          return;
        }

        const nextProfile = response.data.driver;
        if (nextProfile?.status && nextProfile.status !== profile.status) {
          dispatch(setProfile(nextProfile));
        }
      } catch {
        // Keep the shell usable while waiting for approval sync.
      } finally {
        isFetching = false;
      }
    };

    void syncPendingApprovalStatus();
    const intervalId = window.setInterval(() => {
      void syncPendingApprovalStatus();
    }, 3000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [accessToken, dispatch, profile?.status]);

  useEffect(() => {
    if (!accessToken) {
      setWalletState(null);
      return;
    }

    let isMounted = true;

    const hydrateWalletBalance = async () => {
      try {
        const [balanceResponse, transactionsResponse] = await Promise.all([
          walletApi.getBalance(),
          walletApi.getTransactions(1, 0),
        ]);

        if (isMounted) {
          const walletData = balanceResponse.data?.data ?? (balanceResponse.data as any);
          setWalletState(walletData);

          const txPayload = transactionsResponse.data?.data ?? (transactionsResponse.data as any);
          const latestTransaction = txPayload?.transactions?.[0];
          if (
            user?.id
            && latestTransaction?.type === 'COMMISSION'
            && latestTransaction.id
          ) {
            const notificationKey = `wallet:commission-deduction:${user.id}:${latestTransaction.id}`;
            if (!sessionStorage.getItem(notificationKey)) {
              sessionStorage.setItem(notificationKey, '1');
              dispatch(showNotification({
                type: 'info',
                title: 'Đã khấu trừ vào ví',
                message: `${latestTransaction.description || 'Ví vừa được khấu trừ công nợ chuyến tiền mặt.'} ${formatCurrency(latestTransaction.amount)}. Số dư hiện tại: ${formatCurrency(walletData.balance)}.`,
                persistMs: 7000,
              }));
            }
          }
        }
      } catch {
        if (isMounted) {
          setWalletState(null);
        }
      }
    };

    void hydrateWalletBalance();

    return () => {
      isMounted = false;
    };
  }, [accessToken, dispatch, location.pathname, user?.id]);

  const walletBalance = walletState ? Number(walletState.balance ?? 0) : null;
  const walletOperationalBalance = walletState ? Number(walletState.operationalBalance ?? walletState.availableBalance ?? walletState.balance ?? 0) : null;
  const activationThreshold = walletState?.activationThreshold ?? 300_000;
  const debtLimit = walletState?.debtLimit ?? -200_000;
  const hasDriverBlockingStatus = ['REJECTED', 'SUSPENDED'].includes(profile?.status || '');

  useEffect(() => {
    if (hasDriverBlockingStatus || !user?.id || walletBalance === null || !walletState?.activationRequired) {
      return;
    }

    const remainingAmount = Math.max(activationThreshold - walletBalance, 0);
    const warningKey = `wallet:activation-warning:${user.id}:${walletBalance}`;
    if (sessionStorage.getItem(warningKey)) {
      return;
    }

    sessionStorage.setItem(warningKey, '1');
    dispatch(showNotification({
      type: 'warning',
      title: 'Nạp để kích hoạt tài khoản',
      message: remainingAmount > 0
        ? `Ví hiện có ${formatCurrency(walletBalance)}. Nạp thêm ${formatCurrency(remainingAmount)} để kích hoạt}.`
        : 'Ví tài xế chưa đạt điều kiện kích hoạt. Vui lòng kiểm tra lại số dư ví.',
      persistMs: 7000,
    }));
  }, [activationThreshold, dispatch, hasDriverBlockingStatus, user?.id, walletBalance, walletState?.activationRequired]);

  useEffect(() => {
    if (
      hasDriverBlockingStatus
      || !user?.id
      || walletOperationalBalance === null
      || !walletState?.warningThresholdReached
      || walletState.canAcceptRide === false
    ) {
      return;
    }

    const warningKey = `wallet:debt-warning:${user.id}:${walletOperationalBalance}`;
    if (sessionStorage.getItem(warningKey)) {
      return;
    }

    sessionStorage.setItem(warningKey, '1');
    dispatch(showNotification({
      type: 'warning',
      title: 'Ví sắp chạm ngưỡng khóa',
      message: `Số dư vận hành hiện tại là ${formatCurrency(walletOperationalBalance)}. Tài khoản vẫn hoạt động, nhưng bạn nên nạp thêm trước khi chạm mốc khóa ${formatCurrency(debtLimit)}.`,
      persistMs: 7000,
    }));
  }, [debtLimit, dispatch, hasDriverBlockingStatus, user?.id, walletOperationalBalance, walletState?.canAcceptRide, walletState?.warningThresholdReached]);

  useEffect(() => {
    if (hasDriverBlockingStatus || !user?.id || !walletState?.hasOverdueDebt) return;
    const warningKey = `wallet:overdue-debt:${user.id}`;
    if (sessionStorage.getItem(warningKey)) return;
    sessionStorage.setItem(warningKey, '1');
    dispatch(showNotification({
      type: 'error',
      title: 'Công nợ quá hạn',
      message: 'Bạn có khoản công nợ quá hạn. Vui lòng vào mục Ví tiền để xem chi tiết và thanh toán.',
      persistMs: 10000,
    }));
  }, [dispatch, hasDriverBlockingStatus, user?.id, walletState?.hasOverdueDebt]);

  const notifStyle = notification ? NOTIFICATION_STYLES[notification.type] : null;
  const handleNotifClose = (_: React.SyntheticEvent | Event, reason?: string) => {
    if (reason !== 'clickaway') dispatch(hideNotification());
  };

  const handleOpenNotifications = () => {
    setNotificationsOpen(true);
  };

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
        background: 'linear-gradient(180deg, #f8fbff 0%, #f5f5f5 42%, #ffffff 100%)',
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
                FoxGo Tài xế
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

          <IconButton onClick={handleOpenNotifications} sx={{ mr: 1 }}>
            <Badge color="error" badgeContent={unreadNotificationCount} max={99}>
              <NotificationsRounded />
            </Badge>
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
        {/* ── PENDING approval gate ─────────────────────────────────── */}
        {profile?.status === 'PENDING' && (
          <Box sx={{ width: shellMaxWidth, mx: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', px: 2, textAlign: 'center', gap: 3 }}>
            <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HourglassTopRounded sx={{ fontSize: 44, color: 'primary.main', animation: 'pulse 2s infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.5 } } }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={800} gutterBottom>Hồ sơ đang chờ duyệt</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320 }}>
                Hồ sơ tài xế của bạn đã được gửi và đang chờ admin xét duyệt. Quá trình thường mất 1–2 ngày làm việc.
              </Typography>
            </Box>
            <Box sx={{ bgcolor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 3, p: 2, width: '100%', maxWidth: 320 }}>
              <Stack spacing={1}>
                {[
                  { icon: <CheckCircleOutlineRounded sx={{ color: 'success.main', fontSize: 18 }} />, text: 'Hồ sơ đã nộp thành công' },
                  { icon: <HourglassTopRounded sx={{ color: 'primary.main', fontSize: 18 }} />, text: 'Admin đang xét duyệt' },
                  { icon: <AccountBalanceWalletRounded sx={{ color: 'text.disabled', fontSize: 18 }} />, text: 'Sau khi duyệt: nạp 300k ký quỹ' },
                  { icon: <DriveEtaRounded sx={{ color: 'text.disabled', fontSize: 18 }} />, text: 'Sau nạp ký quỹ: bắt đầu nhận cuốc' },
                ].map((step, i) => (
                  <Stack key={i} direction="row" spacing={1} alignItems="center">
                    {step.icon}
                    <Typography variant="body2" color={i < 2 ? 'text.primary' : 'text.disabled'}>{step.text}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
            <Typography variant="caption" color="text.disabled">Trang tự động cập nhật khi hồ sơ được duyệt</Typography>
            <Button variant="outlined" size="small" onClick={handleLogout} startIcon={<LogoutRounded />} sx={{ borderRadius: 3 }}>
              Đăng xuất
            </Button>
          </Box>
        )}

        {/* ── REJECTED gate ─────────────────────────────────────────── */}
        {profile?.status === 'REJECTED' && (
          <Box sx={{ width: shellMaxWidth, mx: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', px: 2, textAlign: 'center', gap: 3 }}>
            <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BlockRounded sx={{ fontSize: 44, color: 'error.main' }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={800} color="error.dark" gutterBottom>Hồ sơ bị từ chối</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320 }}>
                Hồ sơ tài xế của bạn chưa được phê duyệt. Vui lòng kiểm tra lại thông tin và liên hệ bộ phận hỗ trợ để biết thêm chi tiết.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.5}>
              <Button variant="outlined" color="error" size="small" onClick={() => navigate('/profile')} sx={{ borderRadius: 3 }}>
                Xem hồ sơ
              </Button>
              <Button variant="outlined" size="small" onClick={handleLogout} startIcon={<LogoutRounded />} sx={{ borderRadius: 3 }}>
                Đăng xuất
              </Button>
            </Stack>
          </Box>
        )}

        {/* ── Normal content (APPROVED / SUSPENDED) ─────────────────── */}
        {profile?.status !== 'PENDING' && profile?.status !== 'REJECTED' && (
          <>
            {profile?.status === 'SUSPENDED' && (
              <Box sx={{ width: shellMaxWidth, mx: 'auto', mb: 1.5, px: 2, py: 1, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                <Typography variant="body2" fontWeight={700} color="text.secondary">
                  Tài khoản đang bị tạm khóa. Vui lòng liên hệ hỗ trợ.
                </Typography>
              </Box>
            )}
            {walletState?.activationRequired && walletBalance !== null && (
              <Alert severity="warning" sx={{ width: shellMaxWidth, mx: 'auto', mb: 1.5, borderRadius: 3 }}
                action={<Button color="inherit" size="small" sx={{ fontWeight: 700 }} onClick={() => navigate('/wallet')}>Nạp để kích hoạt</Button>}>
                Chưa kích hoạt ví. Nạp tối thiểu {formatCurrency(activationThreshold)} để bắt đầu nhận cuốc.
              </Alert>
            )}
            {!walletState?.activationRequired && walletState?.warningThresholdReached && walletState?.canAcceptRide !== false && walletOperationalBalance !== null && (
              <Alert severity="warning" sx={{ width: shellMaxWidth, mx: 'auto', mb: 1.5, borderRadius: 3 }}
                action={<Button color="inherit" size="small" sx={{ fontWeight: 700 }} onClick={() => navigate('/wallet')}>Nạp ví</Button>}>
                Số dư vận hành đang âm ({formatCurrency(walletOperationalBalance)}). Nạp thêm trước khi chạm ngưỡng khóa {formatCurrency(debtLimit)}.
              </Alert>
            )}
            {!walletState?.activationRequired && walletState?.canAcceptRide === false && walletOperationalBalance !== null && (
              <Alert severity="error" sx={{ width: shellMaxWidth, mx: 'auto', mb: 1.5, borderRadius: 3 }}
                action={<Button color="inherit" size="small" sx={{ fontWeight: 700 }} onClick={() => navigate('/wallet')}>Nạp ví</Button>}>
                Ví đã chạm ngưỡng khóa {formatCurrency(debtLimit)}. Nạp thêm để bật lại nhận cuốc.
              </Alert>
            )}
            <Box sx={{ minHeight: '100%', width: shellMaxWidth, mx: 'auto' }}>{children}</Box>
          </>
        )}
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
        <MenuItem onClick={() => { navigate('/account'); setProfileAnchorEl(null); }}>
          <PersonRounded fontSize="small" style={{ marginRight: 8 }} />
          {t('shell.accountCenter', 'Tài khoản')}
        </MenuItem>
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

      <Drawer
        anchor="right"
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: 'min(92vw, 360px)', sm: 380 },
            background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)',
          },
        }}
      >
        <Box sx={{ px: 2, py: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Box>
              <Typography variant="h6" fontWeight={800}>
                Thông báo
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {notificationHistory.length === 0
                  ? 'Chưa có thông báo nào được lưu.'
                  : `${notificationHistory.length} thông báo`}
              </Typography>
            </Box>
            {unreadNotificationCount > 0 && (
              <Button size="small" onClick={() => dispatch(markAllNotificationsRead())}>
                Đánh dấu đã đọc
              </Button>
            )}
          </Stack>
        </Box>
        <Divider />
        {notificationHistory.length === 0 ? (
          <Box sx={{ px: 2.5, py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              Các thông báo popup, nạp ví, cảnh báo tài khoản và cập nhật chuyến xe sẽ được lưu ở đây.
            </Typography>
          </Box>
        ) : (
          <List sx={{ py: 0 }}>
            {notificationHistory.map((item) => {
              const itemStyle = NOTIFICATION_STYLES[item.type];
              return (
                <ListItemButton
                  key={item.id}
                  alignItems="flex-start"
                  sx={{
                    px: 2,
                    py: 1.5,
                    borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
                    bgcolor: item.read ? 'transparent' : itemStyle.bg,
                    alignItems: 'flex-start',
                  }}
                >
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: itemStyle.icon,
                      mt: 0.9,
                      mr: 1.5,
                      flexShrink: 0,
                    }}
                  />
                  <ListItemText
                    disableTypography
                    primary={
                      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                        <Typography variant="subtitle2" fontWeight={800} sx={{ color: itemStyle.title }}>
                          {item.title || NOTIFICATION_TITLES[item.type]}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                          {formatNotificationTimestamp(item.createdAt)}
                        </Typography>
                      </Stack>
                    }
                    secondary={
                      <Typography variant="body2" sx={{ color: itemStyle.text, mt: 0.5 }}>
                        {item.message}
                      </Typography>
                    }
                  />
                </ListItemButton>
              );
            })}
          </List>
        )}
      </Drawer>

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
