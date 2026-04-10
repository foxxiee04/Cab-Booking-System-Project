import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Alert, Chip } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { adminApi } from '../api/admin.api';
import { Payment } from '../types';
import { formatCurrency, formatDate, getPaymentStatusColor } from '../utils/format.utils';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 10;

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Đang chờ',
  PROCESSING: 'Đang xử lý',
  REQUIRES_ACTION: 'Chờ thanh toán',
  COMPLETED: 'Đã thanh toán',
  FAILED: 'Thất bại',
  REFUNDED: 'Đã hoàn tiền',
};

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
        setRows(response.data?.payments || []);
        setTotal(response.data?.total || 0);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || t('errors.loadPayments'));
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, [page, t]);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.total += 1;
        if (row.status === 'COMPLETED') {
          acc.completed += 1;
        }
        if (row.status === 'REFUNDED') {
          acc.refunded += 1;
        }
        if (row.method === 'MOMO') {
          acc.momo += 1;
        }
        if (row.method === 'VNPAY') {
          acc.vnpay += 1;
        }
        return acc;
      },
      { total: 0, completed: 0, refunded: 0, momo: 0, vnpay: 0 },
    );
  }, [rows]);

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
      field: 'provider',
      headerName: 'Cổng',
      width: 110,
      valueFormatter: (params) => params.value || 'N/A',
    },
    {
      field: 'status',
      headerName: t('columns.status'),
      width: 150,
      renderCell: (params) => (
        <Chip label={PAYMENT_STATUS_LABELS[params.value] || params.value} size="small" color={getPaymentStatusColor(params.value)} />
      ),
    },
    {
      field: 'transactionId',
      headerName: t('columns.transaction'),
      width: 180,
      valueFormatter: (params) => params.value || t('labels.na'),
    },
    {
      field: 'refundedAt',
      headerName: 'Ghi nhận hoàn',
      width: 170,
      valueFormatter: (params) => (params.value ? formatDate(params.value) : t('labels.na')),
    },
    {
      field: 'refundReference',
      headerName: 'Mã hoàn tiền',
      width: 210,
      sortable: false,
      renderCell: (params) => params.row.refund?.refundOrderId || params.row.refund?.requestId || t('labels.na'),
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

      <Box
        sx={{
          mt: 2,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(5, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        {[
          { label: 'Bản ghi đang xem', value: summary.total, color: '#1d4ed8' },
          { label: 'Đã thanh toán', value: summary.completed, color: '#15803d' },
          { label: 'Đã hoàn tiền', value: summary.refunded, color: '#0f766e' },
          { label: 'MoMo', value: summary.momo, color: '#be185d' },
          { label: 'VNPay', value: summary.vnpay, color: '#7c3aed' },
        ].map((item) => (
          <Box
            key={item.label}
            sx={{
              p: 1.75,
              borderRadius: 3,
              border: '1px solid rgba(148,163,184,0.18)',
              background: '#fff',
            }}
          >
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              {item.label}
            </Typography>
            <Typography variant="h6" fontWeight={800} sx={{ color: item.color }}>
              {item.value}
            </Typography>
          </Box>
        ))}
      </Box>

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
