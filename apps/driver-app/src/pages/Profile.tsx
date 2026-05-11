import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  BadgeOutlined,
  BadgeRounded,
  CalendarMonthOutlined,
  CameraAltRounded,
  DirectionsBikeRounded,
  DirectionsCarFilledOutlined,
  LocalPhoneOutlined,
  MailOutline,
  StarRounded,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { driverApi } from '../api/driver.api';
import { authApi } from '../api/auth.api';
import { setProfile } from '../store/driver.slice';
import { updateUser } from '../store/auth.slice';
import type { LicenseClass, VehicleType } from '../types';
import { useTranslation } from 'react-i18next';
import { normalizeGatewayOriginUrl } from '../utils/gateway-base-url';
import { DriverPortraitFrame } from '../components/common/DriverPortraitFrame';

const LICENSE_CLASS_OPTIONS = ['A1', 'A', 'B', 'C1', 'C', 'D1', 'D2', 'D', 'BE', 'C1E', 'CE', 'D1E', 'D2E', 'DE'] as const;
const LICENSE_CLASS_OPTIONS_BY_VEHICLE: Record<VehicleType, LicenseClass[]> = {
  MOTORBIKE: ['A1', 'A'],
  SCOOTER: ['A1', 'A'],
  CAR_4: ['B', 'C1', 'C', 'D1', 'D2', 'D', 'BE', 'C1E', 'CE', 'D1E', 'D2E', 'DE'],
  CAR_7: ['B', 'C1', 'C', 'D1', 'D2', 'D', 'BE', 'C1E', 'CE', 'D1E', 'D2E', 'DE'],
};

const API_ROOT = normalizeGatewayOriginUrl(process.env.REACT_APP_API_URL);

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

/** Giống nhãn loại xe trên admin duyệt hồ sơ */
const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  MOTORBIKE: 'Xe máy số',
  SCOOTER: 'Xe tay ga',
  CAR_4: 'Ô tô 4 chỗ',
  CAR_7: 'Ô tô 7 chỗ',
};

const formatDateValue = (value?: string) => {
  if (!value) {
    return 'Chưa có';
  }
  return new Date(value).toLocaleString('vi-VN');
};

const DetailRow: React.FC<{ label: string; value: React.ReactNode; emphasize?: boolean }> = ({
  label,
  value,
  emphasize = false,
}) => (
  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 132 }}>
      {label}
    </Typography>
    <Box
      sx={{
        flex: 1,
        textAlign: 'right',
        color: emphasize ? 'text.primary' : 'text.secondary',
        fontWeight: emphasize ? 700 : 500,
        fontSize: '0.875rem',
        lineHeight: 1.5,
      }}
    >
      {value}
    </Box>
  </Stack>
);

