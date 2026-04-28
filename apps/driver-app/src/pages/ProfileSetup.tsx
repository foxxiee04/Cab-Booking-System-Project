import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Grid,
  MenuItem,
  InputAdornment,
  Snackbar,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  DirectionsCar,
  Badge,
  ColorLens,
  LocalOffer,
  AddPhotoAlternate,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setProfile } from '../store/driver.slice';
import { driverApi } from '../api/driver.api';
import { DriverRegistration, LicenseClass, VehicleType } from '../types';
import { isValidLicensePlate, normalizeLicensePlate, sanitizeLicensePlateInput } from '../utils/format.utils';
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

const VEHICLE_COLOR_OPTIONS = [
  'Trắng',
  'Đen',
  'Bạc',
  'Xám',
  'Đỏ',
  'Xanh dương',
  'Xanh lá',
  'Vàng',
];

const LICENSE_CLASS_OPTIONS: LicenseClass[] = ['A1', 'A', 'B', 'C1', 'C', 'D1', 'D2', 'D', 'BE', 'C1E', 'CE', 'D1E', 'D2E', 'DE'];
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
      if (typeof reader.result !== 'string') {
        reject(new Error('Invalid image payload'));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error('Cannot read image file'));
    reader.readAsDataURL(file);
  });

const formatLicenseNumberInput = (rawValue: string) => {
  const digits = rawValue.replace(/\D/g, '').slice(0, 12);
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
};

