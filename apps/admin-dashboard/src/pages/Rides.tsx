import React, { useEffect, useState } from 'react';
import { Box, Typography, Chip, Alert } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { adminApi } from '../api/admin.api';
import { Ride } from '../types';
import { formatCurrency, formatDate, getRideStatusColor } from '../utils/format.utils';

const PAGE_SIZE = 10;

const Rides: React.FC = () => {
  const [rows, setRows] = useState<Ride[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchRides = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await adminApi.getRides({
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        });
        setRows(response.data.rides || []);
        setTotal(response.data.total || 0);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || 'Failed to load rides');
      } finally {
        setLoading(false);
      }
    };

    fetchRides();
  }, [page]);

  const columns: GridColDef<Ride>[] = [
    { field: 'id', headerName: 'Ride ID', flex: 1, minWidth: 220 },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={getRideStatusColor(params.value)}
        />
      ),
    },
    {
      field: 'customer',
      headerName: 'Customer',
      flex: 1,
      minWidth: 160,
      valueGetter: (params) =>
        params.row.customer ? `${params.row.customer.firstName} ${params.row.customer.lastName}` : params.row.customerId,
    },
    {
      field: 'driver',
      headerName: 'Driver',
      flex: 1,
      minWidth: 160,
      valueGetter: (params) =>
        params.row.driver ? `${params.row.driver.firstName} ${params.row.driver.lastName}` : params.row.driverId || 'N/A',
    },
    {
      field: 'fare',
      headerName: 'Fare',
      width: 140,
      valueFormatter: (params) => (params.value ? formatCurrency(params.value) : 'N/A'),
    },
    { field: 'paymentMethod', headerName: 'Payment', width: 120 },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 170,
      valueFormatter: (params) => formatDate(params.value),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold">
        Rides Management
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mt: 2, height: 520 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          rowCount={total}
          loading={loading}
          paginationMode="server"
          pageSizeOptions={[PAGE_SIZE]}
          paginationModel={{ page, pageSize: PAGE_SIZE }}
          onPaginationModelChange={(model) => setPage(model.page)}
          getRowId={(row) => row.id}
        />
      </Box>
    </Box>
  );
};

export default Rides;
