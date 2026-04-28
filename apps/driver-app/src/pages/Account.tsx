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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  DirectionsCarRounded,
  NotificationsRounded,
  PersonRounded,
  ShieldRounded,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { authApi } from '../api/auth.api';
import { driverApi } from '../api/driver.api';
import { updateUser } from '../store/auth.slice';
import { setOnlineStatus, setProfile } from '../store/driver.slice';
import { walletApi, WalletBalance } from '../api/wallet.api';
import { formatCurrency, getVehicleTypeLabel } from '../utils/format.utils';

const APPROVAL_META: Record<string, { label: string; color: 'success' | 'warning' | 'error' | 'default' }> = {
  APPROVED: { label: 'Trạng thái: Sẵn sàng hoạt động', color: 'success' },
  PENDING: { label: 'Trạng thái: Hồ sơ đang được theo dõi', color: 'warning' },
  REJECTED: { label: 'Trạng thái: Cần bổ sung', color: 'error' },
  SUSPENDED: { label: 'Trạng thái: Tạm khóa', color: 'default' },
};

const Account: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const { profile, isOnline } = useAppSelector((state) => state.driver);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passwordEditing, setPasswordEditing] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [walletSummary, setWalletSummary] = useState<WalletBalance | null>(null);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    avatar: '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const refreshAccount = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [meResult, profileResult, walletResult] = await Promise.all([
        authApi.getMe(),
        driverApi.getProfile(),
        walletApi.getBalance(),
      ]);
      if (meResult.success) {
        dispatch(updateUser(meResult.data.user));
      }
      dispatch(setProfile(profileResult.data.driver));
      setWalletSummary(walletResult.data?.data ?? (walletResult.data as any));
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Không thể tải thông tin tài khoản.');
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    void refreshAccount();
  }, [refreshAccount]);

  useEffect(() => {
    setFormData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      avatar: user?.avatar || '',
    });
  }, [user]);

  const fullName = useMemo(() => {
    if (!user) {
      return 'Tài xế';
    }

    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Tài xế';
  }, [user]);

  const approvalMeta = APPROVAL_META[profile?.status || 'PENDING'] || APPROVAL_META.PENDING;
  const vehicleSummary = [profile?.vehicleModel]
    .filter(Boolean)
    .join(' ');
  const settlementPreview = Math.max(
    0,
    Number(walletSummary?.lockedBalance ?? 0)
      + Number(walletSummary?.availableBalance ?? 0)
      - Number(walletSummary?.debt ?? 0),
  );

  const handleChange = (field: keyof typeof formData) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handlePasswordChange = (field: keyof typeof passwordData) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordData((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSaveProfile = async () => {
    setError('');
    setSuccess('');

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('Vui lòng nhập đầy đủ họ và tên.');
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
        email: formData.email.trim(),
      });

      if (response.success) {
        dispatch(updateUser(response.data.user));
        setEditing(false);
        setSuccess('Đã cập nhật thông tin tài khoản.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Không thể cập nhật tài khoản.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setError('');
    setSuccess('');

    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setError('Vui lòng nhập đầy đủ thông tin mật khẩu.');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
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
        setSuccess(response.data?.message || 'Đã cập nhật mật khẩu tài khoản.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Không thể cập nhật mật khẩu.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDeactivateDriver = async () => {
    setError('');
    setSuccess('');
    setDeactivateLoading(true);

    try {
      if (isOnline) {
        const offlineResponse = await driverApi.goOffline();
        dispatch(setProfile(offlineResponse.data.driver));
        dispatch(setOnlineStatus(false));
      }

      const response = await walletApi.deactivate();
      const result = response.data?.data ?? (response.data as any);
      setDeactivateOpen(false);
      await refreshAccount();
      setSuccess(`Đã ngừng hoạt động tài xế. Hệ thống đã đối soát và hoàn trả ${formatCurrency(result.refundedAmount || 0)}.`);
      navigate('/wallet');
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error?.message || 'Không thể ngừng hoạt động tài xế.');
    } finally {
      setDeactivateLoading(false);
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
                {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'T'}
              </Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="h6" fontWeight={800}>
                  {fullName}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.84 }}>
                  {user?.email || 'Chưa cập nhật email'}
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.25 }}>
                  <Chip size="small" label={user?.phoneNumber || 'Chưa có SĐT'} sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#fff' }} />
                  <Chip size="small" color={approvalMeta.color} label={approvalMeta.label} />
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
                  Quản lý tài khoản đăng nhập, email liên hệ, bảo mật và lối tắt sang hồ sơ tài xế ở cùng một nơi.
                </Typography>
                <Stack direction="row" spacing={1.25} justifyContent="center" sx={{ mt: 2 }}>
                  <Button variant="contained" sx={{ borderRadius: 3 }} onClick={() => { setEditing((prev) => !prev); setSuccess(''); }}>
                    {editing ? 'Đóng chỉnh sửa' : 'Chỉnh sửa tài khoản'}
                  </Button>
                </Stack>

                {editing && (
                  <Card variant="outlined" sx={{ mt: 2.5, borderRadius: 4, bgcolor: '#f8fafc', borderColor: '#e2e8f0' }}>
                    <CardContent>
                      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                        <Box sx={{ width: 6, height: 24, borderRadius: 3, bgcolor: 'primary.main' }} />
                        <Typography variant="subtitle1" fontWeight={800}>Thông tin tài khoản</Typography>
                      </Stack>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField fullWidth label="Họ" value={formData.firstName} onChange={handleChange('firstName')} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField fullWidth label="Tên" value={formData.lastName} onChange={handleChange('lastName')} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField fullWidth label="Email" value={formData.email} onChange={handleChange('email')} placeholder="name@example.com" />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField fullWidth label="Số điện thoại" value={user?.phoneNumber || ''} disabled helperText="Số điện thoại được quản lý theo tài khoản đăng ký." />
                        </Grid>

                      </Grid>
                      <Stack direction="row" spacing={1.25} justifyContent="center" flexWrap="wrap" useFlexGap sx={{ mt: 2.5 }}>
                        <Button variant="contained" onClick={handleSaveProfile} disabled={saving}>
                          {saving ? <CircularProgress size={20} /> : 'Lưu thay đổi'}
                        </Button>
                        <Button
                          variant="text"
                          onClick={() => {
                            setEditing(false);
                            setFormData({
                              firstName: user?.firstName || '',
                              lastName: user?.lastName || '',
                              email: user?.email || '',
                              avatar: user?.avatar || '',
                            });
                          }}
                          disabled={saving}
                        >
                          Hủy
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
              Hồ sơ tài xế
            </Typography>
            <List disablePadding>
              <ListItem disableGutters>
                <ListItemIcon><DirectionsCarRounded color="primary" /></ListItemIcon>
                <ListItemText
                  primary={`Loại xe: ${vehicleSummary || 'Thông tin phương tiện'}`}
secondary={profile?.licensePlate ? `Biển số ${profile.licensePlate}` : 'Bổ sung thông tin xe, GPLX và trạng thái hồ sơ tài xế.'}
                />
              </ListItem>
              <ListItem disableGutters>
                <ListItemIcon><ShieldRounded color="primary" /></ListItemIcon>
                <ListItemText
                  primary={approvalMeta.label}
                  secondary={profile?.vehicleType ? `Loại xe: ${getVehicleTypeLabel(profile.vehicleType)}` : 'Theo dõi trạng thái hồ sơ và ví tài xế.'}
                />
              </ListItem>
            </List>
            <Stack direction="row" justifyContent="center" sx={{ mt: 1.5 }}>
              <Button variant="outlined" sx={{ borderRadius: 3, minWidth: 220 }} onClick={() => navigate('/profile')}>
                Mở hồ sơ tài xế
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 5 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>
              Trung tâm tài khoản
            </Typography>
            <List disablePadding>
              <ListItem disableGutters>
                <ListItemIcon><NotificationsRounded color="primary" /></ListItemIcon>
                <ListItemText
                  primary="Thông báo tài khoản"
                />
              </ListItem>
              <ListItem disableGutters>
                <ListItemIcon><PersonRounded color="primary" /></ListItemIcon>
                <ListItemText
                  primary="Email và hồ sơ liên hệ"
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 5, border: '1px solid #fecaca', bgcolor: '#fff7f7' }}>
          <CardContent>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 0.75 }}>
              Ngừng làm tài xế
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Khi ngừng hoạt động, hệ thống sẽ đối soát tự động theo công thức: ký quỹ + số dư khả dụng - công nợ. Không cần admin duyệt.
            </Typography>
            <Stack spacing={0.75} sx={{ mb: 2 }}>
              {[
                ['Ký quỹ đang giữ', formatCurrency(Number(walletSummary?.lockedBalance ?? 0))],
                ['Số dư khả dụng', formatCurrency(Number(walletSummary?.availableBalance ?? 0))],
                ['Công nợ hiện tại', `-${formatCurrency(Number(walletSummary?.debt ?? 0))}`],
                ['Hoàn dự kiến', formatCurrency(settlementPreview)],
              ].map(([label, value]) => (
                <Stack key={label} direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">{label}</Typography>
                  <Typography variant="body2" fontWeight={800}>{value}</Typography>
                </Stack>
              ))}
            </Stack>
            <Button
              variant="outlined"
              color="error"
              sx={{ borderRadius: 3 }}
              disabled={deactivateLoading || loading}
              onClick={() => setDeactivateOpen(true)}
            >
              Ngừng hoạt động tài xế
            </Button>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 5 }}>
          <CardContent>
            <Stack spacing={1.5} sx={{ mb: 1.5 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" fontWeight={800}>
                  Bảo mật tài khoản
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Đổi mật khẩu đăng nhập và thu hồi các phiên cũ để bảo vệ tài khoản.
                </Typography>
              </Box>
<Stack direction="row" justifyContent="center">
  <Button
    variant="contained"
    sx={{ borderRadius: 3, minWidth: 220 }}
    onClick={() => {
      setPasswordEditing(true);
      setError('');
      setSuccess('');
    }}
  >
    Đổi mật khẩu
  </Button>
</Stack>
            </Stack>

            {passwordEditing && (
              <Card variant="outlined" sx={{ borderRadius: 4, bgcolor: '#f8fafc', borderColor: '#e2e8f0' }}>
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        type="password"
                        label="Mật khẩu hiện tại"
                        value={passwordData.currentPassword}
                        onChange={handlePasswordChange('currentPassword')}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        type="password"
                        label="Mật khẩu mới"
                        value={passwordData.newPassword}
                        onChange={handlePasswordChange('newPassword')}
                        helperText="Ít nhất 8 ký tự, có 1 chữ hoa và 1 ký tự đặc biệt."
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        type="password"
                        label="Xác nhận mật khẩu mới"
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordChange('confirmPassword')}
                      />
                    </Grid>
                  </Grid>
                  <Stack direction="row" spacing={1.25} justifyContent="center" flexWrap="wrap" useFlexGap sx={{ mt: 2.5 }}>
                    <Button variant="contained" onClick={handleChangePassword} disabled={passwordSaving}>
                      {passwordSaving ? <CircularProgress size={20} /> : 'Cập nhật mật khẩu'}
                    </Button>
                    <Button
                      variant="text"
                      disabled={passwordSaving}
                      onClick={() => {
                        setPasswordEditing(false);
                        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                      }}
                    >
                      Hủy
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </Stack>

      <Dialog open={deactivateOpen} onClose={() => !deactivateLoading && setDeactivateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Xác nhận ngừng hoạt động</DialogTitle>
        <DialogContent>
          <Stack spacing={1.2} sx={{ pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Hệ thống sẽ tự động đối soát ví của bạn và hoàn trả phần còn lại về tài khoản cá nhân sau khi trừ công nợ.
            </Typography>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Số tiền hoàn dự kiến: <strong>{formatCurrency(settlementPreview)}</strong>
            </Alert>
            {isOnline && (
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                Tài khoản đang trực tuyến. Hệ thống sẽ tự chuyển sang ngoại tuyến trước khi đối soát.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeactivateOpen(false)} disabled={deactivateLoading}>Hủy</Button>
          <Button color="error" variant="contained" onClick={handleDeactivateDriver} disabled={deactivateLoading}>
            {deactivateLoading ? <CircularProgress size={20} color="inherit" /> : 'Xác nhận ngừng hoạt động'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Account;
