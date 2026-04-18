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
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  BadgeRounded,
  DirectionsBikeRounded,
  EditRounded,
  StarRounded,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
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

type ProfileFormData = {
  vehicleType: VehicleType;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  vehicleYear: number;
  licensePlate: string;
  licenseClass: LicenseClass;
  licenseNumber: string;
  licenseExpiryDate: string;
};

const Profile: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
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
    licensePlate: '',
    licenseClass: 'B',
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
    void fetchProfile();
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
  const vehiclePreviewUrl = resolveVehicleImageUrl(profile?.vehicleImageUrl);
  const approvalStatus = profile?.status || 'PENDING';
  const approvalTone = approvalStatus === 'APPROVED'
    ? { color: 'success' as const, label: 'Đã duyệt' }
    : approvalStatus === 'REJECTED'
      ? { color: 'error' as const, label: 'Bị từ chối' }
      : approvalStatus === 'SUSPENDED'
        ? { color: 'default' as const, label: 'Tạm khóa' }
        : { color: 'warning' as const, label: 'Chờ duyệt hồ sơ' };

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

  useEffect(() => {
    if (!availableLicenseClasses.includes(formData.licenseClass)) {
      setFormData((prev) => ({
        ...prev,
        licenseClass: availableLicenseClasses[0],
      }));
    }
  }, [availableLicenseClasses, formData.licenseClass]);

  return (
    <Box sx={{ pb: 4 }}>
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
              <Chip color={approvalTone.color} label={approvalTone.label} size="small" sx={{ fontWeight: 700, mb: 1.5 }} />
              <Typography variant="h5" fontWeight={900} sx={{ color: '#fff' }}>
                Hồ sơ tài xế
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

          <Card variant="outlined" sx={{ borderRadius: 4 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle1" fontWeight={700}>Thông tin xe và GPLX</Typography>

              </Stack>
              <Divider sx={{ my: 1.5 }} />
              <Grid container spacing={2.5} alignItems="stretch">
  <Grid item xs={12} md={5}>
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderRadius: 3,
        borderColor: 'rgba(148,163,184,0.22)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
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
            flex: 1,
            minHeight: 160,
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
            Ảnh xe được giữ nguyên theo hồ sơ đã nộp.
          </Typography>
        </Stack>
      )}
    </Paper>
  </Grid>

  <Grid item xs={12} md={7}>
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderRadius: 3,
        borderColor: 'rgba(148,163,184,0.22)',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Box
        sx={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 2,
        }}
      >
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
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {value || '—'}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  </Grid>
</Grid>


            </CardContent>
          </Card>

        </>
      )}
    </Box>
  );
};

export default Profile;
