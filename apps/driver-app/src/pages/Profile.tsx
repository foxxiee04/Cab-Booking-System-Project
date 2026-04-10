import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Avatar,
  Paper,
} from '@mui/material';
import {
  DirectionsBikeRounded,
  StarRounded,
  BadgeRounded,
  EditRounded,
  AddPhotoAlternate,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { driverApi } from '../api/driver.api';
import { setProfile } from '../store/driver.slice';
import { getVehicleTypeLabel } from '../utils/format.utils';
import type { LicenseClass, VehicleType } from '../types';
import { useTranslation } from 'react-i18next';

const LICENSE_CLASS_OPTIONS = ['A1', 'A', 'B', 'C1', 'C', 'D1', 'D2', 'D', 'BE', 'C1E', 'CE', 'D1E', 'D2E', 'DE'] as const;
const LICENSE_CLASS_OPTIONS_BY_VEHICLE: Record<VehicleType, LicenseClass[]> = {
  MOTORBIKE: ['A1', 'A'],
  SCOOTER: ['A1', 'A'],
  CAR_4: ['B', 'C1', 'C', 'D1', 'D2', 'D', 'BE', 'C1E', 'CE', 'D1E', 'D2E', 'DE'],
  CAR_7: ['B', 'C1', 'C', 'D1', 'D2', 'D', 'BE', 'C1E', 'CE', 'D1E', 'D2E', 'DE'],
};

const API_ROOT = (process.env.REACT_APP_API_URL || 'http://localhost:3000/api').replace(/\/api\/?$/, '');

const resolveVehicleImageUrl = (rawUrl?: string) => {
  if (!rawUrl) {
    return '';
  }

  if (/^data:image\//i.test(rawUrl) || /^https?:\/\//i.test(rawUrl)) {
    return rawUrl;
  }

  if (rawUrl.startsWith('/')) {
    return `${API_ROOT}${rawUrl}`;
  }

  return `${API_ROOT}/${rawUrl}`;
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Invalid image payload'));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error('Cannot read image file'));
    reader.readAsDataURL(file);
  });

type ProfileFormData = {
  vehicleType: VehicleType;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  vehicleYear: number;
  vehicleImageUrl: string;
  licensePlate: string;
  licenseClass: LicenseClass;
  licenseNumber: string;
  licenseExpiryDate: string;
};

