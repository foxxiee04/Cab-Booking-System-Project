import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  DirectionsCar,
  People,
  AttachMoney,
  DriveEta,
  Payment,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setStats } from '../store/admin.slice';
import { adminApi } from '../api/admin.api';
import { formatCurrency, formatNumber } from '../utils/format.utils';

const Dashboard: React.FC = () => {
  const dispatch = useAppDispatch();
  const { stats } = useAppSelector((state) => state.admin);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await adminApi.getStats();
        dispatch(setStats(response.data.stats));
      } catch (err: any) {
        setError('Failed to load statistics');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s

    return () => clearInterval(interval);
  }, [dispatch]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 3 }}>
        {error}
      </Alert>
    );
  }

  if (!stats) {
    return (
      <Alert severity="info" sx={{ m: 3 }}>
        No statistics available
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Dashboard Overview
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Real-time system statistics and metrics
      </Typography>

      <Grid container spacing={3}>
        {/* Total Rides */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Total Rides
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" sx={{ my: 1 }}>
                    {formatNumber(stats.rides.total)}
                  </Typography>
                  <Typography variant="caption" color="success.main">
                    +{stats.rides.today} today
                  </Typography>
                </Box>
                <DirectionsCar sx={{ fontSize: 48, color: 'primary.main', opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Active Drivers */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Online Drivers
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" sx={{ my: 1 }}>
                    {stats.drivers.online}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    of {stats.drivers.total} total
                  </Typography>
                </Box>
                <DriveEta sx={{ fontSize: 48, color: 'success.main', opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Total Customers */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Total Customers
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" sx={{ my: 1 }}>
                    {formatNumber(stats.customers.total)}
                  </Typography>
                  <Typography variant="caption" color="success.main">
                    {stats.customers.active} active
                  </Typography>
                </Box>
                <People sx={{ fontSize: 48, color: 'info.main', opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Total Revenue */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Today's Revenue
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" sx={{ my: 1 }}>
                    {formatCurrency(stats.revenue.today)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Month: {formatCurrency(stats.revenue.month)}
                  </Typography>
                </Box>
                <AttachMoney sx={{ fontSize: 48, color: 'warning.main', opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Ride Status Breakdown */}
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Ride Status
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#FFF3E0', borderRadius: 2 }}>
                    <Typography variant="h5" fontWeight="bold">
                      {stats.rides.pending}
                    </Typography>
                    <Typography variant="caption">Pending</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#E3F2FD', borderRadius: 2 }}>
                    <Typography variant="h5" fontWeight="bold">
                      {stats.rides.active}
                    </Typography>
                    <Typography variant="caption">Active</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#E8F5E9', borderRadius: 2 }}>
                    <Typography variant="h5" fontWeight="bold">
                      {stats.rides.completed}
                    </Typography>
                    <Typography variant="caption">Completed</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#FFEBEE', borderRadius: 2 }}>
                    <Typography variant="h5" fontWeight="bold">
                      {stats.rides.cancelled}
                    </Typography>
                    <Typography variant="caption">Cancelled</Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Payment Status */}
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Payment Status
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#FFF3E0', borderRadius: 2 }}>
                    <Payment sx={{ fontSize: 32, color: 'warning.main', mb: 1 }} />
                    <Typography variant="h5" fontWeight="bold">
                      {stats.payments.pending}
                    </Typography>
                    <Typography variant="caption">Pending</Typography>
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#E8F5E9', borderRadius: 2 }}>
                    <Payment sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
                    <Typography variant="h5" fontWeight="bold">
                      {stats.payments.completed}
                    </Typography>
                    <Typography variant="caption">Completed</Typography>
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#FFEBEE', borderRadius: 2 }}>
                    <Payment sx={{ fontSize: 32, color: 'error.main', mb: 1 }} />
                    <Typography variant="h5" fontWeight="bold">
                      {stats.payments.failed}
                    </Typography>
                    <Typography variant="caption">Failed</Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
