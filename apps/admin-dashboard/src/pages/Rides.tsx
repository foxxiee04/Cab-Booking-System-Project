import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Card, CardContent, Chip, InputAdornment, MenuItem, TextField, Tooltip, Typography } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { SearchRounded } from '@mui/icons-material';
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
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [keyword, setKeyword] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    const fetchRides = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await adminApi.getRides({
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        });
        setRows(response.data?.rides || []);
        setTotal(response.data?.total || 0);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || t('errors.loadRides'));
      } finally {
        setLoading(false);
      }
    };

    fetchRides();
  }, [page, statusFilter, t]);

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) {
      return rows;
    }

    return rows.filter((ride) => {
      const customerName = `${ride.customer?.firstName || ''} ${ride.customer?.lastName || ''}`.trim();
      const driverName = `${ride.driver?.firstName || ''} ${ride.driver?.lastName || ''}`.trim();

      return [ride.id, customerName, driverName, ride.customerId, ride.driverId]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedKeyword);
    });
  }, [keyword, rows]);

  const summary = useMemo(() => filteredRows.reduce((acc, ride) => {
    acc.total += 1;
    acc.fare += ride.fare || 0;
    if (ride.status === 'COMPLETED') acc.completed += 1;
    if (ride.status === 'CANCELLED') acc.cancelled += 1;
    if (['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'].includes(ride.status)) acc.active += 1;
    return acc;
  }, {
    total: 0,
    fare: 0,
    completed: 0,
    cancelled: 0,
    active: 0,
  }), [filteredRows]);

  const columns: GridColDef<Ride>[] = [
    { field: 'id', headerName: t('columns.rideId'), width: 120, renderCell: (params) => (
      <Tooltip title={params.value} arrow placement="top">
        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>{String(params.value).slice(0, 8).toUpperCase()}</span>
      </Tooltip>
    ) },
    {
      field: 'status',
      headerName: t('columns.status'),
      width: 130,
      renderCell: (params) => (
        <Chip
          label={t(`rideStatus.${params.value}`)}
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
    <Box sx={{ p: 3, minHeight: '100%', background: 'radial-gradient(circle at top left, rgba(37,99,235,0.08), transparent 32%), linear-gradient(180deg, #f8fafc 0%, #eef4fb 100%)' }}>
      <Typography variant="h4" fontWeight={900}>
        {t('tables.rides')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
        Tập trung theo dõi tiến độ chuyến đi, chất lượng hoàn tất và tổng cước đang phát sinh trên từng nhóm trạng thái.
      </Typography>

      <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(5, minmax(0, 1fr))' }, gap: 1.5 }}>
        {[
          { label: 'Đang hoạt động', value: summary.active, color: '#0f766e' },
          { label: 'Hoàn tất', value: summary.completed, color: '#15803d' },
          { label: 'Đã hủy', value: summary.cancelled, color: '#dc2626' },
          { label: 'Tổng cước', value: formatCurrency(summary.fare), color: '#d97706' },
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
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 180px' } }}>
            <TextField
              size="small"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Tìm theo mã chuyến/khách/tài xế"
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
              <MenuItem value="ASSIGNED">Đã gán</MenuItem>
              <MenuItem value="ACCEPTED">Đã nhận</MenuItem>
              <MenuItem value="IN_PROGRESS">Đang chạy</MenuItem>
              <MenuItem value="COMPLETED">Hoàn tất</MenuItem>
              <MenuItem value="CANCELLED">Đã hủy</MenuItem>
            </TextField>
          </Box>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mt: 2, borderRadius: 3 }}>
          {error}
        </Alert>
      )}

      <Card elevation={0} sx={{ mt: 2, borderRadius: 4, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.06)' }}>
        <CardContent sx={{ p: 1.5 }}>
          <Box sx={{ height: 540 }}>
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

export default Rides;
