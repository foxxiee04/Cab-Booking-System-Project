import React, { useEffect, useState } from 'react';
import { Box, Typography, Chip, Alert } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { adminApi } from '../api/admin.api';
import { Ride } from '../types';
import { formatCurrency, formatDate, getRideStatusColor } from '../utils/format.utils';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 10;

const Rides: React.FC = () => {
  const [rows, setRows] = useState<Ride[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

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
        setError(err.response?.data?.error?.message || t('errors.loadRides'));
      } finally {
        setLoading(false);
      }
    };

    fetchRides();
  }, [page]);

  const columns: GridColDef<Ride>[] = [
    { field: 'id', headerName: t('columns.rideId'), flex: 1, minWidth: 220 },
    {
      field: 'status',
      headerName: t('columns.status'),
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
      headerName: t('columns.customer'),
      flex: 1,
      minWidth: 160,
      valueGetter: (params) =>
        params.row.customer ? `${params.row.customer.firstName} ${params.row.customer.lastName}` : params.row.customerId,
    },
    {
      field: 'driver',
      headerName: t('columns.driver'),
      flex: 1,
      minWidth: 160,
      valueGetter: (params) =>
        params.row.driver ? `${params.row.driver.firstName} ${params.row.driver.lastName}` : params.row.driverId || t('labels.na'),
    },
    {
      field: 'fare',
      headerName: t('columns.fare'),
      width: 140,
      valueFormatter: (params) => (params.value ? formatCurrency(params.value) : t('labels.na')),
    },
    { field: 'paymentMethod', headerName: t('columns.payment'), width: 120 },
    {
      field: 'createdAt',
      headerName: t('columns.created'),
      width: 170,
      valueFormatter: (params) => formatDate(params.value),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold">
        {t('tables.rides')}
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
