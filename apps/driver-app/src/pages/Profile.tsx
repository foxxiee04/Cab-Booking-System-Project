import React, { useCallback, useEffect, useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Divider,
  Button,
  Chip,
  Grid,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { driverApi } from '../api/driver.api';
import { setProfile } from '../store/driver.slice';
import { useTranslation } from 'react-i18next';

const Profile: React.FC = () => {
  const dispatch = useAppDispatch();
  const { profile } = useAppSelector((state) => state.driver);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    vehicleType: 'CAR',
    vehicleMake: '',
    vehicleModel: '',
    vehicleColor: '',
    vehicleYear: new Date().getFullYear(),
    licensePlate: '',
    licenseNumber: '',
    licenseExpiryDate: '',
  });

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await driverApi.getProfile();
      dispatch(setProfile(response.data.driver));
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('errors.loadProfile'));
    } finally {
      setLoading(false);
    }
  }, [dispatch, t]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    setFormData({
      vehicleType: profile.vehicleType,
      vehicleMake: profile.vehicleMake || '',
      vehicleModel: profile.vehicleModel || '',
      vehicleColor: profile.vehicleColor || '',
      vehicleYear: profile.vehicleYear || new Date().getFullYear(),
      licensePlate: profile.licensePlate || '',
      licenseNumber: profile.licenseNumber || '',
      licenseExpiryDate: profile.licenseExpiryDate ? profile.licenseExpiryDate.slice(0, 10) : '',
    });
  }, [profile]);

  const hasReviews = (profile?.reviewCount ?? 0) > 0;
  const approvalStatus = profile?.status || 'PENDING';
  const approvalTone = approvalStatus === 'APPROVED'
    ? { color: 'success' as const, label: t('profile.approved', 'Da duoc duyet') }
    : approvalStatus === 'REJECTED'
      ? { color: 'error' as const, label: t('profile.rejected', 'Bi tu choi') }
      : approvalStatus === 'SUSPENDED'
        ? { color: 'default' as const, label: t('profile.suspended', 'Tam khoa') }
        : { color: 'warning' as const, label: t('profile.pendingApproval', 'Cho duyet ho so') };

  const handleChange = (field: keyof typeof formData) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = field === 'vehicleYear' ? Number(event.target.value) : event.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    if (!formData.vehicleMake.trim() || !formData.vehicleModel.trim() || !formData.vehicleColor.trim() || !formData.licensePlate.trim() || !formData.licenseNumber.trim() || !formData.licenseExpiryDate) {
      setError(t('profile.fillRequired', 'Vui lòng nhập đầy đủ các trường hồ sơ xe.'));
      return;
    }

    setSaving(true);
    try {
      const response = await driverApi.updateProfile({
        vehicleType: formData.vehicleType as any,
        vehicleMake: formData.vehicleMake.trim(),
        vehicleModel: formData.vehicleModel.trim(),
        vehicleColor: formData.vehicleColor.trim(),
        vehicleYear: formData.vehicleYear,
        licensePlate: formData.licensePlate.trim(),
        licenseNumber: formData.licenseNumber.trim(),
        licenseExpiryDate: formData.licenseExpiryDate,
      });

      dispatch(setProfile(response.data.driver));
      setEditing(false);
      setSuccess(t('profile.saveSuccess', 'Đã cập nhật hồ sơ tài xế.'));
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('profile.saveFailed', 'Không thể cập nhật hồ sơ tài xế.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight="bold">
        {t('profile.title')}
      </Typography>

      {success && (
        <Alert severity="success" sx={{ mt: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box sx={{ mt: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {profile && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="h6">{t('profile.driverProfile')}</Typography>
              <Chip color={approvalTone.color} label={approvalTone.label} size="small" />
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2">{t('profile.vehicle')}: {profile.vehicleMake} {profile.vehicleModel}</Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {t('profile.plate')}: {profile.licensePlate}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {t('profile.color')}: {profile.vehicleColor}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {t('profile.rating')}: {hasReviews
                ? `${profile.rating.toFixed(1)} (${profile.reviewCount} ${t('profile.reviews', 'danh gia')})`
                : t('profile.noReviews', 'Chua co danh gia')}
            </Typography>
            <Stack direction="row" spacing={1.25} sx={{ mt: 2 }}>
              <Button variant="outlined" onClick={fetchProfile}>
                {t('profile.refresh')}
              </Button>
              <Button variant="contained" onClick={() => setEditing((prev) => !prev)}>
                {editing ? t('profile.closeEditor', 'Đóng chỉnh sửa') : t('profile.editProfile', 'Chỉnh sửa hồ sơ')}
              </Button>
            </Stack>

            {editing && (
              <Card variant="outlined" sx={{ mt: 2.5, borderRadius: 4 }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                    {t('profile.editSection', 'Cập nhật thông tin xe')}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField select fullWidth label={t('profile.vehicleType', 'Loại xe')} value={formData.vehicleType} onChange={handleChange('vehicleType')}>
                        <MenuItem value="CAR">{t('vehicle.CAR')}</MenuItem>
                        <MenuItem value="SUV">{t('vehicle.SUV')}</MenuItem>
                        <MenuItem value="MOTORCYCLE">{t('vehicle.MOTORCYCLE')}</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label={t('profile.year', 'Năm sản xuất')} type="number" value={formData.vehicleYear} onChange={handleChange('vehicleYear')} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label={t('profile.make', 'Hãng xe')} value={formData.vehicleMake} onChange={handleChange('vehicleMake')} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label={t('profile.model', 'Dòng xe')} value={formData.vehicleModel} onChange={handleChange('vehicleModel')} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label={t('profile.color')} value={formData.vehicleColor} onChange={handleChange('vehicleColor')} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label={t('profile.plate')} value={formData.licensePlate} onChange={handleChange('licensePlate')} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label={t('profile.licenseNumber', 'Số GPLX')} value={formData.licenseNumber} onChange={handleChange('licenseNumber')} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label={t('profile.licenseExpiry', 'Ngày hết hạn GPLX')} type="date" value={formData.licenseExpiryDate} onChange={handleChange('licenseExpiryDate')} InputLabelProps={{ shrink: true }} />
                    </Grid>
                  </Grid>
                  <Stack direction="row" spacing={1.25} sx={{ mt: 2.5 }}>
                    <Button variant="contained" onClick={handleSave} disabled={saving}>
                      {saving ? <CircularProgress size={20} /> : t('profile.saveProfile', 'Lưu thay đổi')}
                    </Button>
                    <Button variant="text" onClick={() => setEditing(false)} disabled={saving}>
                      {t('profile.cancelEditing', 'Hủy')}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}
    </Container>
  );
};

export default Profile;
