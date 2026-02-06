import React, { useEffect, useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { driverApi } from '../api/driver.api';
import { setEarnings } from '../store/driver.slice';
import { formatCurrency, formatEarnings } from '../utils/format.utils';

const Earnings: React.FC = () => {
  const dispatch = useAppDispatch();
  const { earnings } = useAppSelector((state) => state.driver);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEarnings = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await driverApi.getEarnings();
        dispatch(setEarnings(response.data.earnings));
      } catch (err: any) {
        setError(err.response?.data?.error?.message || 'Failed to load earnings');
      } finally {
        setLoading(false);
      }
    };

    fetchEarnings();
  }, [dispatch]);

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight="bold">
        Earnings
      </Typography>

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

      {earnings && (
        <Box sx={{ mt: 2, display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Today
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {formatCurrency(earnings.today)}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                This Week
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {formatEarnings(earnings.week)}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                This Month
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {formatEarnings(earnings.month)}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Rides
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {earnings.totalRides}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}
    </Container>
  );
};

export default Earnings;
