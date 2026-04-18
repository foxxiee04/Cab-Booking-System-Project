import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Card, CardContent, Chip, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { SearchRounded } from '@mui/icons-material';
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
  const [keyword, setKeyword] = useState('');
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
        setRows(response.data?.customers || []);
        setTotal(response.data?.total || 0);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || t('errors.loadCustomers'));
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [page, t]);

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    if (!normalizedKeyword) {
      return rows;
    }

    return rows.filter((customer) => (
      [
        customer.id,
        `${customer.firstName || ''} ${customer.lastName || ''}`,
        customer.email,
        customer.phoneNumber,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedKeyword)
    ));
  }, [keyword, rows]);

  const summary = useMemo(() => filteredRows.reduce((acc, customer) => {
    acc.visible += 1;
    acc.totalRides += customer.totalRides || 0;
    acc.ratingSum += customer.rating || 0;
    if (customer.phoneNumber) {
      acc.withPhone += 1;
    }
    return acc;
  }, {
    visible: 0,
    totalRides: 0,
    ratingSum: 0,
    withPhone: 0,
  }), [filteredRows]);

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
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value ? params.value.toFixed(1) : t('labels.na')}
          size="small"
          color={params.value ? 'warning' : 'default'}
          variant={params.value ? 'filled' : 'outlined'}
        />
      ),
    },
    {
      field: 'createdAt',
      headerName: t('columns.created'),
      width: 170,
      valueFormatter: (params) => formatDate(params.value),
    },
  ];

  return (
    <Box sx={{ p: 3, minHeight: '100%', background: 'radial-gradient(circle at top left, rgba(14,165,233,0.1), transparent 32%), linear-gradient(180deg, #f8fafc 0%, #eef4fb 100%)' }}>
      <Typography variant="h4" fontWeight={900}>
        {t('tables.customers')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
        Theo dõi nhanh khách đang hoạt động, thông tin liên hệ và chất lượng trải nghiệm theo từng trang dữ liệu.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mt: 2, borderRadius: 3 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' }, gap: 1.5 }}>
        {[
          { label: 'Có số điện thoại', value: summary.withPhone, color: '#0f766e' },
          { label: 'Tổng lượt đi', value: summary.totalRides, color: '#7c3aed' },
        ].map((item) => (
          <Card key={item.label} elevation={0} sx={{ borderRadius: 4, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.06)' }}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="caption" color="text.secondary">{item.label}</Typography>
              <Typography variant="h5" fontWeight={900} sx={{ mt: 0.5, color: item.color }}>{item.value}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Card elevation={0} sx={{ mt: 2, borderRadius: 4, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.06)' }}>
        <CardContent sx={{ p: 2 }}>
          <TextField
            fullWidth
            size="small"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm theo mã khách, tên, email hoặc số điện thoại"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </CardContent>
      </Card>

      <Card elevation={0} sx={{ mt: 2, borderRadius: 4, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.06)' }}>
        <CardContent sx={{ p: 1.5 }}>
          <Box sx={{ height: 560 }}>
            <DataGrid
              rows={filteredRows}
              columns={columns}
              rowCount={keyword.trim() ? filteredRows.length : total}
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
      {keyword.trim() && (
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 1.25 }}>
          <Typography variant="caption" color="text.secondary">
            Bộ lọc tìm kiếm đang áp dụng trên tập bản ghi hiện tại.
          </Typography>
          <Chip size="small" label={`${filteredRows.length} kết quả`} variant="outlined" />
        </Stack>
      )}
    </Box>
  );
};

export default Customers;
