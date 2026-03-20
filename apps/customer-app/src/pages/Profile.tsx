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
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
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
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    avatar: '',
  });

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

  useEffect(() => {
    setFormData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phoneNumber: user?.phoneNumber || '',
      avatar: user?.avatar || '',
    });
  }, [user]);

  const fullName = useMemo(() => {
    if (!user) {
      return '';
    }

    return `${user.firstName} ${user.lastName}`.trim();
  }, [user]);

  const handleChange = (field: keyof typeof formData) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSaveProfile = async () => {
    setError('');
    setSuccess('');

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError(t('profile.nameRequired', 'Vui lòng nhập đầy đủ họ và tên.'));
      return;
    }

    if (formData.phoneNumber && !/^[0-9]{10,15}$/.test(formData.phoneNumber.trim())) {
      setError(t('errors.phoneInvalid'));
      return;
    }

    setSaving(true);
    try {
      const response = await authApi.updateMe({
        profile: {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          avatar: formData.avatar.trim() || undefined,
        },
        phone: formData.phoneNumber.trim() || undefined,
      });

      if (response.success) {
        dispatch(updateUser(response.data.user));
        setEditing(false);
        setSuccess(t('profile.saveSuccess', 'Đã cập nhật hồ sơ thành công.'));
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('profile.saveFailed', 'Không thể cập nhật hồ sơ.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ height: '100%', overflow: 'auto', pb: 2 }}>
      <Stack spacing={2}>
        {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}
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
                <Stack direction="row" spacing={1.25} sx={{ mt: 2 }}>
                  <Button variant="outlined" sx={{ borderRadius: 3 }} onClick={refreshProfile}>
                    {t('profile.refresh')}
                  </Button>
                  <Button variant="contained" sx={{ borderRadius: 3 }} onClick={() => { setEditing((prev) => !prev); setSuccess(''); }}>
                    {editing ? t('profile.closeEditor', 'Đóng chỉnh sửa') : t('profile.editProfile', 'Chỉnh sửa hồ sơ')}
                  </Button>
                </Stack>

                {editing && (
                  <Card variant="outlined" sx={{ mt: 2.5, borderRadius: 4 }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 2 }}>
                        {t('profile.editSection', 'Thông tin cá nhân')}
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField fullWidth label={t('register.firstName')} value={formData.firstName} onChange={handleChange('firstName')} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField fullWidth label={t('register.lastName')} value={formData.lastName} onChange={handleChange('lastName')} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField fullWidth label={t('profile.phone', 'Điện thoại')} value={formData.phoneNumber} onChange={handleChange('phoneNumber')} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField fullWidth label={t('profile.avatarUrl', 'Ảnh đại diện URL')} value={formData.avatar} onChange={handleChange('avatar')} placeholder="https://..." />
                        </Grid>
                      </Grid>
                      <Stack direction="row" spacing={1.25} sx={{ mt: 2.5 }}>
                        <Button variant="contained" onClick={handleSaveProfile} disabled={saving}>
                          {saving ? <CircularProgress size={20} /> : t('profile.saveProfile', 'Lưu thay đổi')}
                        </Button>
                        <Button variant="text" onClick={() => { setEditing(false); setFormData({ firstName: user?.firstName || '', lastName: user?.lastName || '', phoneNumber: user?.phoneNumber || '', avatar: user?.avatar || '' }); }} disabled={saving}>
                          {t('profile.cancelEditing', 'Hủy')}
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                )}
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
