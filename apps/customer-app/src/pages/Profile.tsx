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
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';

const Profile: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passwordEditing, setPasswordEditing] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    avatar: '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
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
      email: user?.email || '',
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

  const passwordChecks = useMemo(() => {
    const nextPassword = passwordData.newPassword;

    return [
      {
        label: t('profile.passwordRuleLength', 'Tối thiểu 8 ký tự'),
        met: nextPassword.length >= 8,
      },
      {
        label: t('profile.passwordRuleUppercase', 'Có ít nhất 1 chữ in hoa'),
        met: /[A-Z]/.test(nextPassword),
      },
      {
        label: t('profile.passwordRuleSpecial', 'Có ít nhất 1 ký tự đặc biệt'),
        met: /[^A-Za-z0-9]/.test(nextPassword),
      },
      {
        label: t('profile.passwordRuleMatch', 'Mật khẩu xác nhận trùng khớp'),
        met: nextPassword.length > 0 && nextPassword === passwordData.confirmPassword,
      },
    ];
  }, [passwordData.confirmPassword, passwordData.newPassword, t]);

  const handleChange = (field: keyof typeof formData) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handlePasswordFieldChange = (field: keyof typeof passwordData) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordData((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSaveProfile = async () => {
    setError('');
    setSuccess('');

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError(t('profile.nameRequired', 'Vui lòng nhập đầy đủ họ và tên.'));
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
        email: formData.email.trim() || undefined,
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

  const handleChangePassword = async () => {
    setError('');
    setSuccess('');

    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setError(t('profile.passwordRequired', 'Vui lòng nhập đầy đủ thông tin mật khẩu.'));
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError(t('profile.passwordMismatch', 'Mật khẩu xác nhận không khớp.'));
      return;
    }

    if (passwordChecks.some((rule) => !rule.met)) {
      setError(t('profile.passwordWeak', 'Mật khẩu mới chưa đáp ứng đủ điều kiện bảo mật.'));
      return;
    }

    setPasswordSaving(true);
    try {
      const response = await authApi.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });

      if (response.success) {
        setPasswordEditing(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setSuccess(response.data.message || t('profile.passwordChangeSuccess', 'Đã cập nhật mật khẩu thành công.'));
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('profile.passwordChangeFailed', 'Không thể cập nhật mật khẩu.'));
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <Box sx={{ height: '100%', overflow: 'auto', pb: 2 }}>
      <Stack spacing={2}>
        {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}

<Card sx={{ borderRadius: 5, overflow: 'hidden' }}>
  {/* HEADER */}
  <Box
    sx={{
      p: 2.5,
      background: 'linear-gradient(135deg, #0f172a, #1d4ed8)',
      color: '#fff',
      position: 'relative'
    }}
  >
    {/* NÚT EDIT GÓC PHẢI */}
<Box
  onClick={() => {
    setEditing((prev) => !prev);
    setSuccess('');
  }}
  sx={{
    position: 'absolute',
    top: 12,
    right: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 0.75,
    px: 1.5,
    py: 0.5,
    borderRadius: 3,
    bgcolor: 'rgba(255,255,255,0.15)',
    cursor: 'pointer',
    '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }
  }}
>
  {editing ? <CloseIcon fontSize="small" /> : <EditIcon fontSize="small" />}
  <Typography variant="body2" fontWeight={600}>
    {editing ? 'Đóng' : 'Chỉnh sửa'}
  </Typography>
</Box>

    <Stack direction="row" spacing={2} alignItems="center">
      <Avatar
        src={user?.avatar}
        sx={{ width: 64, height: 64, bgcolor: 'rgba(255,255,255,0.18)' }}
      >
        {user?.firstName?.[0]?.toUpperCase() ||
          user?.email?.[0]?.toUpperCase()}
      </Avatar>

      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h6" fontWeight={800}>
          {fullName || t('profile.guest', 'Khách hàng')}
        </Typography>

        <Typography variant="body2" sx={{ opacity: 0.84 }}>
          {user?.email}
        </Typography>

        <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
          <Chip
            size="small"
            label={t('profile.memberTier', 'Thành viên tiêu chuẩn')}
            sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: '#fff' }}
          />
          <Chip
            size="small"
            label={
              user?.phoneNumber ||
              t('profile.noPhone', 'Chưa có SĐT')
            }
            sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#fff' }}
          />
        </Stack>
      </Box>
    </Stack>
  </Box>

  {/* CONTENT */}
  <CardContent sx={{ pt: 2 }}>
    {loading ? (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={28} />
      </Box>
    ) : (
      <>
        {/* EDIT FORM */}
        {editing && (
          <Card
            variant="outlined"
            sx={{ mt: 0, borderRadius: 4 }}
          >
            <CardContent>
              <Typography
                variant="subtitle1"
                fontWeight={800}
                sx={{ mb: 2 }}
              >
                {t('profile.editSection', 'Thông tin cá nhân')}
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label={t('register.firstName')}
                    value={formData.firstName}
                    onChange={handleChange('firstName')}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label={t('register.lastName')}
                    value={formData.lastName}
                    onChange={handleChange('lastName')}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label={t('profile.email', 'Email')}
                    value={formData.email}
                    onChange={handleChange('email')}
                    placeholder="name@example.com"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label={t('profile.phone', 'Điện thoại')}
                    value={formData.phoneNumber}
                    disabled
                    helperText={t(
                      'profile.phoneManagedByAccount',
                      'Số điện thoại được quản lý theo tài khoản đăng ký.'
                    )}
                  />
                </Grid>
              </Grid>

              <Stack
                direction="row"
                justifyContent="center"
                sx={{ mt: 2.5 }}
              >
                <Button
                  variant="contained"
                  onClick={handleSaveProfile}
                  disabled={saving}
                  sx={{ borderRadius: 3, px: 3, fontWeight: 600 }}
                >
                  {saving ? (
                    <CircularProgress size={20} />
                  ) : (
                    t('profile.saveProfile', 'Lưu thay đổi')
                  )}
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
                <ListItemIcon><HeadsetMicRounded color="primary" /></ListItemIcon>
                <ListItemText
                  primary={t('profile.supportCenter', 'Trung tâm trợ giúp')}
                  secondary={t('profile.supportCenterBody', 'FAQ, khiếu nại và luồng hỗ trợ sau chuyến sẽ được gom về đây.')}
                />
              </ListItem>
            </List>

            <Divider sx={{ my: 2 }} />

            <Box
              sx={{
                borderRadius: 4,
                p: { xs: 2, sm: 2.5 },
                background: 'linear-gradient(135deg, rgba(219,234,254,0.82), rgba(236,253,245,0.92))',
                border: '1px solid rgba(59,130,246,0.12)',
              }}
            >
              <Stack spacing={1.5}>
                <Box sx={{ textAlign: 'center' }}>
                  <SecurityRounded color="primary" sx={{ fontSize: 26, mb: 0.75 }} />
                  <Typography variant="h6" fontWeight={800}>
                    {t('profile.security', 'Bảo mật')}
                  </Typography>
                </Box>


                <Stack direction="row" justifyContent="center">
                  <Button
                    variant={passwordEditing ? 'outlined' : 'contained'}
                    sx={{ borderRadius: 3, minWidth: 220 }}
                    onClick={() => {
                      setPasswordEditing((prev) => !prev);
                      setError('');
                      setSuccess('');
                    }}
                  >
                    {passwordEditing ? t('profile.closeEditor', 'Đóng chỉnh sửa') : t('profile.changePassword', 'Đổi mật khẩu')}
                  </Button>
                </Stack>

                {passwordEditing && (
                  <Card variant="outlined" sx={{ borderRadius: 4, bgcolor: 'rgba(255,255,255,0.96)' }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 0.75 }}>
                        {t('profile.passwordEditorTitle', 'Cập nhật mật khẩu mới')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {t('profile.passwordEditorBody', 'Mật khẩu nên đủ dài, có chữ in hoa và ký tự đặc biệt để hạn chế rủi ro bị lộ tài khoản.')}
                      </Typography>

                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            type="password"
                            label={t('profile.currentPassword', 'Mật khẩu hiện tại')}
                            value={passwordData.currentPassword}
                            onChange={handlePasswordFieldChange('currentPassword')}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="password"
                            label={t('profile.newPassword', 'Mật khẩu mới')}
                            value={passwordData.newPassword}
                            onChange={handlePasswordFieldChange('newPassword')}
                            helperText={t('profile.passwordHint', 'Ít nhất 8 ký tự, có 1 chữ hoa và 1 ký tự đặc biệt.')}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="password"
                            label={t('profile.confirmPassword', 'Xác nhận mật khẩu mới')}
                            value={passwordData.confirmPassword}
                            onChange={handlePasswordFieldChange('confirmPassword')}
                          />
                        </Grid>
                      </Grid>

                      <Box sx={{ mt: 2, p: 1.5, borderRadius: 3, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
                          {t('profile.passwordChecklist', 'Kiểm tra nhanh')}
                        </Typography>
                        <Stack spacing={0.9} sx={{ mt: 1.1 }}>
                          {passwordChecks.map((rule) => (
                            <Stack key={rule.label} direction="row" spacing={1} alignItems="center">
                              <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: rule.met ? '#16a34a' : '#cbd5e1', flexShrink: 0 }} />
                              <Typography variant="body2" color={rule.met ? 'success.main' : 'text.secondary'}>
                                {rule.label}
                              </Typography>
                            </Stack>
                          ))}
                        </Stack>
                      </Box>

                      <Stack direction="row" spacing={1.25} justifyContent="center" flexWrap="wrap" useFlexGap sx={{ mt: 2.5 }}>
                        <Button variant="contained" onClick={handleChangePassword} disabled={passwordSaving}>
                          {passwordSaving ? <CircularProgress size={20} /> : t('profile.updatePassword', 'Cập nhật mật khẩu')}
                        </Button>
                        <Button
                          variant="text"
                          disabled={passwordSaving}
                          onClick={() => {
                            setPasswordEditing(false);
                            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                          }}
                        >
                          {t('profile.cancelEditing', 'Hủy')}
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                )}
              </Stack>
            </Box>
          </CardContent>
        </Card>

      </Stack>
    </Box>
  );
};

export default Profile;
