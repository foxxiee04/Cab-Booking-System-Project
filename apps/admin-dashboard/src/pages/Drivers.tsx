import React, { useCallback, useEffect, useState } from 'react';
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

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await adminApi.getDrivers({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setRows(response.data?.drivers || []);
      setTotal(response.data?.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('errors.loadDrivers'));
    } finally {
      setLoading(false);
    }
  }, [page, t]);

  useEffect(() => {
    void fetchDrivers();
  }, [fetchDrivers]);

  const getApprovalMeta = (status: Driver['status']) => {
    if (status === 'APPROVED') {
      return { label: t('labels.approved'), color: 'success' as const };
    }

    if (status === 'REJECTED') {
      return { label: t('labels.rejected'), color: 'error' as const };
    }

    if (status === 'SUSPENDED') {
      return { label: t('labels.suspended'), color: 'warning' as const };
    }

    return { label: t('labels.pending'), color: 'default' as const };
  };

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
      field: 'status',
      headerName: t('columns.approval'),
      width: 140,
      renderCell: (params) => {
        const meta = getApprovalMeta(params.row.status);
        return <Chip label={meta.label} size="small" color={meta.color} />;
      },
    },
    {
      field: 'rating',
      headerName: t('columns.rating'),
      width: 140,
      renderCell: (params) => (
        <Typography variant="body2">
          {params.row.reviewCount > 0 ? `${params.row.rating.toFixed(1)} / 5` : t('labels.noReviews')}
        </Typography>
      ),
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
