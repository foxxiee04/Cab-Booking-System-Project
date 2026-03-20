import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
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

const DriverApprovals: React.FC = () => {
  const { t } = useTranslation();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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

    setLoading(true);
    setError('');
    try {
      if (pendingAction === 'approve') {
        await adminApi.approveDriver(selectedDriver.id);
      } else {
        await adminApi.rejectDriver(selectedDriver.id, reason.trim() || undefined);
      }

      closeConfirm();
      await fetchDrivers();
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
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {t('approvals.subtitle')}
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
          <Grid item xs={12} md={6} key={driver.id}>
            <Card sx={{ height: '100%', borderRadius: 4 }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                  <Box>
                    <Typography variant="h6" fontWeight={800}>
                      {driver.user ? `${driver.user.firstName} ${driver.user.lastName}` : driver.id}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {driver.user?.email || t('labels.na')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {driver.user?.phoneNumber || t('labels.na')}
                    </Typography>
                  </Box>
                  <Chip label={t('labels.pending')} color="warning" size="small" />
                </Stack>

                <Stack spacing={1.5} sx={{ mt: 2 }}>
                  <Box>
                    <Typography variant="overline" color="text.secondary">{t('approvals.driverInfo')}</Typography>
                    <Typography variant="body2">{t('approvals.createdAt')}: {formatDateValue(driver.createdAt)}</Typography>
                    <Typography variant="body2">{t('approvals.reviewSummary')}: {driver.reviewCount > 0 ? `${driver.rating.toFixed(1)} / 5 (${driver.reviewCount})` : t('labels.noReviews')}</Typography>
                  </Box>

                  <Box>
                    <Typography variant="overline" color="text.secondary">{t('approvals.vehicleInfo')}</Typography>
                    <Typography variant="body2">{t('approvals.vehicleType')}: {driver.vehicleType}</Typography>
                    <Typography variant="body2">{driver.vehicleMake} {driver.vehicleModel}</Typography>
                    <Typography variant="body2">{driver.vehicleColor} • {t('approvals.vehicleYear')}: {driver.vehicleYear || t('labels.na')}</Typography>
                    <Typography variant="body2">Biển số: {driver.licensePlate}</Typography>
                  </Box>

                  <Box>
                    <Typography variant="overline" color="text.secondary">{t('approvals.licenseInfo')}</Typography>
                    <Typography variant="body2">GPLX: {driver.licenseNumber}</Typography>
                    <Typography variant="body2">{t('approvals.licenseExpiry')}: {formatDateValue(driver.licenseExpiryDate)}</Typography>
                  </Box>
                </Stack>

                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Button variant="contained" color="success" onClick={() => openConfirm(driver, 'approve')}>
                    {t('labels.approve')}
                  </Button>
                  <Button variant="outlined" color="error" onClick={() => openConfirm(driver, 'reject')}>
                    {t('labels.reject')}
                  </Button>
                </Stack>
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
        <DialogActions>
          <Button onClick={closeConfirm}>{t('approvals.cancel')}</Button>
          <Button onClick={handleConfirm} variant="contained" color={pendingAction === 'approve' ? 'success' : 'error'}>
            {t('approvals.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DriverApprovals;