const ProfileSetup: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const minExpiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [snackbarOpen, setSnackbarOpen] = useState(false);

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
  });
  const vehicleYearOptions = Array.from({ length: currentYear - 2014 + 2 }, (_, index) => currentYear + 1 - index);
  const availableMakes = Object.keys(VEHICLE_OPTIONS_BY_TYPE[formData.vehicleType]);
  const availableModels = VEHICLE_OPTIONS_BY_TYPE[formData.vehicleType][formData.vehicleMake] || [];
  const availableLicenseClasses = LICENSE_CLASS_OPTIONS_BY_VEHICLE[formData.vehicleType] || LICENSE_CLASS_OPTIONS;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [imageUploading, setImageUploading] = useState(false);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = field === 'vehicleYear'
      ? Number(e.target.value)
      : field === 'licenseNumber'
        ? formatLicenseNumberInput(e.target.value)
        : field === 'licensePlate'
          ? sanitizeLicensePlateInput(e.target.value)
          : e.target.value;

    setFormData((prev) => ({
      ...prev,
      [field]: nextValue,
    }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleVehicleTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextType = e.target.value as DriverRegistration['vehicleType'];
    const makes = Object.keys(VEHICLE_OPTIONS_BY_TYPE[nextType]);
    const firstMake = makes[0] || '';
    const modelsForFirstMake = VEHICLE_OPTIONS_BY_TYPE[nextType][firstMake] || [];

    setFormData((prev) => ({
      ...prev,
      vehicleType: nextType,
      vehicleMake: makes.includes(prev.vehicleMake) ? prev.vehicleMake : firstMake,
      vehicleModel: makes.includes(prev.vehicleMake)
        ? (VEHICLE_OPTIONS_BY_TYPE[nextType][prev.vehicleMake] || []).includes(prev.vehicleModel)
          ? prev.vehicleModel
          : (VEHICLE_OPTIONS_BY_TYPE[nextType][prev.vehicleMake] || [])[0] || ''
        : modelsForFirstMake[0] || '',
      licenseClass: (LICENSE_CLASS_OPTIONS_BY_VEHICLE[nextType] || []).includes(prev.licenseClass)
        ? prev.licenseClass
        : LICENSE_CLASS_OPTIONS_BY_VEHICLE[nextType][0],
    }));

    setFieldErrors((prev) => ({ ...prev, vehicleType: '', vehicleMake: '', vehicleModel: '', licenseClass: '' }));
  };

  const handleVehicleMakeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextMake = e.target.value;
    const models = VEHICLE_OPTIONS_BY_TYPE[formData.vehicleType][nextMake] || [];

    setFormData((prev) => ({
      ...prev,
      vehicleMake: nextMake,
      vehicleModel: models.includes(prev.vehicleModel) ? prev.vehicleModel : models[0] || '',
    }));

    setFieldErrors((prev) => ({ ...prev, vehicleMake: '', vehicleModel: '' }));
  };

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    const normalizedLicense = formData.licenseNumber.trim();
    const licenseDigits = normalizedLicense.replace(/\s+/g, '');
    const licenseRegex = /^\d{3}\s\d{3}\s\d{3}\s\d{3}$/;

    if (formData.vehicleMake.trim().length < 2) {
      nextErrors.vehicleMake = t('errors.vehicleMakeInvalid');
    }

    if (formData.vehicleModel.trim().length < 2) {
      nextErrors.vehicleModel = t('errors.vehicleModelInvalid');
    }

    if (formData.vehicleColor.trim().length < 2) {
      nextErrors.vehicleColor = t('errors.vehicleColorInvalid');
    }

    if (!Number.isInteger(formData.vehicleYear) || formData.vehicleYear < 1990 || formData.vehicleYear > currentYear + 1) {
      nextErrors.vehicleYear = t('errors.vehicleYearInvalid');
    }

    if (!isValidLicensePlate(formData.licensePlate)) {
      nextErrors.licensePlate = t('errors.licensePlateInvalid');
    }

    if (!formData.vehicleImageUrl || formData.vehicleImageUrl.length < 16) {
      nextErrors.vehicleImageUrl = 'Vui lòng tải ảnh xe rõ biển số';
    }

    if (!licenseRegex.test(normalizedLicense) || licenseDigits.length !== 12) {
      nextErrors.licenseNumber = t('errors.licenseNumberInvalid');
    }

    if (!formData.licenseExpiryDate || formData.licenseExpiryDate < minExpiryDate) {
      nextErrors.licenseExpiryDate = t('errors.licenseExpiryPast');
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleVehicleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      setFieldErrors((prev) => ({ ...prev, vehicleImageUrl: 'Chỉ hỗ trợ ảnh PNG/JPG/WEBP' }));
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setFieldErrors((prev) => ({ ...prev, vehicleImageUrl: 'Ảnh tối đa 3MB' }));
      return;
    }

    setImageUploading(true);
    try {
      const encoded = await fileToDataUrl(file);
      setFormData((prev) => ({ ...prev, vehicleImageUrl: encoded }));
      setFieldErrors((prev) => ({ ...prev, vehicleImageUrl: '' }));
    } catch (err: any) {
      setFieldErrors((prev) => ({ ...prev, vehicleImageUrl: err?.message || 'Không thể xử lý ảnh' }));
    } finally {
      setImageUploading(false);
      e.target.value = '';
    }
  };

  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);

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
      const payload: DriverRegistration = {
        ...formData,
        licensePlate: normalizeLicensePlate(formData.licensePlate),
        licenseNumber: formData.licenseNumber.replace(/\s+/g, ''),
      };
      const response = await driverApi.registerDriver(payload);
      if (response.success) {
        dispatch(setProfile(response.data.driver));
        setSnackbarOpen(true);
        setTimeout(() => navigate('/dashboard'), 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('errors.profileSetupFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <Box sx={{ minHeight: '100vh', background: (theme) => `linear-gradient(160deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 60%, ${theme.palette.secondary.dark} 100%)`, py: { xs: 3, sm: 5 } }}>
      <Container maxWidth="sm">

        {/* ── Hero header ── */}
        <Box sx={{ textAlign: 'center', mb: 4, color: '#fff' }}>
          <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2, border: '2px solid rgba(255,255,255,0.2)' }}>
            <DirectionsCar sx={{ fontSize: 38, color: '#93c5fd' }} />
          </Box>
          <Typography variant="h5" fontWeight={800} gutterBottom>
            {t('profileSetup.title', 'Hoàn thiện hồ sơ tài xế')}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            {t('profileSetup.subtitle', 'Điền đầy đủ thông tin để gửi hồ sơ xét duyệt')}
          </Typography>
          {/* Progress steps */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 2.5 }}>
            {['Xe', 'Biển số', 'GPLX'].map((step, i) => (
              <React.Fragment key={i}>
                <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'rgba(147,197,253,0.3)', border: '2px solid #93c5fd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#93c5fd', fontWeight: 800, fontSize: '0.65rem' }}>{i + 1}</Typography>
                </Box>
                <Typography variant="caption" sx={{ color: '#93c5fd', fontWeight: 700 }}>{step}</Typography>
                {i < 2 && <Box sx={{ width: 24, height: 1, bgcolor: 'rgba(147,197,253,0.3)' }} />}
              </React.Fragment>
            ))}
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 3 }}>{error}</Alert>}

        <form onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

            {/* ── Section 1: Thông tin phương tiện ── */}
            <Card elevation={0} sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Box sx={{ background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`, px: 2.5, py: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DirectionsCar sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 20 }} />
                  <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#fff' }}>Thông tin phương tiện</Typography>
                </Box>
              </Box>
              <CardContent sx={{ p: 2.5 }}>
                <Grid container spacing={2.5}>
                  <Grid item xs={12}>
                    <TextField fullWidth select label={t('profileSetup.vehicleType', 'Loại xe')} value={formData.vehicleType} onChange={handleVehicleTypeChange} required
                      InputProps={{ startAdornment: <InputAdornment position="start"><DirectionsCar /></InputAdornment> }}>
                      <MenuItem value="MOTORBIKE">{VEHICLE_TYPE_LABELS.MOTORBIKE}</MenuItem>
                      <MenuItem value="SCOOTER">{VEHICLE_TYPE_LABELS.SCOOTER}</MenuItem>
                      <MenuItem value="CAR_4">{VEHICLE_TYPE_LABELS.CAR_4}</MenuItem>
                      <MenuItem value="CAR_7">{VEHICLE_TYPE_LABELS.CAR_7}</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth select label={t('profileSetup.vehicleMake', 'Hãng xe')} value={formData.vehicleMake} onChange={handleVehicleMakeChange} required
                      error={Boolean(fieldErrors.vehicleMake)} helperText={fieldErrors.vehicleMake}>
                      {availableMakes.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth select label={t('profileSetup.vehicleModel', 'Dòng xe')} value={formData.vehicleModel} onChange={handleChange('vehicleModel')} required
                      disabled={!formData.vehicleMake} error={Boolean(fieldErrors.vehicleModel)}
                      helperText={fieldErrors.vehicleModel || (!formData.vehicleMake ? 'Chọn hãng xe trước' : '')}>
                      {availableModels.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth select label={t('profileSetup.vehicleColor', 'Màu xe')} value={formData.vehicleColor} onChange={handleChange('vehicleColor')} required
                      error={Boolean(fieldErrors.vehicleColor)} helperText={fieldErrors.vehicleColor}
                      InputProps={{ startAdornment: <InputAdornment position="start"><ColorLens /></InputAdornment> }}>
                      {VEHICLE_COLOR_OPTIONS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth select label={t('profileSetup.vehicleYear', 'Năm sản xuất')} value={formData.vehicleYear} onChange={handleChange('vehicleYear')} required
                      error={Boolean(fieldErrors.vehicleYear)} helperText={fieldErrors.vehicleYear}>
                      {vehicleYearOptions.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                    </TextField>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* ── Section 2: Biển số & ảnh xe ── */}
            <Card elevation={0} sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Box sx={{ background: (theme) => `linear-gradient(135deg, ${theme.palette.secondary.dark} 0%, ${theme.palette.secondary.main} 100%)`, px: 2.5, py: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocalOffer sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 20 }} />
                  <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#fff' }}>Biển số & ảnh xe</Typography>
                </Box>
              </Box>
              <CardContent sx={{ p: 2.5 }}>
                <TextField fullWidth label={t('profileSetup.licensePlate', 'Biển số xe')} value={formData.licensePlate} onChange={handleChange('licensePlate')} required
                  error={Boolean(fieldErrors.licensePlate)} helperText={fieldErrors.licensePlate || 'Định dạng: 29A-12345 hoặc 51H1-678.90'}
                  placeholder="VD: 29A-12345" inputProps={{ maxLength: 12 }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><LocalOffer /></InputAdornment> }}
                  sx={{ mb: 2 }} />

                <Box sx={{ border: '2px dashed', borderColor: formData.vehicleImageUrl ? 'primary.main' : 'divider', borderRadius: 3, p: 2, textAlign: 'center', bgcolor: formData.vehicleImageUrl ? '#eff6ff' : '#fafafa', transition: 'all 0.2s' }}>
                  {formData.vehicleImageUrl ? (
                    <Box>
                      <Box component="img" src={formData.vehicleImageUrl} alt="vehicle-preview" sx={{ width: '100%', maxWidth: 320, borderRadius: 2, mb: 1.5 }} />
                      <Button component="label" variant="outlined" size="small" startIcon={<AddPhotoAlternate />} sx={{ borderRadius: 2 }}>
                        Đổi ảnh
                        <input hidden accept="image/png,image/jpeg,image/webp" type="file" onChange={handleVehicleImageUpload} />
                      </Button>
                    </Box>
                  ) : (
                    <Box>
                      <AddPhotoAlternate sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                      <Typography variant="body2" color="text.secondary" gutterBottom>Tải ảnh xe để admin xét duyệt</Typography>
                      <Button component="label" variant="contained" size="small" startIcon={<AddPhotoAlternate />} disabled={imageUploading} sx={{ borderRadius: 2 }}>
                        {imageUploading ? 'Đang xử lý...' : 'Chọn ảnh'}
                        <input hidden accept="image/png,image/jpeg,image/webp" type="file" onChange={handleVehicleImageUpload} />
                      </Button>
                    </Box>
                  )}
                  {fieldErrors.vehicleImageUrl && <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>{fieldErrors.vehicleImageUrl}</Typography>}
                </Box>
              </CardContent>
            </Card>

            {/* ── Section 3: Giấy phép lái xe ── */}
            <Card elevation={0} sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Box sx={{ background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`, px: 2.5, py: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Badge sx={{ color: '#ddd6fe', fontSize: 20 }} />
                  <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#fff', ml: 0.5 }}>Giấy phép lái xe</Typography>
                </Box>
              </Box>
              <CardContent sx={{ p: 2.5 }}>
                <Grid container spacing={2.5}>
                  <Grid item xs={12} sm={5}>
                    <TextField fullWidth select label="Hạng GPLX" value={formData.licenseClass} onChange={handleChange('licenseClass')} required>
                      {availableLicenseClasses.map((lc) => <MenuItem key={lc} value={lc}>{lc}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={7}>
                    <TextField fullWidth label={t('profileSetup.licenseNumber', 'Số GPLX (12 chữ số)')} value={formData.licenseNumber} onChange={handleChange('licenseNumber')} required
                      error={Boolean(fieldErrors.licenseNumber)} helperText={fieldErrors.licenseNumber}
                      placeholder="052 042 424 424" inputProps={{ maxLength: 15, inputMode: 'numeric' }}
                      InputProps={{ startAdornment: <InputAdornment position="start"><Badge /></InputAdornment> }} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth label={t('profileSetup.licenseExpiry', 'Ngày hết hạn GPLX')} type="date" value={formData.licenseExpiryDate}
                      onChange={handleChange('licenseExpiryDate')} required
                      error={Boolean(fieldErrors.licenseExpiryDate)} helperText={fieldErrors.licenseExpiryDate}
                      InputLabelProps={{ shrink: true }} inputProps={{ min: minExpiryDate }} />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* ── Notice + Submit ── */}
            <Alert severity="info" sx={{ borderRadius: 3 }}>
              <Typography variant="body2">{t('profileSetup.info', 'Hồ sơ sẽ được admin xét duyệt trong 1-2 ngày làm việc. Sau khi duyệt, bạn cần nạp 300.000₫ ký quỹ để bắt đầu nhận cuốc.')}</Typography>
            </Alert>

            <Button fullWidth type="submit" variant="contained" size="large" disabled={loading}
            sx={{ py: 1.8, borderRadius: 4, fontWeight: 800, fontSize: '1rem' }}>
              {loading ? <CircularProgress size={24} color="inherit" /> : t('profileSetup.submit', 'Gửi hồ sơ đăng ký')}
            </Button>

          </Box>
        </form>
      </Container>
    </Box>

    <Snackbar
      open={snackbarOpen}
      autoHideDuration={3000}
      onClose={() => setSnackbarOpen(false)}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        onClose={() => setSnackbarOpen(false)}
        severity="success"
        variant="filled"
        sx={{ width: '100%', borderRadius: 3 }}
      >
        {t('profileSetup.successMessage')}
      </Alert>
    </Snackbar>

    {/* Terms dialog — shows after submitting vehicle info */}
    <Dialog
      open={showTermsDialog}
      onClose={() => setShowTermsDialog(false)}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, maxHeight: '90vh' } }}
    >
      <DialogTitle sx={{ fontWeight: 800, pb: 0 }}>
        ĐIỀU KHOẢN DỊCH VỤ DÀNH CHO TÀI XẾ FOXGO
      </DialogTitle>
      <DialogContent dividers sx={{ overflowY: 'auto' }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          1. Thông tin đăng ký
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Tài xế cam kết cung cấp thông tin cá nhân, giấy phép lái xe và phương tiện chính xác, trung thực. Mọi thông tin giả mạo dẫn đến từ chối hồ sơ và có thể bị xử lý theo pháp luật.
        </Typography>

        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          2. Hoàn tất hồ sơ tài xế
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Sau khi hoàn tất hồ sơ phương tiện và giấy phép lái xe, tài khoản tài xế được tạo trên hệ thống để tiếp tục kích hoạt ví ký quỹ.
        </Typography>

        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          3. Kích hoạt tài khoản & Ví FoxGo Driver
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Tài xế cần nạp tối thiểu <strong>300.000 ₫</strong> vào Ví FoxGo Driver để kích hoạt tài khoản và bắt đầu nhận cuốc xe. Khoản này được ghi nhận là tiền ký quỹ và không dùng để chi tiêu hằng ngày.
        </Typography>

        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          4. Phí nền tảng (hoa hồng)
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          FoxGo thu <strong>20%</strong> trên giá trị mỗi chuyến hoàn tất, khấu trừ tự động từ Ví FoxGo Driver. Với chuyến thanh toán tiền mặt, tài xế nhận đủ tiền từ khách; phần hoa hồng được ghi nợ vào ví sau chuyến.
        </Typography>

        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          5. Quy tắc số dư ví
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Số dư ví không được xuống dưới ngưỡng nợ tối đa <strong>–200.000 ₫</strong>. Khi dự báo sau chuyến vượt ngưỡng này, tài xế không được nhận cuốc tiền mặt đó cho đến khi nạp bổ sung.
        </Typography>

        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          6. Rút tiền
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Tài xế có thể rút số dư khả dụng (tối thiểu <strong>50.000 ₫</strong>) về tài khoản ngân hàng đã đăng ký. Thời gian xử lý 1–3 ngày làm việc.
        </Typography>

        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          7. Hành vi vi phạm
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Mọi hành vi gian lận chuyến đi, hủy chuyến quá mức, vi phạm quy tắc ứng xử hoặc vi phạm pháp luật sẽ bị trừ điểm uy tín và có thể dẫn đến khóa tài khoản vĩnh viễn.
        </Typography>

        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          8. Tạm ngưng tài khoản
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          FoxGo có quyền tạm ngưng tài khoản tài xế khi phát hiện vi phạm hoặc khiếu nại từ khách hàng để tiến hành điều tra. Tài xế sẽ được thông báo và có 7 ngày làm việc để phản hồi.
        </Typography>

        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          9. Thay đổi điều khoản
        </Typography>
        <Typography variant="body2" color="text.secondary">
          FoxGo có quyền cập nhật điều khoản bất cứ lúc nào và sẽ thông báo trước 7 ngày. Việc tiếp tục sử dụng dịch vụ sau thời điểm có hiệu lực đồng nghĩa với việc chấp thuận điều khoản mới.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, flexDirection: 'column', alignItems: 'stretch', gap: 1 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={termsChecked}
              onChange={(e) => setTermsChecked(e.target.checked)}
              color="primary"
            />
          }
          label={
            <Typography variant="body2" fontWeight={600}>
              Tôi đã đọc và đồng ý với tất cả các điều khoản trên
            </Typography>
          }
          sx={{ mr: 0 }}
        />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            onClick={() => { setShowTermsDialog(false); setTermsChecked(false); }}
            variant="outlined"
            fullWidth
            sx={{ borderRadius: 2 }}
          >
            Huỷ
          </Button>
          <Button
            onClick={handleAcceptTermsAndSubmit}
            variant="contained"
            fullWidth
            disabled={!termsChecked}
            sx={{ borderRadius: 2 }}
          >
            Đồng ý &amp; Tiếp tục
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
    </>
  );
};

export default ProfileSetup;