const InfoSection: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  icon,
  children,
}) => (
  <Paper
    variant="outlined"
    sx={{
      p: 2,
      borderRadius: 3,
      borderColor: 'rgba(148,163,184,0.25)',
      bgcolor: '#fff',
      height: '100%',
    }}
  >
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
      {icon}
      <Typography variant="subtitle2" fontWeight={800} sx={{ letterSpacing: 0.2 }}>
        {title}
      </Typography>
    </Stack>
    <Stack spacing={1.1}>{children}</Stack>
  </Paper>
);

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
  const { profile } = useAppSelector((state) => state.driver);
  const user = useAppSelector((state) => state.auth.user);
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn file ảnh (jpg, png, ...)');
      return;
    }
    setAvatarUploading(true);
    setError('');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const response = await authApi.updateMe({ profile: { avatar: dataUrl } });
      if (response.data?.user) {
        dispatch(updateUser({ avatar: response.data.user.avatar }));
      }
      setSuccess('Cập nhật ảnh đại diện thành công');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Không thể cập nhật ảnh đại diện');
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const hasReviews = (profile?.reviewCount ?? 0) > 0;
  const availableLicenseClasses = useMemo(
    () => LICENSE_CLASS_OPTIONS_BY_VEHICLE[formData.vehicleType] || [...LICENSE_CLASS_OPTIONS],
    [formData.vehicleType],
  );
  const driverDisplayName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Tài xế';
  const driverInitials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.trim().toUpperCase() || 'TX';
  const vehiclePreviewUrl = resolveVehicleImageUrl(profile?.vehicleImageUrl);
  const cccdPreviewUrl = resolveVehicleImageUrl(profile?.cccdImageUrl);
  const portraitPreviewUrl = resolveVehicleImageUrl(user?.avatar);
  const approvalStatus = profile?.status || 'PENDING';
  const approvalTone = approvalStatus === 'APPROVED'
    ? { color: 'success' as const, label: 'Đã duyệt' }
    : approvalStatus === 'REJECTED'
      ? { color: 'error' as const, label: 'Bị từ chối' }
      : approvalStatus === 'SUSPENDED'
        ? { color: 'default' as const, label: 'Tạm khóa' }
        : { color: 'warning' as const, label: 'Hồ sơ đang được theo dõi' };

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
              background: (theme: any) => `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 60%, ${theme.palette.primary.light} 100%)`,
              mb: 2.5,
            }}
          >
            <Box sx={{ px: 3, pt: 3, pb: 3 }}>
              <Chip color={approvalTone.color} label={approvalTone.label} size="small" sx={{ fontWeight: 700, mb: 2 }} />
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2.5}
                alignItems={{ xs: 'flex-start', sm: 'flex-start' }}
                justifyContent="space-between"
              >
                <Box sx={{ flex: 1, minWidth: 0, width: { xs: '100%', sm: 'auto' } }}>
                  <Typography variant="h5" fontWeight={900} sx={{ color: '#fff' }}>
                    Hồ sơ tài xế
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', mt: 0.5 }}>
                    {driverDisplayName}{user?.phoneNumber ? ` • ${user.phoneNumber}` : ''}
                  </Typography>
                </Box>
                <Box sx={{ flexShrink: 0 }}>
                  <Tooltip title="Thay ảnh chân dung 3×4 (ảnh đại diện)" placement="bottom">
                    <Box sx={{ position: 'relative', display: 'inline-block' }}>
                      <Box
                        onClick={() => avatarInputRef.current?.click()}
                        sx={{
                          border: '4px solid white',
                          borderRadius: 2,
                          boxShadow: '0 8px 24px rgba(15,23,42,0.18)',
                          overflow: 'hidden',
                          bgcolor: '#fff',
                          cursor: 'pointer',
                          lineHeight: 0,
                        }}
                      >
                        <DriverPortraitFrame
                          src={portraitPreviewUrl || undefined}
                          initials={driverInitials}
                          alt={driverDisplayName}
                          width={96}
                          borderRadius={1.5}
                          bordered={false}
                        />
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={avatarUploading}
                        sx={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          bgcolor: 'primary.main',
                          color: 'white',
                          width: 26,
                          height: 26,
                          '&:hover': { bgcolor: 'primary.dark' },
                          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        }}
                      >
                        {avatarUploading ? <CircularProgress size={12} color="inherit" /> : <CameraAltRounded sx={{ fontSize: 14 }} />}
                      </IconButton>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleAvatarChange}
                      />
                    </Box>
                  </Tooltip>
                </Box>
              </Stack>
            </Box>
          </Paper>

          <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mb: 2.5 }}>
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
                {VEHICLE_TYPE_LABELS[profile.vehicleType]}
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
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5 }}>
                Ảnh hồ sơ đã gửi admin
              </Typography>

              <Grid container spacing={2.5} alignItems="stretch" sx={{ mb: 2.5 }}>
                {/* Hàng 1: avatar trái | CCCD phải — giống admin duyệt hồ sơ */}
                <Grid item xs={12}>
                  <Grid container spacing={2} alignItems="stretch">
                    <Grid item xs={12} sm={6}>
                      <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 3, borderColor: 'rgba(148,163,184,0.25)', height: '100%' }}>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" sx={{ mb: 0.75 }}>
                          Ảnh chân dung 3×4
                        </Typography>
                        {portraitPreviewUrl ? (
                          <Box
                            component="img"
                            src={portraitPreviewUrl}
                            alt="portrait"
                            sx={{
                              display: 'block',
                              mx: 'auto',
                              width: '100%',
                  maxWidth: 270,
                  aspectRatio: '3 / 4',
                              objectFit: 'cover',
                              borderRadius: 2,
                              border: '1px solid rgba(148,163,184,0.2)',
                              bgcolor: '#f8fafc',
                            }}
                          />
                        ) : (
                          <Stack
                            alignItems="center"
                            justifyContent="center"
                            sx={{
                              mx: 'auto',
                  maxWidth: 270,
                  aspectRatio: '3 / 4',
                              borderRadius: 2,
                              border: '1px dashed rgba(148,163,184,0.4)',
                              bgcolor: '#f8fafc',
                            }}
                          >
                            <Avatar sx={{ width: 52, height: 52, bgcolor: 'primary.light', fontSize: 20 }}>
                              {driverInitials[0] || 'T'}
                            </Avatar>
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, px: 1, textAlign: 'center' }}>
                              Chưa có ảnh 3×4
                            </Typography>
                          </Stack>
                        )}
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 3, borderColor: 'rgba(148,163,184,0.25)', height: '100%' }}>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" sx={{ mb: 0.75 }}>
                          Ảnh CCCD / GPLX
                        </Typography>
                        {cccdPreviewUrl ? (
                          <Box
                            sx={{
                              width: '100%',
                              minHeight: { xs: 200, sm: 240 },
                              maxHeight: 380,
                              borderRadius: 2,
                              border: '1px solid rgba(148,163,184,0.2)',
                              bgcolor: '#f8fafc',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              py: 1.25,
                            }}
                          >
                            <Box
                              component="img"
                              src={cccdPreviewUrl}
                              alt="cccd-preview"
                              sx={{
                                maxWidth: '100%',
                                maxHeight: 360,
                                width: 'auto',
                                height: 'auto',
                                objectFit: 'contain',
                                display: 'block',
                              }}
                            />
                          </Box>
                        ) : (
                          <Stack
                            alignItems="center"
                            justifyContent="center"
                            sx={{
                              width: '100%',
                              minHeight: { xs: 200, sm: 240 },
                              maxHeight: 380,
                              borderRadius: 2,
                              border: '1px dashed rgba(148,163,184,0.4)',
                              bgcolor: '#f8fafc',
                            }}
                          >
                            <BadgeOutlined sx={{ fontSize: 28, color: 'primary.light' }} />
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                              Chưa có ảnh CCCD
                            </Typography>
                          </Stack>
                        )}
                      </Paper>
                    </Grid>
                  </Grid>
                </Grid>

                {/* Hàng 2: ảnh xe — cùng chiều ngang hai cột trên */}
                <Grid item xs={12}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.25,
                      borderRadius: 3,
                      borderColor: 'rgba(148,163,184,0.25)',
                      width: '100%',
                    }}
                  >
                    <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" sx={{ mb: 0.75 }}>
                      Ảnh phương tiện
                    </Typography>
                    {vehiclePreviewUrl ? (
                      <Box
                        sx={{
                          width: '100%',
                          borderRadius: 2,
                          border: '1px solid rgba(148,163,184,0.2)',
                          bgcolor: '#f8fafc',
                          py: 1,
                          px: 0.5,
                          lineHeight: 0,
                        }}
                      >
                        <Box
                          component="img"
                          src={vehiclePreviewUrl}
                          alt="vehicle-preview"
                          sx={{
                            width: '100%',
                            height: 'auto',
                            maxHeight: { xs: 300, sm: 400 },
                            objectFit: 'contain',
                            display: 'block',
                            verticalAlign: 'middle',
                          }}
                        />
                      </Box>
                    ) : (
                      <Stack
                        alignItems="center"
                        justifyContent="center"
                        sx={{
                          width: '100%',
                          minHeight: 120,
                          borderRadius: 2,
                          border: '1px dashed rgba(148,163,184,0.4)',
                          bgcolor: '#f8fafc',
                        }}
                      >
                        <DirectionsCarFilledOutlined sx={{ fontSize: 28, color: 'primary.light' }} />
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, px: 1, textAlign: 'center' }}>
                          Chưa có ảnh xe
                        </Typography>
                      </Stack>
                    )}
                  </Paper>
                </Grid>
              </Grid>

              <Grid container spacing={2.5} alignItems="stretch">
                <Grid item xs={12} md={6}>
                  <InfoSection title="Thông tin tài xế" icon={<BadgeOutlined sx={{ fontSize: 18, color: '#475569' }} />}>
                    <DetailRow label="Họ và tên" value={driverDisplayName || '—'} emphasize />
                    <DetailRow
                      label="Email"
                      value={
                        <Stack direction="row" spacing={0.75} justifyContent="flex-end" alignItems="center">
                          <MailOutline sx={{ fontSize: 15, color: '#64748b' }} />
                          <span>{user?.email || '—'}</span>
                        </Stack>
                      }
                    />
                    <DetailRow
                      label="Số liên hệ"
                      value={
                        <Stack direction="row" spacing={0.75} justifyContent="flex-end" alignItems="center">
                          <LocalPhoneOutlined sx={{ fontSize: 15, color: '#64748b' }} />
                          <span>{user?.phoneNumber || '—'}</span>
                        </Stack>
                      }
                    />
                    <DetailRow
                      label="Ngày gửi hồ sơ"
                      value={
                        <Stack direction="row" spacing={0.75} justifyContent="flex-end" alignItems="center">
                          <CalendarMonthOutlined sx={{ fontSize: 15, color: '#64748b' }} />
                          <span>{formatDateValue(profile.createdAt)}</span>
                        </Stack>
                      }
                    />
                    <DetailRow label="Mã hồ sơ" value={profile.id.slice(0, 8).toUpperCase()} emphasize />
                    <DetailRow
                      label="Trạng thái"
                      value={
                        <Chip label={approvalTone.label} color={approvalTone.color} size="small" sx={{ fontWeight: 700 }} />
                      }
                    />
                  </InfoSection>
                </Grid>
                <Grid item xs={12} md={6}>
                  <InfoSection title="Xe & Giấy phép lái xe" icon={<DirectionsCarFilledOutlined sx={{ fontSize: 18, color: '#475569' }} />}>
                    <DetailRow label="Loại phương tiện" value={VEHICLE_TYPE_LABELS[profile.vehicleType]} emphasize />
                    <DetailRow
                      label="Hãng / Dòng xe"
                      value={`${profile.vehicleMake || ''} ${profile.vehicleModel || ''}`.trim() || '—'}
                      emphasize
                    />
                    <DetailRow label="Màu sắc" value={profile.vehicleColor || '—'} />
                    <DetailRow label="Năm sản xuất" value={profile.vehicleYear != null ? String(profile.vehicleYear) : '—'} />
                    <DetailRow label="Biển số xe" value={profile.licensePlate || '—'} emphasize />
                    <Divider sx={{ my: 0.5 }} />
                    <DetailRow label="Số CCCD/GPLX" value={profile.licenseNumber || '—'} emphasize />
                    <DetailRow label="Hạng GPLX" value={profile.licenseClass || '—'} emphasize />
                    <DetailRow label="Ngày hết hạn GPLX" value={formatDateValue(profile.licenseExpiryDate)} />
                  </InfoSection>
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
