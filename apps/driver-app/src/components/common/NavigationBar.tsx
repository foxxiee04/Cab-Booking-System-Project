import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Menu,
  MenuItem,
  Avatar,
  Divider,
  ListItemIcon,
} from '@mui/material';
import {
  ArrowBack,
  Menu as MenuIcon,
  Person,
  History,
  Logout,
  AttachMoney,
  Translate,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout } from '../../store/auth.slice';

interface NavigationBarProps {
  title?: string;
  showBackButton?: boolean;
  onMenuClick?: () => void;
}

const NavigationBar: React.FC<NavigationBarProps> = ({
  title,
  showBackButton = false,
  onMenuClick,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { t, i18n } = useTranslation();
  const { user } = useAppSelector((state) => state.auth);

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [langAnchor, setLangAnchor] = React.useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLangOpen = (event: React.MouseEvent<HTMLElement>) => {
    setLangAnchor(event.currentTarget);
  };

  const handleLangClose = () => {
    setLangAnchor(null);
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
    handleMenuClose();
  };

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
    handleLangClose();
  };

  return (
    <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar>
        {showBackButton ? (
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => navigate(-1)}
            sx={{ mr: 2 }}
          >
            <ArrowBack />
          </IconButton>
        ) : (
          onMenuClick && (
            <IconButton
              edge="start"
              color="inherit"
              onClick={onMenuClick}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )
        )}

        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          {title || t('app.name', 'Driver App')}
        </Typography>

        <IconButton color="inherit" onClick={handleLangOpen} sx={{ mr: 1 }}>
          <Translate />
        </IconButton>

        <IconButton onClick={handleMenuOpen} sx={{ p: 0 }}>
          <Avatar sx={{ bgcolor: 'secondary.main' }}>
            {user?.email?.[0]?.toUpperCase()}
          </Avatar>
        </IconButton>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          onClick={handleMenuClose}
        >
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              {user?.email}
            </Typography>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => navigate('/profile')}>
            <ListItemIcon>
              <Person fontSize="small" />
            </ListItemIcon>
            {t('nav.profile')}
          </MenuItem>
          <MenuItem onClick={() => navigate('/earnings')}>
            <ListItemIcon>
              <AttachMoney fontSize="small" />
            </ListItemIcon>
            {t('nav.earnings')}
          </MenuItem>
          <MenuItem onClick={() => navigate('/history')}>
            <ListItemIcon>
              <History fontSize="small" />
            </ListItemIcon>
            {t('nav.history')}
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout}>
            <ListItemIcon>
              <Logout fontSize="small" />
            </ListItemIcon>
            {t('nav.logout')}
          </MenuItem>
        </Menu>

        <Menu
          anchorEl={langAnchor}
          open={Boolean(langAnchor)}
          onClose={handleLangClose}
        >
          <MenuItem onClick={() => changeLanguage('vi')} selected={i18n.language === 'vi'}>
            🇻🇳 Tiếng Việt
          </MenuItem>
          <MenuItem onClick={() => changeLanguage('en')} selected={i18n.language === 'en'}>
            🇬🇧 English
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default NavigationBar;
