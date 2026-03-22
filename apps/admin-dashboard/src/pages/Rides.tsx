import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Chip, Alert, TextField, MenuItem, InputAdornment } from '@mui/material';
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

  const columns: GridColDef<Ride>[] = [
    { field: 'id', headerName: t('columns.rideId'), flex: 1, minWidth: 220 },
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
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold">
        {t('tables.rides')}
      </Typography>

      <Box sx={{ mt: 2, display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 180px' } }}>
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

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mt: 2, height: 520 }}>
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
        />
      </Box>
    </Box>
  );
};

export default Rides;
