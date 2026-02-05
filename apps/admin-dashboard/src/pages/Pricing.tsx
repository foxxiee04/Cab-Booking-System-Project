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
} from '@mui/material';
import { TrendingUp, Save } from '@mui/icons-material';
import { pricingApi } from '../api/pricing.api';
import { formatCurrency } from '../utils/format.utils';

const Pricing: React.FC = () => {
  const [multiplier, setMultiplier] = useState(1.0);
  const [reason, setReason] = useState('');
  const [currentSurge, setCurrentSurge] = useState<number>(1.0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

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
      setSuccess('Surge pricing updated successfully!');
      setReason('');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to update surge pricing');
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
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Surge Pricing Management
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Adjust dynamic pricing based on demand
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

      <Card elevation={2}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <TrendingUp sx={{ fontSize: 32, color: 'primary.main', mr: 1 }} />
            <Box>
              <Typography variant="h6">Current Surge</Typography>
              <Chip
                label={`${currentSurge.toFixed(1)}x`}
                color={getSurgeColor(currentSurge)}
                size="small"
              />
            </Box>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant="body1" gutterBottom>
              Surge Multiplier: <strong>{multiplier.toFixed(1)}x</strong>
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

          <Box sx={{ mb: 3, p: 2, bgcolor: '#F5F5F5', borderRadius: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Example: Base Fare {formatCurrency(baseFare)}
            </Typography>
            <Typography variant="h5" color="primary">
              New Fare: {formatCurrency(exampleFare)}
            </Typography>
          </Box>

          <TextField
            fullWidth
            label="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., High demand, Weather conditions"
            multiline
            rows={2}
            sx={{ mb: 3 }}
          />

          <Button
            fullWidth
            variant="contained"
            size="large"
            startIcon={loading ? <CircularProgress size={20} /> : <Save />}
            onClick={handleUpdateSurge}
            disabled={loading || multiplier === currentSurge}
          >
            Update Surge Pricing
          </Button>
        </CardContent>
      </Card>

      <Card elevation={2} sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Surge Pricing Guidelines
          </Typography>
          <Box sx={{ '& > div': { mb: 1 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Chip label="1.0-1.2x" color="success" size="small" sx={{ mr: 1 }} />
              <Typography variant="body2">Normal demand</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Chip label="1.3-1.7x" color="warning" size="small" sx={{ mr: 1 }} />
              <Typography variant="body2">Moderate demand</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Chip label="1.8-3.0x" color="error" size="small" sx={{ mr: 1 }} />
              <Typography variant="body2">High demand</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Pricing;
