import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  BadgeOutlined,
  CalendarMonthOutlined,
  DirectionsCarFilledOutlined,
  LocalPhoneOutlined,
  MailOutline,
} from '@mui/icons-material';
import { adminApi } from '../api/admin.api';
import { Driver } from '../types';
import { useTranslation } from 'react-i18next';

type ApprovalAction = 'approve' | 'reject';

const formatDateValue = (value?: string) => {
  if (!value) {
    return 'Chưa có';
  }

  return new Date(value).toLocaleString('vi-VN');
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

const VEHICLE_TYPE_LABELS: Record<Driver['vehicleType'], string> = {
  MOTORBIKE: 'Xe máy số',
  SCOOTER: 'Xe tay ga',
  CAR_4: 'Ô tô 4 chỗ',
  CAR_7: 'Ô tô 7 chỗ',
};

const DetailRow: React.FC<{ label: string; value: React.ReactNode; emphasize?: boolean }> = ({ label, value, emphasize = false }) => (
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

const InfoSection: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
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

const DriverApprovals: React.FC = () => {
  const { t } = useTranslation();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [pendingAction, setPendingAction] = useState<ApprovalAction | null>(null);
  const [reason, setReason] = useState('');

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await adminApi.getDrivers({ status: 'PENDING', limit: 100, offset: 0 });
      setDrivers(response.data?.drivers || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('errors.loadDrivers'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchDrivers();
  }, [fetchDrivers]);

  const dialogTitle = useMemo(() => {
    if (pendingAction === 'approve') {
      return t('approvals.approveConfirmTitle');
    }

    if (pendingAction === 'reject') {
      return t('approvals.rejectConfirmTitle');
    }

    return '';
  }, [pendingAction, t]);

  const dialogBody = pendingAction === 'approve'
    ? t('approvals.approveConfirmBody')
    : t('approvals.rejectConfirmBody');

  const openConfirm = (driver: Driver, action: ApprovalAction) => {
    setSelectedDriver(driver);
    setPendingAction(action);
    setReason('');
  };

  const closeConfirm = () => {
    setSelectedDriver(null);
    setPendingAction(null);
    setReason('');
  };

  const handleConfirm = async () => {
    if (!selectedDriver || !pendingAction) {
      return;
    }

    const driverName = selectedDriver.user
      ? `${selectedDriver.user.firstName} ${selectedDriver.user.lastName}`.trim()
      : selectedDriver.id.slice(0, 8).toUpperCase();

    setLoading(true);
    setError('');
    try {
      if (pendingAction === 'approve') {
        await adminApi.approveDriver(selectedDriver.id);
        setSuccessMsg(`Đã duyệt hồ sơ tài xế ${driverName}. Tài xế đã được thông báo và có thể bắt đầu nhận cuốc.`);
      } else {
        await adminApi.rejectDriver(selectedDriver.id, reason.trim() || undefined);
        setSuccessMsg(`Đã từ chối hồ sơ tài xế ${driverName}.`);
      }

      closeConfirm();
      await fetchDrivers();
      // Notify App to refresh the pending count badge immediately
      window.dispatchEvent(new Event('driver-approval-changed'));
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message
          || (pendingAction === 'approve' ? t('errors.approveDriver') : t('errors.rejectDriver'))
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold">
        {t('tables.driverApprovals')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && drivers.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {t('approvals.empty')}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mt: 1 }}>
        {drivers.map((driver) => (
          <Grid item xs={12} key={driver.id}>
            <Card
              sx={{
                height: '100%',
                borderRadius: 4,
                border: '1px solid rgba(148,163,184,0.18)',
                boxShadow: '0 18px 44px rgba(15,23,42,0.06)',
                overflow: 'hidden',
              }}
            >
              <CardContent sx={{ p: 0 }}>
                <Box
                  sx={{
                    px: 2.5,
                    py: 2.25,
                    background: 'linear-gradient(135deg, rgba(248,250,252,1) 0%, rgba(241,245,249,0.96) 100%)',
                    borderBottom: '1px solid rgba(148,163,184,0.16)',
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar sx={{ bgcolor: 'primary.dark', width: 48, height: 48, fontWeight: 800 }}>
                        {driver.user?.firstName?.[0] || 'D'}
                      </Avatar>
                      <Box>
                        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                          Hồ sơ tài xế chờ duyệt
                        </Typography>
                        <Typography variant="h6" fontWeight={900} sx={{ lineHeight: 1.2 }}>
                          {driver.user ? `${driver.user.firstName} ${driver.user.lastName}` : driver.id}
                        </Typography>
                        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.75, flexWrap: 'wrap' }}>
                          <Chip label={t('labels.pending')} color="warning" size="small" sx={{ fontWeight: 700 }} />
                          <Chip label={VEHICLE_TYPE_LABELS[driver.vehicleType]} variant="outlined" size="small" />
                        </Stack>
                      </Box>
                    </Stack>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Mã hồ sơ
                      </Typography>
                      <Typography variant="body2" fontWeight={700}>
                        {driver.id.slice(0, 8).toUpperCase()}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>

<Box sx={{ p: 2.5 }}>
  <Grid container spacing={2.5} alignItems="stretch">
    {/* Cột trái: ảnh + thông tin xe */}
    <Grid item xs={12} lg={4}>
      <InfoSection
        title="Ảnh xe đối chiếu"
        icon={<DirectionsCarFilledOutlined sx={{ fontSize: 18, color: '#475569' }} />}
      >
        {driver.vehicleImageUrl ? (
          <Box
            component="img"
            src={resolveVehicleImageUrl(driver.vehicleImageUrl)}
            alt={`${driver.vehicleMake} ${driver.vehicleModel}`.trim() || 'vehicle'}
            sx={{
              width: '100%',
              aspectRatio: '4 / 3',
              objectFit: 'cover',
              borderRadius: 3,
              border: '1px solid rgba(148,163,184,0.22)',
              bgcolor: '#f8fafc',
              display: 'block',
            }}
          />
        ) : (
          <Stack
            alignItems="center"
            justifyContent="center"
            sx={{
              aspectRatio: '4 / 3',
              borderRadius: 3,
              border: '1px dashed rgba(148,163,184,0.4)',
              bgcolor: '#f8fafc',
            }}
          >
            <Typography variant="body2" color="text.secondary" align="center">
              Chưa có ảnh xe để đối chiếu.
            </Typography>
          </Stack>
        )}

        <Divider sx={{ my: 1 }} />

        <DetailRow label="Loại xe" value={VEHICLE_TYPE_LABELS[driver.vehicleType]} emphasize />
        <DetailRow label="Dòng xe" value={`${driver.vehicleMake} ${driver.vehicleModel}`.trim() || t('labels.na')} emphasize />
        <DetailRow label="Màu sắc" value={driver.vehicleColor || t('labels.na')} />
        <DetailRow label="Năm sản xuất" value={driver.vehicleYear || t('labels.na')} />
        <DetailRow label="Biển số" value={driver.licensePlate || t('labels.na')} emphasize />
      </InfoSection>
    </Grid>

    {/* Cột phải: thông tin tài xế + giấy phép */}
    <Grid item xs={12} lg={8}>
      <Stack spacing={2} sx={{ height: '100%' }}>
        <InfoSection
          title="Thông tin tài xế"
          icon={<BadgeOutlined sx={{ fontSize: 18, color: '#475569' }} />}
        >
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={6}>
              <DetailRow
                label="Họ và tên"
                value={driver.user ? `${driver.user.firstName} ${driver.user.lastName}` : t('labels.na')}
                emphasize
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <DetailRow
                label="Ngày gửi hồ sơ"
                value={
                  <Stack direction="row" spacing={0.75} justifyContent="flex-end" alignItems="center">
                    <CalendarMonthOutlined sx={{ fontSize: 15, color: '#64748b' }} />
                    <span>{formatDateValue(driver.createdAt)}</span>
                  </Stack>
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <DetailRow
                label="Email"
                value={
                  <Stack direction="row" spacing={0.75} justifyContent="flex-end" alignItems="center">
                    <MailOutline sx={{ fontSize: 15, color: '#64748b' }} />
                    <span>{driver.user?.email || t('labels.na')}</span>
                  </Stack>
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <DetailRow
                label="Số liên hệ"
                value={
                  <Stack direction="row" spacing={0.75} justifyContent="flex-end" alignItems="center">
                    <LocalPhoneOutlined sx={{ fontSize: 15, color: '#64748b' }} />
                    <span>{driver.user?.phoneNumber || t('labels.na')}</span>
                  </Stack>
                }
              />
            </Grid>
          </Grid>
        </InfoSection>

        <InfoSection
          title="Thông tin giấy phép & phương tiện"
          icon={<BadgeOutlined sx={{ fontSize: 18, color: '#475569' }} />}
        >
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={6}>
              <DetailRow label="Mã hồ sơ" value={driver.id.slice(0, 8).toUpperCase()} emphasize />
            </Grid>
            <Grid item xs={12} md={6}>
              <DetailRow
                label="Trạng thái"
                value={<Chip label={t('labels.pending')} color="warning" size="small" sx={{ fontWeight: 700 }} />}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <DetailRow label="Hạng GPLX" value={driver.licenseClass || t('labels.na')} emphasize />
            </Grid>
            <Grid item xs={12} md={6}>
              <DetailRow label="Số GPLX" value={driver.licenseNumber || t('labels.na')} emphasize />
            </Grid>
            <Grid item xs={12} md={6}>
              <DetailRow label="Ngày hết hạn" value={formatDateValue(driver.licenseExpiryDate)} />
            </Grid>
            <Grid item xs={12} md={6}>
              <DetailRow label="Loại dịch vụ" value={VEHICLE_TYPE_LABELS[driver.vehicleType]} />
            </Grid>
          </Grid>
        </InfoSection>
      </Stack>
    </Grid>
  </Grid>

  <Divider sx={{ my: 2 }} />

  <Stack direction="row" spacing={1} justifyContent="center" useFlexGap flexWrap="wrap">
    <Button
      variant="contained"
      color="success"
      onClick={() => openConfirm(driver, 'approve')}
      sx={{ minWidth: 120, borderRadius: 999 }}
    >
      {t('labels.approve')}
    </Button>
    <Button
      variant="outlined"
      color="error"
      onClick={() => openConfirm(driver, 'reject')}
      sx={{ minWidth: 120, borderRadius: 999 }}
    >
      {t('labels.reject')}
    </Button>
  </Stack>
</Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={Boolean(selectedDriver && pendingAction)} onClose={closeConfirm} maxWidth="xs" fullWidth>
        <DialogTitle>{dialogTitle}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {dialogBody}
          </Typography>
          {pendingAction === 'reject' && (
            <TextField
              fullWidth
              multiline
              minRows={3}
              label={t('labels.rejectionPrompt')}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              sx={{ mt: 2 }}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2, px: 3 }}>
          <Button onClick={closeConfirm}>{t('approvals.cancel')}</Button>
          <Button onClick={handleConfirm} variant="contained" color={pendingAction === 'approve' ? 'success' : 'error'}>
            {t('approvals.confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!successMsg}
        autoHideDuration={5000}
        onClose={() => setSuccessMsg('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setSuccessMsg('')} severity="success" variant="filled" sx={{ width: '100%', borderRadius: 3 }}>
          {successMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DriverApprovals;