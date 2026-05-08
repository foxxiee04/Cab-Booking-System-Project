import React from 'react';
import {
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
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import {
  HomeRounded,
  LocalOfferRounded,
  LogoutRounded,
  NotificationsRounded,
  PersonRounded,
  ReceiptLongRounded,
  TranslateRounded,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout } from '../../store/auth.slice';
import { markAllNotificationsRead } from '../../store/ui.slice';

interface MobileAppShellProps {
  children: React.ReactNode;
}

const tabs = [
  { value: '/home', icon: <HomeRounded />, labelKey: 'shell.home', fallback: 'Trang chủ' },
  { value: '/activity', icon: <ReceiptLongRounded />, labelKey: 'shell.activity', fallback: 'Hoạt động' },
  { value: '/vouchers', icon: <LocalOfferRounded />, labelKey: 'shell.vouchers', fallback: 'Ưu đãi' },
  { value: '/profile', icon: <PersonRounded />, labelKey: 'shell.profile', fallback: 'Tài khoản' },
];

const secondaryViews = [
  { value: '/history', tab: '/activity', labelKey: 'rideHistory.title', fallback: 'Lịch sử chuyến đi' },
  { value: '/ride', tab: '/home', labelKey: 'rideTracking.title', fallback: 'Theo dõi chuyến' },
];

const resolveTab = (pathname: string) => {
  const match = tabs.find((tab) => pathname === tab.value || pathname.startsWith(`${tab.value}/`));
  return match?.value || '/home';
};

const resolveView = (pathname: string) => {
  const secondaryView = secondaryViews.find((view) => pathname === view.value || pathname.startsWith(`${view.value}/`));
  if (secondaryView) {
    return secondaryView;
  }

  const tab = tabs.find((item) => item.value === resolveTab(pathname)) || tabs[0];
  return {
    value: tab.value,
    tab: tab.value,
    labelKey: tab.labelKey,
    fallback: tab.fallback,
  };
};

const NOTIFICATION_STYLES = {
  success: { bg: '#ecfdf3', border: '#22c55e', title: '#166534', text: '#14532d', icon: '#16a34a' },
  info: { bg: '#eff6ff', border: '#3b82f6', title: '#1d4ed8', text: '#1e3a8a', icon: '#2563eb' },
  warning: { bg: '#fff7ed', border: '#f59e0b', title: '#b45309', text: '#7c2d12', icon: '#d97706' },
  error: { bg: '#fef2f2', border: '#ef4444', title: '#b91c1c', text: '#7f1d1d', icon: '#dc2626' },
};

const NOTIFICATION_TITLES = {
  success: 'Cập nhật chuyến đi',
  error: 'Có lỗi xảy ra',
  warning: 'Lưu ý',
  info: 'Thông báo',
};

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

const MobileAppShell: React.FC<MobileAppShellProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { t, i18n } = useTranslation();
  const { user } = useAppSelector((state) => state.auth);
  const { currentRide } = useAppSelector((state) => state.ride);
  const { notificationHistory } = useAppSelector((state) => state.ui);

  const currentView = resolveView(location.pathname);
  const currentTab = currentView.tab;
  const unreadNotificationCount = notificationHistory.filter((item) => !item.read).length;

  const [profileAnchorEl, setProfileAnchorEl] = React.useState<null | HTMLElement>(null);
  const [langAnchorEl, setLangAnchorEl] = React.useState<null | HTMLElement>(null);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);

  const handleOpenNotifications = () => {
    setNotificationsOpen(true);
  };

  const handleNotificationSelect = (rideId?: string) => {
    setNotificationsOpen(false);
    if (rideId) {
      navigate(`/ride/${rideId}`);
    }
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
        background: (theme: any) => `linear-gradient(180deg, ${theme.palette.background.default} 0%, ${theme.palette.background.paper} 100%)`,
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
        <Toolbar sx={{ minHeight: 76, width: shellMaxWidth, mx: 'auto', px: { xs: 2, sm: 2.5 } }}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 800, letterSpacing: '0.12em' }}>
              FoxGo
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.15 }}>
              {t(currentView.labelKey, currentView.fallback)}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
              <Chip
                size="small"
                color={currentRide ? 'primary' : 'success'}
                variant={currentRide ? 'filled' : 'outlined'}
                label={currentRide ? t('shell.currentRide', 'Đang có chuyến') : t('shell.ready', 'Sẵn sàng đặt xe')}
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
            <Avatar src={user?.avatar} sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
              {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
            </Avatar>
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minHeight: 0,
          overflowY: 'auto',
          pt: 'calc(88px + env(safe-area-inset-top))',
          pb: 'calc(128px + env(safe-area-inset-bottom))',
          px: { xs: 1.5, sm: 2 },
        }}
      >
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
          {t('shell.accountCenter', 'Trung tâm tài khoản')}
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <LogoutRounded fontSize="small" style={{ marginRight: 8 }} />
          {t('menu.logout')}
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
            background: 'linear-gradient(180deg, rgba(255,255,255,0.97) 0%, #ffffff 100%)',
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
          </Box>
        ) : (
          <List sx={{ py: 0 }}>
            {notificationHistory.map((item) => {
              const itemStyle = NOTIFICATION_STYLES[item.type];
              return (
                <ListItemButton
                  key={item.id}
                  alignItems="flex-start"
                  onClick={() => handleNotificationSelect(item.rideId)}
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
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="body2" sx={{ color: itemStyle.text }}>
                          {item.message}
                        </Typography>
                        {item.rideId && (
                          <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, display: 'block', mt: 0.75 }}>
                            Mở chi tiết chuyến đi
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItemButton>
              );
            })}
          </List>
        )}
      </Drawer>
    </Box>
  );
};

export default MobileAppShell;