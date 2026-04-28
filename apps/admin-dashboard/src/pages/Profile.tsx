import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { authApi } from '../api/auth.api';
import { setUser } from '../store/auth.slice';
import { formatDate } from '../utils/format.utils';

const Profile: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setFirstName(user?.firstName || '');
    setLastName(user?.lastName || '');
    setEmail(user?.email || '');
    setAvatar(user?.avatar || '');
  }, [user]);

  const displayName = useMemo(() => {
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || 'Admin';
  }, [firstName, lastName]);

  const handleSave = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await authApi.updateMe({
        email: email.trim() || undefined,
        profile: {
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          avatar: avatar.trim() || undefined,
        },
      });

      const nextUser = response.data?.user;
      if (nextUser) {
        dispatch(setUser(nextUser));
      }

      setSuccess('Cập nhật hồ sơ thành công.');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Không thể cập nhật hồ sơ lúc này.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, minHeight: '100%', background: 'radial-gradient(circle at top left, rgba(59,130,246,0.08), transparent 34%), linear-gradient(180deg, #f8fafc 0%, #eef4fb 100%)' }}>
      <Typography variant="h4" fontWeight={900} gutterBottom>
        Hồ sơ quản trị viên
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Quản lý thông tin tài khoản admin đang đăng nhập.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '360px minmax(0, 1fr)' } }}>
        <Card elevation={0} sx={{ borderRadius: 5, overflow: 'hidden', border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.06)' }}>
          <Box sx={{ p: 2.5, background: (theme: any) => `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`, color: '#fff' }}>
            <Stack spacing={2} alignItems="center">
              <Avatar src={avatar || undefined} sx={{ width: 92, height: 92, border: '3px solid rgba(255,255,255,0.25)' }}>
                {displayName[0]}
              </Avatar>
              <Box textAlign="center">
                <Typography variant="h6" fontWeight={900}>{displayName}</Typography>
                <Typography variant="body2" sx={{ opacity: 0.82 }}>{email || 'Chưa cập nhật email'}</Typography>
              </Box>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" justifyContent="center">
                <Chip label={user?.role || 'ADMIN'} sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', fontWeight: 700 }} />
                <Chip label={user?.status || 'ACTIVE'} sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#fff', fontWeight: 700 }} />
              </Stack>
            </Stack>
          </Box>

          <CardContent>
            <Stack spacing={1.25}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Ngày tạo</Typography>
                <Typography variant="body2" fontWeight={700}>{user?.createdAt ? formatDate(user.createdAt) : 'N/A'}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Cập nhật gần nhất</Typography>
                <Typography variant="body2" fontWeight={700}>{user?.updatedAt ? formatDate(user.updatedAt) : 'N/A'}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Số điện thoại</Typography>
                <Typography variant="body2" fontWeight={700}>{user?.phone || 'N/A'}</Typography>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.06)' }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h6" fontWeight={800}>Thông tin tài khoản</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: 2.5 }}>
              Chỉnh sửa thông tin hiển thị của tài khoản quản trị, dùng cho dashboard nội bộ và các thao tác vận hành hàng ngày.
            </Typography>

            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <TextField
                fullWidth
                label="Họ"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
              <TextField
                fullWidth
                label="Tên"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
              />
              <TextField
                fullWidth
                label="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />

            </Box>

            <Stack direction="row" justifyContent="center" sx={{ mt: 3 }}>
              <Button variant="contained" onClick={handleSave} disabled={loading} sx={{ minWidth: 220, borderRadius: 3 }}>
                {loading ? <CircularProgress size={20} color="inherit" /> : 'Lưu thay đổi'}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default Profile;
