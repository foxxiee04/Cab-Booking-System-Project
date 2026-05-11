import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  InputAdornment,
  MenuItem,
  Snackbar,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import {
  AddPhotoAlternate,
  Badge,
  ColorLens,
  DirectionsCar,
  FaceRounded,
  LocalOffer,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updateUser } from '../store/auth.slice';
import { setProfile } from '../store/driver.slice';
import { authApi } from '../api/auth.api';
import { driverApi } from '../api/driver.api';
import { DriverRegistration, LicenseClass, VehicleType } from '../types';
import { isValidLicensePlate, normalizeLicensePlate, sanitizeLicensePlateInput, getLicensePlateHint } from '../utils/format.utils';
import { useTranslation } from 'react-i18next';

const VEHICLE_OPTIONS_BY_TYPE: Record<VehicleType, Record<string, string[]>> = {
  MOTORBIKE: {
    Honda: ['Wave Alpha', 'Winner X', 'Blade'],
    Yamaha: ['Sirius', 'Exciter', 'Jupiter'],
    Suzuki: ['Raider', 'Axelo'],
    SYM: ['Elegant', 'Galaxy'],
  },
  SCOOTER: {
    Honda: ['Vision', 'Air Blade', 'Lead', 'SH Mode'],
    Yamaha: ['Janus', 'FreeGo', 'Grande'],
    Piaggio: ['Liberty', 'Medley'],
    VinFast: ['Evo200', 'Klara S2'],
  },
  CAR_4: {
    Toyota: ['Vios', 'Corolla Altis', 'Yaris Cross'],
    Hyundai: ['Accent', 'Elantra'],
    Kia: ['K3', 'Seltos'],
    Honda: ['City', 'Civic'],
    Mazda: ['Mazda2', 'Mazda3'],
    VinFast: ['VF e34', 'VF 6'],
  },
  CAR_7: {
    Toyota: ['Innova', 'Fortuner'],
    Hyundai: ['Stargazer', 'Santa Fe'],
    Mitsubishi: ['Xpander', 'Pajero Sport'],
    Ford: ['Everest', 'Tourneo'],
    Kia: ['Carens', 'Sorento'],
  },
};

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  MOTORBIKE: 'Xe máy (số)',
  SCOOTER: 'Xe ga',
  CAR_4: 'Ô tô 4 chỗ',
  CAR_7: 'Ô tô 7 chỗ',
};

const VEHICLE_COLOR_OPTIONS = ['Trắng', 'Đen', 'Bạc', 'Xám', 'Đỏ', 'Xanh dương', 'Xanh lá', 'Vàng'];

const LICENSE_CLASS_OPTIONS_BY_VEHICLE: Record<VehicleType, LicenseClass[]> = {
  MOTORBIKE: ['A1', 'A'],
  SCOOTER: ['A1', 'A'],
  CAR_4: ['B', 'C1', 'C', 'D1', 'D2', 'D', 'BE', 'C1E', 'CE', 'D1E', 'D2E', 'DE'],
  CAR_7: ['B', 'C1', 'C', 'D1', 'D2', 'D', 'BE', 'C1E', 'CE', 'D1E', 'D2E', 'DE'],
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') { reject(new Error('Invalid image')); return; }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error('Cannot read image'));
    reader.readAsDataURL(file);
  });

const formatLicenseNumberInput = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 12);
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
};

const STEPS = ['Phương tiện', 'Biển số & ảnh', 'Giấy phép'];

const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
    <Box sx={{ width: 4, height: 20, borderRadius: 2, bgcolor: 'primary.main', flexShrink: 0 }} />
    <Typography variant="subtitle1" fontWeight={800}>{children}</Typography>
  </Box>
);

