import React, { useEffect, useState } from 'react';
import { Box, Typography, Alert, Chip } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { adminApi } from '../api/admin.api';
import { Payment } from '../types';
import { formatCurrency, formatDate, getPaymentStatusColor } from '../utils/format.utils';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 10;

const Payments: React.FC = () => {
  const [rows, setRows] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    const fetchPayments = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await adminApi.getPayments({
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        });
        setRows(response.data.payments || []);
        setTotal(response.data.total || 0);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || t('errors.loadPayments'));
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, [page]);

  const columns: GridColDef<Payment>[] = [
    { field: 'id', headerName: t('columns.paymentId'), flex: 1, minWidth: 210 },
    { field: 'rideId', headerName: t('columns.rideId'), flex: 1, minWidth: 210 },
    {
      field: 'amount',
      headerName: t('columns.amount'),
      width: 140,
      valueFormatter: (params) => formatCurrency(params.value),
    },
    { field: 'method', headerName: t('columns.method'), width: 120 },
    {
      field: 'status',
      headerName: t('columns.status'),
      width: 130,
      renderCell: (params) => (
        <Chip label={params.value} size="small" color={getPaymentStatusColor(params.value)} />
      ),
    },
    {
      field: 'transactionId',
      headerName: t('columns.transaction'),
      width: 180,
      valueFormatter: (params) => params.value || t('labels.na'),
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
        {t('tables.payments')}
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

export default Payments;
