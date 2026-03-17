import React from 'react';
import {
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
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import {
  ChatBubbleOutlineRounded,
  HomeRounded,
  LogoutRounded,
  PersonRounded,
  ReceiptLongRounded,
  TranslateRounded,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout } from '../../store/auth.slice';

interface MobileAppShellProps {
  children: React.ReactNode;
}

const tabs = [
  { value: '/home', icon: <HomeRounded />, labelKey: 'shell.home', fallback: 'Trang chủ' },
  { value: '/activity', icon: <ReceiptLongRounded />, labelKey: 'shell.activity', fallback: 'Hoạt động' },
  { value: '/messages', icon: <ChatBubbleOutlineRounded />, labelKey: 'shell.messages', fallback: 'Tin nhắn' },
  { value: '/profile', icon: <PersonRounded />, labelKey: 'shell.profile', fallback: 'Tài khoản' },
];

const resolveTab = (pathname: string) => {
  const match = tabs.find((tab) => pathname === tab.value || pathname.startsWith(`${tab.value}/`));
  return match?.value || '/home';
};

const MobileAppShell: React.FC<MobileAppShellProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { t, i18n } = useTranslation();
  const { user } = useAppSelector((state) => state.auth);
  const { currentRide } = useAppSelector((state) => state.ride);

  const currentTab = resolveTab(location.pathname);
  const currentTabConfig = tabs.find((tab) => tab.value === currentTab) || tabs[0];

  const [profileAnchorEl, setProfileAnchorEl] = React.useState<null | HTMLElement>(null);
  const [langAnchorEl, setLangAnchorEl] = React.useState<null | HTMLElement>(null);

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
        <Toolbar sx={{ minHeight: 76, px: 2 }}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 800, letterSpacing: '0.12em' }}>
              Cab Booking
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.15 }}>
              {t(currentTabConfig.labelKey, currentTabConfig.fallback)}
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
          pt: 'calc(88px + env(safe-area-inset-top))',
          pb: 'calc(92px + env(safe-area-inset-bottom))',
          px: { xs: 1.5, sm: 2 },
        }}
      >
        <Box sx={{ height: '100%' }}>{children}</Box>
      </Box>

      <Paper
        elevation={16}
        sx={{
          position: 'fixed',
          left: 12,
          right: 12,
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
    </Box>
  );
};

export default MobileAppShell;