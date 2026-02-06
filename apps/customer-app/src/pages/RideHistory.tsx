import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Container,
  Typography,
  Chip,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { rideApi } from '../api/ride.api';
import { Ride } from '../types';
import {
  formatCurrency,
  formatDate,
  getRideStatusLabel,
  getRideStatusColor,
  getVehicleTypeLabel,
} from '../utils/format.utils';

const PAGE_SIZE = 10;

const RideHistory: React.FC = () => {
  const navigate = useNavigate();
  const [rides, setRides] = useState<Ride[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await rideApi.getRideHistory(page, PAGE_SIZE);
        setRides(response.data.rides || []);
        setTotal(response.data.total || 0);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || 'Failed to load ride history');
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
        Ride History
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
          No rides found.
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
                  sx={{ bgcolor: getRideStatusColor(ride.status), color: '#fff' }}
                  size="small"
                />
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {formatDate(ride.requestedAt)}
              </Typography>

              <Typography variant="body2" sx={{ mt: 1 }}>
                Pickup: {ride.pickup.address || `${ride.pickup.lat}, ${ride.pickup.lng}`}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                Dropoff: {ride.dropoff.address || `${ride.dropoff.lat}, ${ride.dropoff.lng}`}
              </Typography>

              <Typography variant="body2" sx={{ mt: 1 }}>
                Fare: {ride.fare ? formatCurrency(ride.fare) : 'N/A'}
              </Typography>

              <Button
                size="small"
                sx={{ mt: 1 }}
                onClick={() => navigate(`/ride/${ride.id}`)}
              >
                View Ride
              </Button>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
        <Button
          variant="outlined"
          disabled={page <= 1}
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
        >
          Previous
        </Button>
        <Button
          variant="outlined"
          disabled={page >= totalPages}
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
        >
          Next
        </Button>
        <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
          Page {page} / {totalPages}
        </Typography>
      </Box>
    </Container>
  );
};

export default RideHistory;
