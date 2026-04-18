import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Slider,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Chip,
  Stack,
} from '@mui/material';
import { TrendingUp, Save } from '@mui/icons-material';
import { pricingApi } from '../api/pricing.api';
import { formatCurrency } from '../utils/format.utils';
import { useTranslation } from 'react-i18next';

const Pricing: React.FC = () => {
  const [multiplier, setMultiplier] = useState(1.0);
  const [reason, setReason] = useState('');
  const [currentSurge, setCurrentSurge] = useState<number>(1.0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    const fetchSurge = async () => {
      try {
        const response = await pricingApi.getSurge();
        setCurrentSurge(response.data.multiplier);
        setMultiplier(response.data.multiplier);
      } catch (err) {
        console.error('Failed to fetch surge:', err);
      }
    };

    fetchSurge();
  }, []);

  const handleUpdateSurge = async () => {
    setLoading(true);
    setSuccess('');
    setError('');

    try {
      await pricingApi.updateSurge({ multiplier, reason });
      setCurrentSurge(multiplier);
      setSuccess(t('pricing.success'));
      setReason('');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('pricing.failed'));
    } finally {
      setLoading(false);
    }
  };

  const getSurgeColor = (value: number) => {
    if (value < 1.3) return 'success';
    if (value < 1.8) return 'warning';
    return 'error';
  };

  const baseFare = 15000;
  const exampleFare = baseFare * multiplier;

  return (
    <Box sx={{ p: 3, minHeight: '100%', background: 'radial-gradient(circle at top left, rgba(124,58,237,0.09), transparent 34%), linear-gradient(180deg, #f8fafc 0%, #eef4fb 100%)' }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        {t('pricing.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('pricing.subtitle')}
      </Typography>

      {success && (
        <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' }, mb: 2.5 }}>
        {[
          { label: 'Surge hiện tại', value: `${currentSurge.toFixed(1)}x`, color: '#7c3aed' },
          { label: 'Surge dự kiến áp dụng', value: `${multiplier.toFixed(1)}x`, color: '#1d4ed8' },
          { label: 'Ví dụ giá gốc', value: formatCurrency(baseFare), color: '#15803d' },
          { label: 'Giá sau điều chỉnh', value: formatCurrency(exampleFare), color: '#d97706' },
        ].map((item) => (
          <Card key={item.label} elevation={0} sx={{ borderRadius: 4, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.06)' }}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="caption" color="text.secondary">{item.label}</Typography>
              <Typography variant="h5" fontWeight={900} sx={{ mt: 0.5, color: item.color }}>{item.value}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.35fr) 360px' } }}>
        <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.06)' }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <TrendingUp sx={{ fontSize: 32, color: 'primary.main', mr: 1 }} />
              <Box>
                <Typography variant="h6" fontWeight={800}>{t('pricing.currentSurge')}</Typography>
                <Chip
                  label={`${currentSurge.toFixed(1)}x`}
                  color={getSurgeColor(currentSurge)}
                  size="small"
                />
              </Box>
            </Box>

            <Box sx={{ mb: 4 }}>
              <Typography variant="body1" gutterBottom>
                {t('pricing.surgeMultiplier')}: <strong>{multiplier.toFixed(1)}x</strong>
              </Typography>
              <Slider
                value={multiplier}
                onChange={(_, value) => setMultiplier(value as number)}
                min={1.0}
                max={3.0}
                step={0.1}
                marks={[
                  { value: 1.0, label: '1.0x' },
                  { value: 1.5, label: '1.5x' },
                  { value: 2.0, label: '2.0x' },
                  { value: 2.5, label: '2.5x' },
                  { value: 3.0, label: '3.0x' },
                ]}
                color={getSurgeColor(multiplier)}
                sx={{ mt: 2 }}
              />
            </Box>

            <Box sx={{ mb: 3, p: 2, bgcolor: '#f8fafc', borderRadius: 3, border: '1px solid rgba(148,163,184,0.16)' }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {t('pricing.example', { amount: formatCurrency(baseFare) })}
              </Typography>
              <Typography variant="h5" color="primary" fontWeight={900}>
                {t('pricing.newFare', { amount: formatCurrency(exampleFare) })}
              </Typography>
            </Box>

            <TextField
              fullWidth
              label={t('pricing.reason')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('pricing.reasonPlaceholder')}
              multiline
              rows={3}
              sx={{ mb: 3 }}
            />

            <Stack direction="row" justifyContent="center">
              <Button
                variant="contained"
                size="large"
                startIcon={loading ? <CircularProgress size={20} /> : <Save />}
                onClick={handleUpdateSurge}
                disabled={loading || multiplier === currentSurge}
                sx={{ minWidth: 240, borderRadius: 3 }}
              >
                {t('pricing.update')}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.06)' }}>
          <CardContent>
            <Typography variant="h6" fontWeight={800} gutterBottom>
              {t('pricing.guidelines')}
            </Typography>
            <Stack spacing={1.5} sx={{ mt: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(34,197,94,0.08)' }}>
                <Chip label="1.0-1.2x" color="success" size="small" sx={{ mb: 0.75 }} />
                <Typography variant="body2">{t('pricing.normal')}</Typography>
              </Box>
              <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(245,158,11,0.12)' }}>
                <Chip label="1.3-1.7x" color="warning" size="small" sx={{ mb: 0.75 }} />
                <Typography variant="body2">{t('pricing.moderate')}</Typography>
              </Box>
              <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(239,68,68,0.1)' }}>
                <Chip label="1.8-3.0x" color="error" size="small" sx={{ mb: 0.75 }} />
                <Typography variant="body2">{t('pricing.high')}</Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default Pricing;
