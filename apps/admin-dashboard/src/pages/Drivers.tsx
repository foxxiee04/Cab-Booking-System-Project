import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Card, CardContent, Chip, InputAdornment, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { SearchRounded } from '@mui/icons-material';
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
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const { t } = useTranslation();

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await adminApi.getDrivers({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
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
  }, [page, statusFilter, t]);

  useEffect(() => {
    void fetchDrivers();
  }, [fetchDrivers]);

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    if (!normalizedKeyword) {
      return rows;
    }

    return rows.filter((driver) => (
      [
        driver.id,
        `${driver.user?.firstName || ''} ${driver.user?.lastName || ''}`,
        driver.user?.email,
        driver.user?.phoneNumber,
        driver.licensePlate,
        driver.vehicleMake,
        driver.vehicleModel,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedKeyword)
    ));
  }, [keyword, rows]);

  const summary = useMemo(() => filteredRows.reduce((acc, driver) => {
    acc.visible += 1;
    acc.totalRides += driver.totalRides || 0;
    acc.ratingSum += driver.rating || 0;
    if (driver.status === 'APPROVED') {
      acc.approved += 1;
    }
    if (driver.isOnline || driver.isAvailable) {
      acc.online += 1;
    }
    return acc;
  }, {
    visible: 0,
    approved: 0,
    online: 0,
    totalRides: 0,
    ratingSum: 0,
  }), [filteredRows]);

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
    { field: 'id', headerName: t('columns.driverId'), width: 120, renderCell: (params) => (
      <Tooltip title={params.value} arrow placement="top">
        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>{String(params.value).slice(0, 8).toUpperCase()}</span>
      </Tooltip>
    ) },
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
    {
      field: 'phoneNumber',
      headerName: 'Số điện thoại',
      width: 160,
      valueGetter: (params) => params.row.user?.phoneNumber || t('labels.na'),
    },
    {
      field: 'vehicleType',
      headerName: t('columns.vehicle'),
      width: 220,
      renderCell: (params) => (
        <Box sx={{ py: 0.8 }}>
          <Typography variant="body2" fontWeight={700}>
            {[params.row.vehicleMake, params.row.vehicleModel].filter(Boolean).join(' ') || params.row.vehicleType}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {params.row.licensePlate || params.row.vehicleType}
          </Typography>
        </Box>
      ),
    },
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
        <Chip
          label={params.row.reviewCount > 0 ? `${params.row.rating.toFixed(1)} / 5` : t('labels.noReviews')}
          size="small"
          color={params.row.reviewCount > 0 ? 'warning' : 'default'}
          variant={params.row.reviewCount > 0 ? 'filled' : 'outlined'}
        />
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
    <Box sx={{ p: 3, minHeight: '100%', background: 'radial-gradient(circle at top left, rgba(34,197,94,0.1), transparent 30%), linear-gradient(180deg, #f8fafc 0%, #eef4fb 100%)' }}>
      <Typography variant="h4" fontWeight={900}>
        {t('tables.drivers')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
        Theo dõi đội ngũ tài xế theo trạng thái duyệt, mức độ online và chất lượng vận hành trong cùng một bảng điều khiển.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mt: 2, borderRadius: 3 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(5, minmax(0, 1fr))' }, gap: 1.5 }}>
        {[
          { label: 'Đã duyệt', value: summary.approved, color: '#15803d' },
          { label: 'Đang online', value: summary.online, color: '#0f766e' },
          { label: 'Tổng cuốc xe', value: summary.totalRides, color: '#7c3aed' },
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
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 220px' } }}>
            <TextField
              fullWidth
              size="small"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Tìm theo mã tài xế, tên, email, biển số hoặc số điện thoại"
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
              label="Trạng thái hồ sơ"
              value={statusFilter}
              onChange={(event) => {
                setPage(0);
                setStatusFilter(event.target.value);
              }}
            >
              <MenuItem value="ALL">Tất cả</MenuItem>
              <MenuItem value="APPROVED">Đã duyệt</MenuItem>
              <MenuItem value="PENDING">Chờ duyệt</MenuItem>
              <MenuItem value="REJECTED">Từ chối</MenuItem>
              <MenuItem value="SUSPENDED">Tạm khóa</MenuItem>
            </TextField>
          </Box>
        </CardContent>
      </Card>

      <Card elevation={0} sx={{ mt: 2, borderRadius: 4, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.06)' }}>
        <CardContent sx={{ p: 1.5 }}>
          <Box sx={{ height: 560 }}>
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

export default Drivers;
