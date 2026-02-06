import React, { useEffect, useState } from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { adminApi } from '../api/admin.api';
import { Customer } from '../types';
import { formatDate } from '../utils/format.utils';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 10;

const Customers: React.FC = () => {
  const [rows, setRows] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await adminApi.getCustomers({
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        });
        setRows(response.data.customers || []);
        setTotal(response.data.total || 0);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || t('errors.loadCustomers'));
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [page]);

  const columns: GridColDef<Customer>[] = [
    { field: 'id', headerName: t('columns.customerId'), flex: 1, minWidth: 200 },
    {
      field: 'name',
      headerName: t('columns.name'),
      flex: 1,
      minWidth: 180,
      valueGetter: (params) => `${params.row.firstName} ${params.row.lastName}`,
    },
    { field: 'email', headerName: t('columns.email'), flex: 1, minWidth: 220 },
    {
      field: 'phoneNumber',
      headerName: t('columns.phone'),
      width: 140,
      valueFormatter: (params) => params.value || t('labels.na'),
    },
    { field: 'totalRides', headerName: t('columns.rides'), width: 100 },
    {
      field: 'rating',
      headerName: t('columns.rating'),
      width: 110,
      valueFormatter: (params) => (params.value ? params.value.toFixed(1) : t('labels.na')),
    },
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
        {t('tables.customers')}
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

export default Customers;
