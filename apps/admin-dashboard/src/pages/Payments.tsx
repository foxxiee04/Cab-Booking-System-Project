import React, { useEffect, useState } from 'react';
import { Box, Typography, Alert, Chip } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { adminApi } from '../api/admin.api';
import { Payment } from '../types';
import { formatCurrency, formatDate, getPaymentStatusColor } from '../utils/format.utils';

const PAGE_SIZE = 10;

const Payments: React.FC = () => {
  const [rows, setRows] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        setError(err.response?.data?.error?.message || 'Failed to load payments');
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, [page]);

  const columns: GridColDef<Payment>[] = [
    { field: 'id', headerName: 'Payment ID', flex: 1, minWidth: 210 },
    { field: 'rideId', headerName: 'Ride ID', flex: 1, minWidth: 210 },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 140,
      valueFormatter: (params) => formatCurrency(params.value),
    },
    { field: 'method', headerName: 'Method', width: 120 },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (params) => (
        <Chip label={params.value} size="small" color={getPaymentStatusColor(params.value)} />
      ),
    },
    {
      field: 'transactionId',
      headerName: 'Transaction',
      width: 180,
      valueFormatter: (params) => params.value || 'N/A',
    },
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
        Payments Management
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
