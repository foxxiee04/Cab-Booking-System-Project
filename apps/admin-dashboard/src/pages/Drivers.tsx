import React, { useEffect, useState } from 'react';
import { Box, Typography, Chip, Alert } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { adminApi } from '../api/admin.api';
import { Driver } from '../types';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 10;

const Drivers: React.FC = () => {
  const [rows, setRows] = useState<Driver[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    const fetchDrivers = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await adminApi.getDrivers({
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        });
        setRows(response.data.drivers || []);
        setTotal(response.data.total || 0);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || t('errors.loadDrivers'));
      } finally {
        setLoading(false);
      }
    };

    fetchDrivers();
  }, [page]);

  const columns: GridColDef<Driver>[] = [
    { field: 'id', headerName: t('columns.driverId'), flex: 1, minWidth: 200 },
    {
      field: 'name',
      headerName: t('columns.name'),
      flex: 1,
      minWidth: 180,
      valueGetter: (params) =>
        params.row.user ? `${params.row.user.firstName} ${params.row.user.lastName}` : t('labels.na'),
    },
    {
      field: 'email',
      headerName: t('columns.email'),
      flex: 1,
      minWidth: 200,
      valueGetter: (params) => params.row.user?.email || t('labels.na'),
    },
    { field: 'vehicleType', headerName: t('columns.vehicle'), width: 120 },
    {
      field: 'rating',
      headerName: t('columns.rating'),
      width: 100,
      valueFormatter: (params) => params.value?.toFixed(1),
    },
    { field: 'totalRides', headerName: t('columns.rides'), width: 100 },
    {
      field: 'isOnline',
      headerName: t('columns.online'),
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value ? t('labels.online') : t('labels.offline')}
          size="small"
          color={params.value ? 'success' : 'default'}
        />
      ),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold">
        {t('tables.drivers')}
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

export default Drivers;