const Profile: React.FC = () => {
  const dispatch = useAppDispatch();
  const { profile } = useAppSelector((state) => state.driver);
  const user = useAppSelector((state) => state.auth.user);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<ProfileFormData>({
    vehicleType: 'CAR_4',
    vehicleMake: '',
    vehicleModel: '',
    vehicleColor: '',
    vehicleYear: new Date().getFullYear(),
    vehicleImageUrl: '',
    licensePlate: '',
    licenseClass: 'B',
    licenseNumber: '',
    licenseExpiryDate: '',
  });
  const [imageUploading, setImageUploading] = useState(false);

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
      vehicleImageUrl: profile.vehicleImageUrl || '',
      licensePlate: profile.licensePlate || '',
      licenseClass: profile.licenseClass || 'B',
      licenseNumber: profile.licenseNumber || '',
      licenseExpiryDate: profile.licenseExpiryDate ? profile.licenseExpiryDate.slice(0, 10) : '',
    });
  }, [profile]);

  const hasReviews = (profile?.reviewCount ?? 0) > 0;
  const availableLicenseClasses = useMemo(
    () => LICENSE_CLASS_OPTIONS_BY_VEHICLE[formData.vehicleType] || [...LICENSE_CLASS_OPTIONS],
    [formData.vehicleType],
  );
  const driverDisplayName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Tài xế';
  const driverInitials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.trim().toUpperCase() || 'TX';
  const vehiclePreviewUrl = resolveVehicleImageUrl(formData.vehicleImageUrl || profile?.vehicleImageUrl);
  const approvalStatus = profile?.status || 'PENDING';
  const approvalTone = approvalStatus === 'APPROVED'
    ? { color: 'success' as const, label: t('profile.approved', 'Da duoc duyet') }
    : approvalStatus === 'REJECTED'
      ? { color: 'error' as const, label: t('profile.rejected', 'Bi tu choi') }
      : approvalStatus === 'SUSPENDED'
        ? { color: 'default' as const, label: t('profile.suspended', 'Tam khoa') }
        : { color: 'warning' as const, label: t('profile.pendingApproval', 'Cho duyet ho so') };

  const handleChange = (field: keyof ProfileFormData) => (event: React.ChangeEvent<HTMLInputElement>) => {
    let value: ProfileFormData[keyof ProfileFormData];

    if (field === 'vehicleYear') {
      value = Number(event.target.value);
    } else if (field === 'vehicleType') {
      value = event.target.value as VehicleType;
    } else if (field === 'licenseClass') {
      value = event.target.value as LicenseClass;
    } else {
      value = event.target.value;
    }

    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    if (!formData.vehicleMake.trim() || !formData.vehicleModel.trim() || !formData.vehicleColor.trim() || !formData.licensePlate.trim() || !formData.licenseNumber.trim() || !formData.licenseExpiryDate || !formData.licenseClass) {
      setError(t('profile.fillRequired', 'Vui lòng nhập đầy đủ các trường hồ sơ xe.'));
      return;
    }

    if (!/^\d{12}$/.test(formData.licenseNumber.trim())) {
      setError(t('profile.licenseNumberInvalid', 'Số GPLX phải gồm đúng 12 chữ số.'));
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
        vehicleImageUrl: formData.vehicleImageUrl,
        licensePlate: formData.licensePlate.trim(),
        licenseClass: formData.licenseClass,
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

  const handleVehicleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      setError('Chỉ hỗ trợ ảnh PNG/JPG/WEBP');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setError('Ảnh tối đa 3MB');
      return;
    }

    setImageUploading(true);
    setError('');
    try {
      const encoded = await fileToDataUrl(file);
      setFormData((prev) => ({ ...prev, vehicleImageUrl: encoded }));
    } catch (err: any) {
      setError(err?.message || 'Không thể xử lý ảnh xe');
    } finally {
      setImageUploading(false);
      event.target.value = '';
    }
  };

  useEffect(() => {
    if (!availableLicenseClasses.includes(formData.licenseClass)) {
      setFormData((prev) => ({
        ...prev,
        licenseClass: availableLicenseClasses[0],
      }));
    }
  }, [availableLicenseClasses, formData.licenseClass]);

  return (
    <Container sx={{ py: 3, pb: { xs: 16, sm: 12 } }}>
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {profile && (
        <>
          {/* Hero header with photo */}
          <Paper
            elevation={0}
            sx={{
              borderRadius: 5,
              overflow: 'hidden',
              background: 'linear-gradient(135deg, #1e40af 0%, #0ea5e9 60%, #38bdf8 100%)',
              position: 'relative',
              mb: 2.5,
            }}
          >
            <Box sx={{ px: 3, pt: 4, pb: 7 }}>
              <Chip
                color={approvalTone.color}
                label={approvalTone.label}
                size="small"
                sx={{ fontWeight: 700, mb: 1.5 }}
              />
              <Typography variant="h5" fontWeight={900} sx={{ color: '#fff' }}>
                {t('profile.driverProfile')}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', mt: 0.5 }}>
                {driverDisplayName}{user?.phoneNumber ? ` • ${user.phoneNumber}` : ''}
              </Typography>
            </Box>

            <Box
              sx={{
                position: 'absolute',
                bottom: -40,
                left: 24,
              }}
            >
              <Avatar
                sx={{
                  width: 84,
                  height: 84,
                  bgcolor: 'white',
                  border: '4px solid white',
                  boxShadow: '0 8px 24px rgba(15,23,42,0.18)',
                  fontSize: 28,
                  color: 'primary.main',
                  fontWeight: 900,
                }}
              >
                {driverInitials}
              </Avatar>
            </Box>
          </Paper>

          {/* Stats row */}
          <Box sx={{ mt: 7, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mb: 2.5 }}>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, textAlign: 'center' }}>
              <StarRounded sx={{ color: '#f59e0b', fontSize: 22 }} />
              <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.1 }}>
                {hasReviews ? profile.rating.toFixed(1) : '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary">Đánh giá</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, textAlign: 'center' }}>
              <DirectionsBikeRounded sx={{ color: 'primary.main', fontSize: 22 }} />
              <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.1 }}>
                {profile.totalRides ?? 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">Chuyến đi</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, textAlign: 'center' }}>
              <BadgeRounded sx={{ color: 'success.main', fontSize: 22 }} />
              <Typography variant="body2" fontWeight={800} sx={{ lineHeight: 1.3, mt: 0.25 }}>
                {getVehicleTypeLabel(profile.vehicleType as any)}
              </Typography>
              <Typography variant="caption" color="text.secondary">Loại xe</Typography>
            </Paper>
          </Box>

          {/* Profile details card */}
          <Card variant="outlined" sx={{ borderRadius: 4 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle1" fontWeight={700}>Thông tin xe</Typography>
                <Button
                  variant={editing ? 'outlined' : 'contained'}
                  size="small"
                  startIcon={<EditRounded />}
                  onClick={() => setEditing((prev) => !prev)}
                  sx={{ borderRadius: 999 }}
                >
                  {editing ? t('profile.closeEditor', 'Đóng') : t('profile.editProfile', 'Chỉnh sửa')}
                </Button>
              </Stack>
              <Divider sx={{ my: 1.5 }} />
              <Grid container spacing={2.5}>
                <Grid item xs={12} md={5}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      borderRadius: 3,
                      borderColor: 'rgba(148,163,184,0.22)',
                      height: '100%',
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
                      Ảnh xe đối chiếu
                    </Typography>
                    {vehiclePreviewUrl ? (
                      <Box
                        component="img"
                        src={vehiclePreviewUrl}
                        alt="vehicle-preview"
                        sx={{
                          width: '100%',
                          aspectRatio: '4 / 3',
                          objectFit: 'cover',
                          display: 'block',
                          borderRadius: 3,
                          border: '1px solid #e2e8f0',
                          bgcolor: '#f8fafc',
                        }}
                      />
                    ) : (
                      <Stack
                        spacing={1}
                        alignItems="center"
                        justifyContent="center"
                        sx={{
                          aspectRatio: '4 / 3',
                          borderRadius: 3,
                          border: '1px dashed #cbd5e1',
                          bgcolor: '#f8fafc',
                          color: 'text.secondary',
                          textAlign: 'center',
                          px: 2,
                        }}
                      >
                        <DirectionsBikeRounded sx={{ fontSize: 38, color: 'primary.main' }} />
                        <Typography variant="body2" fontWeight={700}>
                          Chưa cập nhật ảnh xe
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Ảnh xe sẽ hiển thị ở đây để admin đối chiếu biển số và phương tiện.
                        </Typography>
                      </Stack>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.1 }}>
                      Dùng cho bước đối chiếu hồ sơ và nhận diện phương tiện khi duyệt tài xế.
                    </Typography>
                    {editing && (
                      <Button
                        component="label"
                        variant="outlined"
                        startIcon={<AddPhotoAlternate />}
                        disabled={imageUploading}
                        sx={{ mt: 1.5, borderRadius: 999 }}
                      >
                        {imageUploading ? 'Đang xử lý ảnh...' : vehiclePreviewUrl ? 'Đổi ảnh xe' : 'Tải ảnh xe'}
                        <input hidden accept="image/png,image/jpeg,image/webp" type="file" onChange={handleVehicleImageUpload} />
                      </Button>
                    )}
                  </Paper>
                </Grid>
                <Grid item xs={12} md={7}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25 }}>
                    {[
                      { label: 'Hãng xe', value: profile.vehicleMake },
                      { label: 'Dòng xe', value: profile.vehicleModel },
                      { label: 'Màu xe', value: profile.vehicleColor },
                      { label: 'Biển số', value: profile.licensePlate },
                      { label: 'Hạng GPLX', value: profile.licenseClass },
                      { label: 'Năm SX', value: profile.vehicleYear?.toString() },
                      { label: 'Số GPLX', value: profile.licenseNumber },
                    ].map(({ label, value }) => (
                      <Box key={label}>
                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                        <Typography variant="body2" fontWeight={600}>{value || '—'}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Grid>
              </Grid>
              <Stack direction="row" justifyContent="center" spacing={1.25} sx={{ mt: 2 }}>
                <Button variant="text" size="small" onClick={fetchProfile} sx={{ borderRadius: 999 }}>
                  {t('profile.refresh')}
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
                          <MenuItem value="MOTORBIKE">Xe máy</MenuItem>
                          <MenuItem value="SCOOTER">Xe ga</MenuItem>
                          <MenuItem value="CAR_4">Ô tô 4 chỗ</MenuItem>
                          <MenuItem value="CAR_7">Ô tô 7 chỗ</MenuItem>
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
                        <TextField select fullWidth label="Hạng GPLX" value={formData.licenseClass} onChange={handleChange('licenseClass')}>
                          {availableLicenseClasses.map((licenseClass) => (
                            <MenuItem key={licenseClass} value={licenseClass}>{licenseClass}</MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField fullWidth label={t('profile.licenseNumber', 'Số GPLX')} value={formData.licenseNumber} onChange={handleChange('licenseNumber')} inputProps={{ maxLength: 12, inputMode: 'numeric' }} />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField fullWidth label={t('profile.licenseExpiry', 'Ngày hết hạn GPLX')} type="date" value={formData.licenseExpiryDate} onChange={handleChange('licenseExpiryDate')} InputLabelProps={{ shrink: true }} />
                      </Grid>
                    </Grid>
                    <Stack direction="row" spacing={1.25} justifyContent="center" sx={{ mt: 2.5, flexWrap: 'wrap' }}>
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
        </>
      )}
    </Container>
  );
};

export default Profile;
