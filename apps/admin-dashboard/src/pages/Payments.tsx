import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Card, CardContent, Chip, InputAdornment, MenuItem, TextField, Typography } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { SearchRounded } from '@mui/icons-material';
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
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const { t } = useTranslation();

  useEffect(() => {
    const fetchPayments = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await adminApi.getPayments({
          status: statusFilter === 'ALL' ? undefined : statusFilter,
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
  }, [page, statusFilter, t]);

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    if (!normalizedKeyword) {
      return rows;
    }

    return rows.filter((payment) => (
      [
        payment.id,
        payment.rideId,
        payment.transactionId,
        payment.provider,
        payment.method,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedKeyword)
    ));
  }, [keyword, rows]);

  const summary = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.total += 1;
        acc.amount += row.amount || 0;
        if (row.status === 'COMPLETED') {
          acc.completed += 1;
        }
        if (row.status === 'PENDING' || row.status === 'PROCESSING' || row.status === 'REQUIRES_ACTION') {
          acc.pending += 1;
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
      { total: 0, completed: 0, pending: 0, refunded: 0, momo: 0, vnpay: 0, amount: 0 },
    );
  }, [filteredRows]);

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
    <Box sx={{ p: 3, minHeight: '100%', background: 'radial-gradient(circle at top left, rgba(217,119,6,0.1), transparent 32%), linear-gradient(180deg, #f8fafc 0%, #eef4fb 100%)' }}>
      <Typography variant="h4" fontWeight={900}>
        {t('tables.payments')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
        Nắm nhanh chất lượng thanh toán, các giao dịch chờ xử lý và các khoản hoàn tiền ngay trên một màn hình tổng hợp.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mt: 2, borderRadius: 3 }}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          mt: 2,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(6, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        {[
          { label: 'Tổng giá trị', value: formatCurrency(summary.amount), color: '#0f766e' },
          { label: 'Đang xử lý', value: summary.pending, color: '#d97706' },
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

      <Card elevation={0} sx={{ mt: 2, borderRadius: 4, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.06)' }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 220px' } }}>
            <TextField
              size="small"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Tìm theo mã giao dịch, mã chuyến, cổng thanh toán hoặc transaction ID"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRounded fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              select
              size="small"
              label="Trạng thái"
              value={statusFilter}
              onChange={(event) => {
                setPage(0);
                setStatusFilter(event.target.value);
              }}
            >
              <MenuItem value="ALL">Tất cả</MenuItem>
              <MenuItem value="PENDING">Đang chờ</MenuItem>
              <MenuItem value="PROCESSING">Đang xử lý</MenuItem>
              <MenuItem value="REQUIRES_ACTION">Chờ thanh toán</MenuItem>
              <MenuItem value="COMPLETED">Đã thanh toán</MenuItem>
              <MenuItem value="FAILED">Thất bại</MenuItem>
              <MenuItem value="REFUNDED">Đã hoàn tiền</MenuItem>
            </TextField>
          </Box>
        </CardContent>
      </Card>

      <Card elevation={0} sx={{ mt: 2, borderRadius: 4, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.06)' }}>
        <CardContent sx={{ p: 1.5 }}>
          <Box sx={{ mt: 0.5, height: 540 }}>
            <DataGrid
              rows={filteredRows}
              columns={columns}
              rowCount={statusFilter === 'ALL' && !keyword.trim() ? total : filteredRows.length}
              loading={loading}
              paginationMode="server"
              pageSizeOptions={[PAGE_SIZE]}
              paginationModel={{ page, pageSize: PAGE_SIZE }}
              onPaginationModelChange={(model) => setPage(model.page)}
              getRowId={(row) => row.id}
              disableRowSelectionOnClick
              sx={{ border: 0 }}
            />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Payments;
