import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import {
  CreditCardRounded,
  HeadsetMicRounded,
  HomeRounded,
  NotificationsRounded,
  SecurityRounded,
  WorkRounded,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { authApi } from '../api/auth.api';
import { updateUser } from '../store/auth.slice';
import { useTranslation } from 'react-i18next';

const Profile: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refreshProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await authApi.getMe();
      if (response.success) {
        dispatch(updateUser(response.data.user));
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('errors.loadProfile'));
    } finally {
      setLoading(false);
    }
  }, [dispatch, t]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const fullName = useMemo(() => {
    if (!user) {
      return '';
    }

    return `${user.firstName} ${user.lastName}`.trim();
  }, [user]);

  return (
    <Box sx={{ height: '100%', overflow: 'auto', pb: 2 }}>
      <Stack spacing={2}>
        {error && <Alert severity="error">{error}</Alert>}

        <Card sx={{ borderRadius: 5, overflow: 'hidden' }}>
          <Box sx={{ p: 2.5, background: 'linear-gradient(135deg, #0f172a, #1d4ed8)', color: '#fff' }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar src={user?.avatar} sx={{ width: 64, height: 64, bgcolor: 'rgba(255,255,255,0.18)' }}>
                {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" fontWeight={800}>
                  {fullName || t('profile.guest', 'Khách hàng')}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.84 }}>
                  {user?.email}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
                  <Chip size="small" label={t('profile.memberTier', 'Thành viên tiêu chuẩn')} sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: '#fff' }} />
                  <Chip size="small" label={user?.phoneNumber || t('profile.noPhone', 'Chưa có SĐT')} sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#fff' }} />
                </Stack>
              </Box>
            </Stack>
          </Box>

          <CardContent>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary">
                  {t('profile.subtitle', 'Quản lý hồ sơ, phương thức thanh toán, địa điểm đã lưu và hỗ trợ tài khoản trong một nơi.')}
                </Typography>
                <Button variant="outlined" sx={{ mt: 2, borderRadius: 3 }} onClick={refreshProfile}>
                  {t('profile.refresh')}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 5 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>
              {t('profile.paymentAndPlaces', 'Thanh toán và địa điểm')}
            </Typography>
            <List disablePadding>
              <ListItem disableGutters>
                <ListItemIcon><CreditCardRounded color="primary" /></ListItemIcon>
                <ListItemText
                  primary={t('profile.paymentMethods', 'Phương thức thanh toán')}
                  secondary={t('profile.paymentMethodsBody', 'Tiền mặt đang là mặc định. Có thể mở rộng thêm thẻ và ví điện tử ở bước tiếp theo.')}
                />
              </ListItem>
              <Divider component="li" sx={{ my: 1.25 }} />
              <ListItem disableGutters>
                <ListItemIcon><HomeRounded color="primary" /></ListItemIcon>
                <ListItemText
                  primary={t('profile.savedHome', 'Nhà')}
                  secondary={t('profile.savedHomeBody', 'Lưu địa chỉ quen thuộc để đặt xe nhanh hơn.')}
                />
              </ListItem>
              <Divider component="li" sx={{ my: 1.25 }} />
              <ListItem disableGutters>
                <ListItemIcon><WorkRounded color="primary" /></ListItemIcon>
                <ListItemText
                  primary={t('profile.savedWork', 'Công ty')}
                  secondary={t('profile.savedWorkBody', 'Tạo phím tắt cho các tuyến đi làm thường xuyên.')}
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 5 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>
              {t('profile.accountAndSupport', 'Tài khoản và hỗ trợ')}
            </Typography>
            <List disablePadding>
              <ListItem disableGutters>
                <ListItemIcon><NotificationsRounded color="primary" /></ListItemIcon>
                <ListItemText
                  primary={t('profile.notifications', 'Cài đặt thông báo')}
                  secondary={t('profile.notificationsBody', 'Chuẩn bị sẵn cho Push Notification, Email và SMS qua Notification Service.')}
                />
              </ListItem>
              <Divider component="li" sx={{ my: 1.25 }} />
              <ListItem disableGutters>
                <ListItemIcon><SecurityRounded color="primary" /></ListItemIcon>
                <ListItemText
                  primary={t('profile.security', 'Bảo mật tài khoản')}
                  secondary={`${t('profile.role')}: ${user?.role || 'CUSTOMER'}`}
                />
              </ListItem>
              <Divider component="li" sx={{ my: 1.25 }} />
              <ListItem disableGutters>
                <ListItemIcon><HeadsetMicRounded color="primary" /></ListItemIcon>
                <ListItemText
                  primary={t('profile.supportCenter', 'Trung tâm trợ giúp')}
                  secondary={t('profile.supportCenterBody', 'FAQ, khiếu nại và luồng hỗ trợ sau chuyến sẽ được gom về đây.')}
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};

export default Profile;
