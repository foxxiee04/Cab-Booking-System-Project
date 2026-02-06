import React, { useEffect, useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import { driverApi } from '../api/driver.api';
import { Ride } from '../types';
import {
  formatCurrency,
  formatDate,
  getRideStatusColor,
  getRideStatusLabel,
  getVehicleTypeLabel,
  getPaymentMethodLabel,
} from '../utils/format.utils';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 10;

const History: React.FC = () => {
  const { t } = useTranslation();
  const [rides, setRides] = useState<Ride[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await driverApi.getRideHistory({
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        });
        setRides(response.data.rides || []);
        setTotal(response.data.total || 0);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || t('errors.loadRideHistory'));
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight="bold">
        {t('history.title')}
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

      {!loading && rides.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {t('history.noRides')}
        </Typography>
      )}

      <Box sx={{ mt: 2, display: 'grid', gap: 2 }}>
        {rides.map((ride) => (
          <Card key={ride.id} variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  {getVehicleTypeLabel(ride.vehicleType)}
                </Typography>
                <Chip
                  label={getRideStatusLabel(ride.status)}
                  color={getRideStatusColor(ride.status)}
                  size="small"
                />
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {formatDate(ride.createdAt)}
              </Typography>

              <Typography variant="body2" sx={{ mt: 1 }}>
                {t('history.fare')}: {ride.fare ? formatCurrency(ride.fare) : 'N/A'}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {t('history.payment')}: {getPaymentMethodLabel(ride.paymentMethod)}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
        <Button
          variant="outlined"
          disabled={page <= 0}
          onClick={() => setPage((prev) => Math.max(0, prev - 1))}
        >
          {t('history.previous')}
        </Button>
        <Button
          variant="outlined"
          disabled={page >= totalPages - 1}
          onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
        >
          {t('history.next')}
        </Button>
        <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
          {t('history.page', { page: page + 1, total: totalPages })}
        </Typography>
      </Box>
    </Container>
  );
};

export default History;
