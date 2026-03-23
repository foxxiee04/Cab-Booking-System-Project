import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
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
    <Box sx={{ p: 3 }}>
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

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Stack spacing={2} alignItems="center">
                <Avatar src={avatar || undefined} sx={{ width: 88, height: 88 }}>
                  {displayName[0]}
                </Avatar>
                <Typography variant="h6" fontWeight={800}>{displayName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {user?.role || 'ADMIN'} • {user?.status || 'ACTIVE'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Tạo lúc: {user?.createdAt ? formatDate(user.createdAt) : 'N/A'}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Họ"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Tên"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    disabled
                    label="Số điện thoại"
                    value={user?.phone || 'N/A'}
                  />
                </Grid>
              </Grid>

              <Stack direction="row" justifyContent="flex-end" sx={{ mt: 3 }}>
                <Button variant="contained" onClick={handleSave} disabled={loading}>
                  {loading ? <CircularProgress size={20} color="inherit" /> : 'Lưu thay đổi'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Profile;