const ProfileSetup: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const minExpiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    vehicleType: 'CAR_4' as VehicleType,
    vehicleMake: '',
    vehicleModel: '',
    vehicleColor: '',
    vehicleYear: currentYear,
    vehicleImageUrl: '',
    licensePlate: '',
    licenseClass: 'B' as LicenseClass,
    licenseNumber: '',
    licenseExpiryDate: '',
    cccdImageUrl: '',
    portraitImageUrl: '',
  });
  const [cccdUploading, setCccdUploading] = useState(false);
  const [portraitUploading, setPortraitUploading] = useState(false);

  const vehicleYearOptions = Array.from({ length: currentYear - 2014 + 2 }, (_, i) => currentYear + 1 - i);
  const availableMakes = Object.keys(VEHICLE_OPTIONS_BY_TYPE[formData.vehicleType]);
  const availableModels = VEHICLE_OPTIONS_BY_TYPE[formData.vehicleType][formData.vehicleMake] || [];
  const availableLicenseClasses = LICENSE_CLASS_OPTIONS_BY_VEHICLE[formData.vehicleType];

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = field === 'vehicleYear'
      ? Number(e.target.value)
      : field === 'licenseNumber'
        ? formatLicenseNumberInput(e.target.value)
        : field === 'licensePlate'
          ? sanitizeLicensePlateInput(e.target.value)
          : e.target.value;
    setFormData((p) => ({ ...p, [field]: val }));
    setFieldErrors((p) => ({ ...p, [field]: '' }));
  };

  const handleVehicleTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextType = e.target.value as VehicleType;
    const makes = Object.keys(VEHICLE_OPTIONS_BY_TYPE[nextType]);
    const firstMake = makes[0] || '';
    const models = VEHICLE_OPTIONS_BY_TYPE[nextType][firstMake] || [];
    setFormData((p) => ({
      ...p,
      vehicleType: nextType,
      vehicleMake: makes.includes(p.vehicleMake) ? p.vehicleMake : firstMake,
      vehicleModel: makes.includes(p.vehicleMake)
        ? (VEHICLE_OPTIONS_BY_TYPE[nextType][p.vehicleMake] || []).includes(p.vehicleModel)
          ? p.vehicleModel
          : (VEHICLE_OPTIONS_BY_TYPE[nextType][p.vehicleMake] || [])[0] || ''
        : models[0] || '',
      licenseClass: LICENSE_CLASS_OPTIONS_BY_VEHICLE[nextType].includes(p.licenseClass)
        ? p.licenseClass
        : LICENSE_CLASS_OPTIONS_BY_VEHICLE[nextType][0],
    }));
    setFieldErrors((p) => ({ ...p, vehicleType: '', vehicleMake: '', vehicleModel: '', licenseClass: '' }));
  };

  const handleVehicleMakeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextMake = e.target.value;
    const models = VEHICLE_OPTIONS_BY_TYPE[formData.vehicleType][nextMake] || [];
    setFormData((p) => ({
      ...p,
      vehicleMake: nextMake,
      vehicleModel: models.includes(p.vehicleModel) ? p.vehicleModel : models[0] || '',
    }));
    setFieldErrors((p) => ({ ...p, vehicleMake: '', vehicleModel: '' }));
  };

  const handleVehicleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      setFieldErrors((p) => ({ ...p, vehicleImageUrl: 'Chỉ hỗ trợ PNG/JPG/WEBP' }));
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setFieldErrors((p) => ({ ...p, vehicleImageUrl: 'Ảnh tối đa 3MB' }));
      return;
    }
    setImageUploading(true);
    try {
      const encoded = await fileToDataUrl(file);
      setFormData((p) => ({ ...p, vehicleImageUrl: encoded }));
      setFieldErrors((p) => ({ ...p, vehicleImageUrl: '' }));
    } catch (err: any) {
      setFieldErrors((p) => ({ ...p, vehicleImageUrl: err?.message || 'Không thể xử lý ảnh' }));
    } finally {
      setImageUploading(false);
      e.target.value = '';
    }
  };

  const handlePortraitImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      setFieldErrors((p) => ({ ...p, portraitImageUrl: 'Chỉ hỗ trợ PNG/JPG/WEBP' }));
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setFieldErrors((p) => ({ ...p, portraitImageUrl: 'Ảnh tối đa 3MB' }));
      return;
    }
    setPortraitUploading(true);
    try {
      const encoded = await fileToDataUrl(file);
      setFormData((p) => ({ ...p, portraitImageUrl: encoded }));
      setFieldErrors((p) => ({ ...p, portraitImageUrl: '' }));
    } catch (err: any) {
      setFieldErrors((p) => ({ ...p, portraitImageUrl: err?.message || 'Không thể xử lý ảnh' }));
    } finally {
      setPortraitUploading(false);
      e.target.value = '';
    }
  };

  const handleCccdImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      setFieldErrors((p) => ({ ...p, cccdImageUrl: 'Chỉ hỗ trợ PNG/JPG/WEBP' }));
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setFieldErrors((p) => ({ ...p, cccdImageUrl: 'Ảnh tối đa 3MB' }));
      return;
    }
    setCccdUploading(true);
    try {
      const encoded = await fileToDataUrl(file);
      setFormData((p) => ({ ...p, cccdImageUrl: encoded }));
      setFieldErrors((p) => ({ ...p, cccdImageUrl: '' }));
    } catch (err: any) {
      setFieldErrors((p) => ({ ...p, cccdImageUrl: err?.message || 'Không thể xử lý ảnh' }));
    } finally {
      setCccdUploading(false);
      e.target.value = '';
    }
  };

  const validateForm = () => {
    const errs: Record<string, string> = {};
    const licDigits = formData.licenseNumber.replace(/\s+/g, '');
    const licRegex = /^\d{3}\s\d{3}\s\d{3}\s\d{3}$/;

    if (formData.vehicleMake.trim().length < 2) errs.vehicleMake = t('errors.vehicleMakeInvalid');
    if (formData.vehicleModel.trim().length < 2) errs.vehicleModel = t('errors.vehicleModelInvalid');
    if (formData.vehicleColor.trim().length < 2) errs.vehicleColor = t('errors.vehicleColorInvalid');
    if (!Number.isInteger(formData.vehicleYear) || formData.vehicleYear < 1990 || formData.vehicleYear > currentYear + 1) errs.vehicleYear = t('errors.vehicleYearInvalid');
    if (!isValidLicensePlate(formData.licensePlate, formData.vehicleType)) {
      const isCar = formData.vehicleType === 'CAR_4' || formData.vehicleType === 'CAR_7';
      errs.licensePlate = isCar
        ? 'Biển số ô tô phải có 1 chữ cái (VD: 50A-123.45)'
        : 'Biển số xe máy/ga phải có 2 chữ cái (VD: 50AC-123.45)';
    }

    const normalizedPlate = normalizeLicensePlate(formData.licensePlate).replace(/[-.\s]/g, '').toUpperCase();
    if (normalizedPlate.length > 0 && licDigits.length > 0 && normalizedPlate === licDigits.toUpperCase()) {
      errs.licensePlate = 'Biển số xe không được trùng với số GPLX.';
      errs.licenseNumber = 'Số GPLX không được trùng với biển số xe.';
    }

    if (!formData.portraitImageUrl || formData.portraitImageUrl.length < 16) {
      errs.portraitImageUrl = 'Vui lòng tải ảnh chân dung 3×4 (dùng làm ảnh đại diện hiển thị cho khách)';
    }
    if (!formData.vehicleImageUrl || formData.vehicleImageUrl.length < 16) errs.vehicleImageUrl = 'Vui lòng tải ảnh xe rõ biển số';
    if (!formData.cccdImageUrl || formData.cccdImageUrl.length < 16) errs.cccdImageUrl = 'Vui lòng tải ảnh CCCD/GPLX để xác minh';
    if (!licRegex.test(formData.licenseNumber) || licDigits.length !== 12) errs.licenseNumber = t('errors.licenseNumberInvalid');
    if (!formData.licenseExpiryDate || formData.licenseExpiryDate < minExpiryDate) errs.licenseExpiryDate = t('errors.licenseExpiryPast');

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateForm()) return;
    setShowTermsDialog(true);
  };

  const handleAcceptTermsAndSubmit = async () => {
    setShowTermsDialog(false);
    setLoading(true);
    setError('');
    try {
      if (!user) throw new Error(t('errors.authRequired'));
      const avatarResp = await authApi.updateMe({ profile: { avatar: formData.portraitImageUrl } });
      if (!avatarResp.success || !avatarResp.data?.user) {
        throw new Error(avatarResp.error?.message || 'Không thể lưu ảnh đại diện. Vui lòng thử lại.');
      }
      dispatch(updateUser({ avatar: avatarResp.data.user.avatar }));

      const { portraitImageUrl: _omitPortrait, ...driverFields } = formData;
      void _omitPortrait;
      const payload: DriverRegistration = {
        ...driverFields,
        licensePlate: normalizeLicensePlate(formData.licensePlate),
        licenseNumber: formData.licenseNumber.replace(/\s+/g, ''),
        cccdImageUrl: formData.cccdImageUrl,
      };
      const response = await driverApi.registerDriver(payload);
      if (response.success) {
        dispatch(setProfile(response.data.driver));
        setSnackbarOpen(true);
        setTimeout(() => navigate('/dashboard'), 2500);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('errors.profileSetupFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: '#f5f7fa',
          py: { xs: 3, sm: 5 },
          px: { xs: 1, sm: 0 },
        }}
      >
        <Container maxWidth="md">
          {/* Logo + title */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 1.5,
              }}
            >
              <DirectionsCar sx={{ fontSize: 30, color: '#fff' }} />
            </Box>
            <Typography variant="h5" fontWeight={900} color="text.primary">
              {t('profileSetup.title', 'Hoàn thiện hồ sơ tài xế')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('profileSetup.subtitle', 'Điền đầy đủ thông tin để gửi hồ sơ xét duyệt')}
            </Typography>
          </Box>

          {/* Stepper */}
          <Stepper activeStep={-1} alternativeLabel sx={{ mb: 3 }}>
            {STEPS.map((label) => (
              <Step key={label} completed={false}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 3 }}>{error}</Alert>
          )}

          <Card elevation={2} sx={{ borderRadius: 4 }}>
            <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
              <form onSubmit={handleSubmit}>
                {/* ── Section 1: Phương tiện ── */}
                <SectionHeader>Thông tin phương tiện</SectionHeader>

                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      select
                      label={t('profileSetup.vehicleType', 'Loại xe')}
                      value={formData.vehicleType}
                      onChange={handleVehicleTypeChange}
                      required
                      InputProps={{ startAdornment: <InputAdornment position="start"><DirectionsCar fontSize="small" /></InputAdornment> }}
                    >
                      {Object.entries(VEHICLE_TYPE_LABELS).map(([val, label]) => (
                        <MenuItem key={val} value={val}>{label}</MenuItem>
                      ))}
                    </TextField>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      select
                      label={t('profileSetup.vehicleMake', 'Hãng xe')}
                      value={formData.vehicleMake}
                      onChange={handleVehicleMakeChange}
                      required
                      error={Boolean(fieldErrors.vehicleMake)}
                      helperText={fieldErrors.vehicleMake}
                    >
                      {availableMakes.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                    </TextField>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      select
                      label={t('profileSetup.vehicleModel', 'Dòng xe')}
                      value={formData.vehicleModel}
                      onChange={handleChange('vehicleModel')}
                      required
                      disabled={!formData.vehicleMake}
                      error={Boolean(fieldErrors.vehicleModel)}
                      helperText={fieldErrors.vehicleModel || (!formData.vehicleMake ? 'Chọn hãng xe trước' : '')}
                    >
                      {availableModels.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                    </TextField>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      select
                      label={t('profileSetup.vehicleColor', 'Màu xe')}
                      value={formData.vehicleColor}
                      onChange={handleChange('vehicleColor')}
                      required
                      error={Boolean(fieldErrors.vehicleColor)}
                      helperText={fieldErrors.vehicleColor}
                      InputProps={{ startAdornment: <InputAdornment position="start"><ColorLens fontSize="small" /></InputAdornment> }}
                    >
                      {VEHICLE_COLOR_OPTIONS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </TextField>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      select
                      label={t('profileSetup.vehicleYear', 'Năm sản xuất')}
                      value={formData.vehicleYear}
                      onChange={handleChange('vehicleYear')}
                      required
                      error={Boolean(fieldErrors.vehicleYear)}
                      helperText={fieldErrors.vehicleYear}
                    >
                      {vehicleYearOptions.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                    </TextField>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 3 }} />

                {/* ── Section 2: Biển số & ảnh xe ── */}
                <SectionHeader>Biển số &amp; ảnh xe</SectionHeader>

                <TextField
                  fullWidth
                  label={t('profileSetup.licensePlate', 'Biển số xe')}
                  value={formData.licensePlate}
                  onChange={handleChange('licensePlate')}
                  required
                  error={Boolean(fieldErrors.licensePlate)}
                  helperText={fieldErrors.licensePlate || getLicensePlateHint(formData.vehicleType)}
                  placeholder="VD: 50A-123.45"
                  inputProps={{ maxLength: 11 }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><LocalOffer fontSize="small" /></InputAdornment> }}
                  sx={{ mb: 2 }}
                />

                <Box
                  sx={{
                    border: '2px dashed',
                    borderColor: formData.vehicleImageUrl ? 'primary.main' : 'divider',
                    borderRadius: 3,
                    p: 2.5,
                    textAlign: 'center',
                    bgcolor: formData.vehicleImageUrl ? 'primary.50' : '#fafafa',
                    transition: 'all 0.2s',
                    minHeight: 220,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    Ảnh phương tiện (khung rộng)
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.25 }}>
                    Chụp xe và biển số rõ nét để đối chiếu với biển đã nhập.
                  </Typography>
                  {formData.vehicleImageUrl ? (
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <Box
                        sx={{
                          width: '100%',
                          borderRadius: 2,
                          border: '1px solid rgba(148,163,184,0.35)',
                          bgcolor: '#f8fafc',
                          py: 1,
                          px: 0.5,
                          mb: 1.5,
                          lineHeight: 0,
                        }}
                      >
                        <Box
                          component="img"
                          src={formData.vehicleImageUrl}
                          alt="vehicle"
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
                      <Button component="label" variant="outlined" size="small" startIcon={<AddPhotoAlternate />} sx={{ borderRadius: 2 }}>
                        Đổi ảnh xe
                        <input hidden accept="image/png,image/jpeg,image/webp" type="file" onChange={handleVehicleImageUpload} />
                      </Button>
                    </Box>
                  ) : (
                    <Box>
                      <DirectionsCar sx={{ fontSize: 38, color: 'text.disabled', mb: 1 }} />
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Tải ảnh xe để admin xét duyệt
                      </Typography>
                      <Button
                        component="label"
                        variant="contained"
                        size="small"
                        startIcon={<AddPhotoAlternate />}
                        disabled={imageUploading}
                        sx={{ borderRadius: 2 }}
                      >
                        {imageUploading ? 'Đang xử lý...' : 'Chọn ảnh xe'}
                        <input hidden accept="image/png,image/jpeg,image/webp" type="file" onChange={handleVehicleImageUpload} />
                      </Button>
                    </Box>
                  )}
                  {fieldErrors.vehicleImageUrl && (
                    <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
                      {fieldErrors.vehicleImageUrl}
                    </Typography>
                  )}
                </Box>

                <Divider sx={{ my: 3 }} />

                {/* ── Section 3: Giấy phép lái xe & CCCD ── */}
                <SectionHeader>CCCD &amp; Giấy phép lái xe</SectionHeader>

                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Số CCCD/GPLX (12 chữ số)"
                      value={formData.licenseNumber}
                      onChange={handleChange('licenseNumber')}
                      required
                      error={Boolean(fieldErrors.licenseNumber)}
                      helperText={fieldErrors.licenseNumber || 'Nhập 12 chữ số trên CCCD hoặc GPLX'}
                      placeholder="052 042 424 424"
                      inputProps={{ maxLength: 15, inputMode: 'numeric' }}
                      InputProps={{ startAdornment: <InputAdornment position="start"><Badge fontSize="small" /></InputAdornment> }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      select
                      label="Hạng GPLX"
                      value={formData.licenseClass}
                      onChange={handleChange('licenseClass')}
                      required
                    >
                      {availableLicenseClasses.map((lc) => <MenuItem key={lc} value={lc}>{lc}</MenuItem>)}
                    </TextField>
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label={t('profileSetup.licenseExpiry', 'Ngày hết hạn GPLX')}
                      type="date"
                      value={formData.licenseExpiryDate}
                      onChange={handleChange('licenseExpiryDate')}
                      required
                      error={Boolean(fieldErrors.licenseExpiryDate)}
                      helperText={fieldErrors.licenseExpiryDate}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ min: minExpiryDate }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                      Ảnh nhận diện &amp; giấy tờ
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                      Ảnh chân dung 3×4 (ảnh đại diện cho khách) và ảnh CCCD/GPLX để admin xác minh — mỗi loại một hàng.
                    </Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                      Ảnh chân dung 3×4
                    </Typography>
                    <Box
                      sx={{
                        border: '2px dashed',
                        borderColor: formData.portraitImageUrl ? 'primary.main' : (fieldErrors.portraitImageUrl ? 'error.main' : 'divider'),
                        borderRadius: 3,
                        p: 2,
                        textAlign: 'center',
                        bgcolor: formData.portraitImageUrl ? 'primary.50' : '#fafafa',
                        height: '100%',
                      }}
                    >
                      {formData.portraitImageUrl ? (
                        <Box>
                          <Box
                            component="img"
                            src={formData.portraitImageUrl}
                            alt="portrait"
                            sx={{
                              width: '100%',
                              maxWidth: 270,
                              aspectRatio: '3 / 4',
                              objectFit: 'cover',
                              borderRadius: 2,
                              mb: 1.25,
                              display: 'block',
                              mx: 'auto',
                              border: '1px solid rgba(148,163,184,0.35)',
                            }}
                          />
                          <Button component="label" variant="outlined" size="small" startIcon={<FaceRounded />} sx={{ borderRadius: 2 }}>
                            Đổi ảnh 3×4
                            <input hidden accept="image/png,image/jpeg,image/webp" type="file" onChange={handlePortraitImageUpload} />
                          </Button>
                        </Box>
                      ) : (
                        <Box>
                          <FaceRounded sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Ảnh nền sáng, nhìn rõ mặt
                          </Typography>
                          <Button
                            component="label"
                            variant="contained"
                            size="small"
                            startIcon={<AddPhotoAlternate />}
                            disabled={portraitUploading}
                            sx={{ borderRadius: 2 }}
                          >
                            {portraitUploading ? 'Đang xử lý...' : 'Chọn ảnh 3×4'}
                            <input hidden accept="image/png,image/jpeg,image/webp" type="file" onChange={handlePortraitImageUpload} />
                          </Button>
                        </Box>
                      )}
                      {fieldErrors.portraitImageUrl && (
                        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
                          {fieldErrors.portraitImageUrl}
                        </Typography>
                      )}
                    </Box>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                      Ảnh CCCD / GPLX
                    </Typography>
                    <Box
                      sx={{
                        border: '2px dashed',
                        borderColor: formData.cccdImageUrl ? 'primary.main' : (fieldErrors.cccdImageUrl ? 'error.main' : 'divider'),
                        borderRadius: 3,
                        p: 2.5,
                        textAlign: 'center',
                        bgcolor: formData.cccdImageUrl ? 'primary.50' : '#fafafa',
                        transition: 'all 0.2s',
                        height: '100%',
                      }}
                    >
                      {formData.cccdImageUrl ? (
                        <Box>
                          <Box
                            sx={{
                              width: '100%',
                              minHeight: { xs: 240, sm: 280 },
                              maxHeight: 440,
                              borderRadius: 2,
                              border: '1px solid rgba(148,163,184,0.35)',
                              bgcolor: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              py: 1.25,
                              mb: 1.5,
                              mx: 'auto',
                            }}
                          >
                            <Box
                              component="img"
                              src={formData.cccdImageUrl}
                              alt="cccd"
                              sx={{
                                maxWidth: '100%',
                                maxHeight: 400,
                                width: 'auto',
                                height: 'auto',
                                objectFit: 'contain',
                                display: 'block',
                              }}
                            />
                          </Box>
                          <Button component="label" variant="outlined" size="small" startIcon={<AddPhotoAlternate />} sx={{ borderRadius: 2 }}>
                            Đổi ảnh
                            <input hidden accept="image/png,image/jpeg,image/webp" type="file" onChange={handleCccdImageUpload} />
                          </Button>
                        </Box>
                      ) : (
                        <Box>
                          <AddPhotoAlternate sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Tải ảnh mặt trước CCCD hoặc ảnh GPLX để admin xác minh
                          </Typography>
                          <Button
                            component="label"
                            variant="contained"
                            size="small"
                            startIcon={<AddPhotoAlternate />}
                            disabled={cccdUploading}
                            sx={{ borderRadius: 2 }}
                          >
                            {cccdUploading ? 'Đang xử lý...' : 'Chọn ảnh'}
                            <input hidden accept="image/png,image/jpeg,image/webp" type="file" onChange={handleCccdImageUpload} />
                          </Button>
                        </Box>
                      )}
                      {fieldErrors.cccdImageUrl && (
                        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
                          {fieldErrors.cccdImageUrl}
                        </Typography>
                      )}
                    </Box>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 3 }} />

                <Alert severity="info" sx={{ borderRadius: 3, mb: 3 }}>
                  <Typography variant="body2">
                    {t('profileSetup.info', 'Hồ sơ sẽ được admin xét duyệt trong 1–2 ngày làm việc. Sau khi duyệt, bạn cần nạp 300.000₫ ký quỹ để bắt đầu nhận cuốc.')}
                  </Typography>
                </Alert>

                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading}
                  sx={{ py: 1.6, borderRadius: 3, fontWeight: 800, fontSize: '1rem' }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : t('profileSetup.submit', 'Gửi hồ sơ đăng ký')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </Container>
      </Box>

      {/* ── Snackbar ── */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity="success" variant="filled" sx={{ width: '100%', borderRadius: 3 }}>
          {t('profileSetup.successMessage')}
        </Alert>
      </Snackbar>

      {/* ── Terms Dialog ── */}
      <Dialog
        open={showTermsDialog}
        onClose={() => setShowTermsDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, maxHeight: '90vh' } }}
      >
        <DialogTitle fontWeight={800}>ĐIỀU KHOẢN SỬ DỤNG DÀNH CHO TÀI XẾ FOXGO</DialogTitle>
        <DialogContent dividers sx={{ overflowY: 'auto' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Bằng việc đăng ký và sử dụng ứng dụng, tài xế xác nhận đồng ý với các quy định sau:
          </Typography>
          {[
            ['1. Thông tin trung thực', 'Cam kết cung cấp chính xác thông tin cá nhân, phương tiện và Giấy phép lái xe. Mọi hành vi gian lận sẽ bị từ chối phê duyệt và xử lý theo pháp luật.'],
            ['2. Ký quỹ kích hoạt', 'Nạp tối thiểu 300.000 ₫ để kích hoạt tài khoản nhận cuốc. Đây là khoản ký quỹ (bị khóa) và không tính vào số dư có thể rút.'],
            ['3. Phí nền tảng (Hoa hồng)', 'Hệ thống tự động thu phí trên mỗi chuyến xe hoàn thành (mặc định khoảng 20%, có thể điều chỉnh theo chính sách). Cuốc điện tử sẽ được cộng vào ví và có thể tạm giữ (T+24h) trước khi rút.'],
            ['4. Ngưỡng nợ cho phép', 'Số dư ví không được thấp hơn -200.000 ₫. Nếu vượt quá ngưỡng nợ này, hệ thống sẽ tạm chặn nhận cuốc tiền mặt cho đến khi nạp bù.'],
            ['5. Quy định rút tiền', 'Hạn mức rút tối thiểu là 50.000 ₫ từ số dư khả dụng (không bao gồm tiền ký quỹ).'],
            ['6. Xử lý vi phạm', 'Các hành vi gian lận, hủy/nhận cuốc bất thường có thể bị phạt tiền trực tiếp vào ví, tạm ngưng hoặc khóa tài khoản vĩnh viễn.'],
            ['7. Thay đổi điều khoản', 'FoxGo có quyền cập nhật chính sách và sẽ thông báo trước. Việc tiếp tục trực tuyến đồng nghĩa với việc chấp thuận các thay đổi này.'],
          ].map(([title, body]) => (
            <Box key={title} sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>{title}</Typography>
              <Typography variant="body2" color="text.secondary">{body}</Typography>
            </Box>
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, flexDirection: 'column', alignItems: 'stretch', gap: 1 }}>
          <FormControlLabel
            control={<Checkbox checked={termsChecked} onChange={(e) => setTermsChecked(e.target.checked)} color="primary" />}
            label={<Typography variant="body2" fontWeight={600}>Tôi đã đọc, hiểu rõ và đồng ý với các Điều khoản &amp; Thỏa thuận sử dụng của FoxGo.</Typography>}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => { setShowTermsDialog(false); setTermsChecked(false); }} variant="outlined" fullWidth sx={{ borderRadius: 2 }}>Huỷ</Button>
            <Button onClick={handleAcceptTermsAndSubmit} variant="contained" fullWidth disabled={!termsChecked} sx={{ borderRadius: 2 }}>
              Đồng ý &amp; Tiếp tục
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ProfileSetup;
