import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { SearchRounded, TrendingUp } from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { adminApi } from '../api/admin.api';
import { Customer } from '../types';
import { formatDate, formatNumber } from '../utils/format.utils';
import { useTranslation } from 'react-i18next';

const VEHICLE_LABELS: Record<string, string> = {
  MOTORBIKE: 'Xe máy',
  SCOOTER: 'Xe ga',
  CAR_4: 'Ô tô 4 chỗ',
  CAR_7: 'Ô tô 7 chỗ',
};

const VEHICLE_COLOR: Record<string, string> = {
  MOTORBIKE: '#5a7fb8',
  SCOOTER:   '#06b6d4',
  CAR_4:     '#5ca38a',
  CAR_7:     '#f59e0b',
};

const PAGE_SIZE = 10;

const Customers: React.FC = () => {
  const [rows, setRows] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [sortBy, setSortBy] = useState<'rides' | 'created'>('rides');
  const [statusTarget, setStatusTarget] = useState<Customer | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [snackbar, setSnackbar] = useState('');
  // Aggregate stats from /admin/stats so cards reflect the full customer base.
  const [globalStats, setGlobalStats] = useState<{
    customers: number;
    completedRides: number;
  } | null>(null);
  const [vehicleBreakdown, setVehicleBreakdown] = useState<Array<{ vehicleType: string; count: number; revenue: number }>>([]);
  const { t } = useTranslation();

  const fetchCustomers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await adminApi.getCustomers({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      setRows(response.data?.customers || []);
      setTotal(response.data?.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('errors.loadCustomers'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    const fetchAggregates = async () => {
      try {
        const [statsRes, vehiclesRes] = await Promise.all([
          adminApi.getStats(),
          adminApi.getVehicleBreakdown(365),
        ]);
        const stats = statsRes.data?.stats;
        if (stats) {
          setGlobalStats({
            customers: stats.customers?.total || 0,
            completedRides: stats.rides?.completed || 0,
          });
        }
        setVehicleBreakdown(vehiclesRes.data?.breakdown || []);
      } catch {
        /* non-critical */
      }
    };
    fetchAggregates();
  }, []);

  const filteredRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    let result = rows;
    if (kw) {
      result = result.filter((c) =>
        [c.id, `${c.firstName || ''} ${c.lastName || ''}`, c.email, c.phoneNumber]
          .filter(Boolean).join(' ').toLowerCase().includes(kw)
      );
    }
    if (sortBy === 'rides') {
      result = [...result].sort((a, b) => (b.totalRides || 0) - (a.totalRides || 0));
    } else {
      result = [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return result;
  }, [keyword, rows, sortBy]);

  const vehicleChartData = useMemo(
    () =>
      vehicleBreakdown.map((b) => ({
        name: VEHICLE_LABELS[b.vehicleType] || b.vehicleType,
        type: b.vehicleType,
        rides: b.count,
      })),
    [vehicleBreakdown],
  );

  const handleStatusConfirm = async () => {
    if (!statusTarget) return;
    setStatusLoading(true);
    const currentStatus = (statusTarget as any).status || 'ACTIVE';
    const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await adminApi.updateUserStatus(statusTarget.id, nextStatus as 'ACTIVE' | 'INACTIVE');
      setSnackbar(nextStatus === 'ACTIVE' ? 'Đã kích hoạt tài khoản khách hàng' : 'Đã vô hiệu hóa tài khoản khách hàng');
      setStatusTarget(null);
      void fetchCustomers();
    } catch {
      setSnackbar('Không thể cập nhật trạng thái khách hàng');
    } finally {
      setStatusLoading(false);
    }
  };

  const columns: GridColDef<Customer>[] = [
    {
      field: 'id',
      headerName: t('columns.customerId'),
      width: 110,
      renderCell: (params) => (
        <Tooltip title={params.value} arrow placement="top">
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>
            {String(params.value).slice(0, 8).toUpperCase()}
          </span>
        </Tooltip>
      ),
    },
    {
      field: 'name',
      headerName: t('columns.name'),
      flex: 1,
      minWidth: 160,
      valueGetter: (params) => `${params.row.firstName} ${params.row.lastName}`,
    },
    { field: 'email', headerName: t('columns.email'), flex: 1, minWidth: 200 },
    {
      field: 'phoneNumber',
      headerName: t('columns.phone'),
      width: 140,
      valueFormatter: (params) => params.value || t('labels.na'),
    },
    { field: 'totalRides', headerName: t('columns.rides'), width: 90 },
    {
      field: 'status',
      headerName: 'Trạng thái',
      width: 120,
      renderCell: (params) => {
        const status = (params.row as any).status || 'ACTIVE';
        const isActive = status === 'ACTIVE';
        return (
          <Chip
            label={isActive ? 'Hoạt động' : 'Vô hiệu'}
            size="small"
            color={isActive ? 'success' : 'default'}
            variant={isActive ? 'filled' : 'outlined'}
          />
        );
      },
    },
    {
      field: 'createdAt',
      headerName: t('columns.created'),
      width: 160,
      valueFormatter: (params) => formatDate(params.value),
    },
    {
      field: 'actions',
      headerName: 'Hành động',
      width: 140,
      sortable: false,
      renderCell: (params) => {
        const status = (params.row as any).status || 'ACTIVE';
        const isActive = status === 'ACTIVE';
        return (
          <Button
            size="small"
            variant="outlined"
            color={isActive ? 'warning' : 'success'}
            onClick={() => setStatusTarget(params.row)}
            sx={{ fontSize: 11, borderRadius: 2, textTransform: 'none' }}
          >
            {isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
          </Button>
        );
      },
    },
  ];

  return (
    <Box sx={{ p: 3, minHeight: '100%', background: 'radial-gradient(circle at top left, rgba(14,165,233,0.1), transparent 32%), linear-gradient(180deg, #f8fafc 0%, #eef4fb 100%)' }}>
      <Typography variant="h4" fontWeight={900}>{t('tables.customers')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
        Quản lý khách hàng, theo dõi trạng thái tài khoản và lịch sử sử dụng dịch vụ.
      </Typography>

      {error && <Alert severity="error" sx={{ mt: 2, borderRadius: 3 }}>{error}</Alert>}

      {/* KPI cards (full system, not page-scoped) */}
      <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1.5 }}>
        {[
          { label: 'Tổng khách hàng', value: globalStats ? formatNumber(globalStats.customers) : '—', color: '#0f766e' },
          { label: 'Tổng chuyến hoàn tất', value: globalStats ? formatNumber(globalStats.completedRides) : '—', color: '#7c3aed' },
        ].map((item) => (
          <Card key={item.label} elevation={0} sx={{ borderRadius: 4, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.06)' }}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="caption" color="text.secondary">{item.label}</Typography>
              <Typography variant="h5" fontWeight={900} sx={{ mt: 0.5, color: item.color }}>{item.value}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Vehicle preference chart (last 365 days, system-wide) */}
      <Card elevation={0} sx={{ mt: 2, borderRadius: 4, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.06)' }}>
        <CardContent sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" fontWeight={800}>Khách hàng đặt loại xe nào nhiều nhất</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Số chuyến hoàn tất 365 ngày qua, theo loại xe
          </Typography>
          {vehicleChartData.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Chưa có dữ liệu</Typography>
          ) : (
            <Box sx={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vehicleChartData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#334155' }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <RechartsTooltip formatter={(v: number) => [formatNumber(v), 'Số chuyến']} />
                  <Bar dataKey="rides" name="Số chuyến" radius={[6, 6, 0, 0]}>
                    {vehicleChartData.map((d) => (
                      <Cell key={d.type} fill={VEHICLE_COLOR[d.type] || '#5a7fb8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card elevation={0} sx={{ mt: 2, borderRadius: 4, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.06)' }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr auto' } }}>
            <TextField
              fullWidth
              size="small"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm theo tên, email hoặc số điện thoại"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRounded fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <ToggleButtonGroup
              value={sortBy}
              exclusive
              size="small"
              onChange={(_, v) => { if (v) setSortBy(v); }}
            >
              <ToggleButton value="rides" sx={{ px: 2, fontSize: 12 }}>
                <TrendingUp sx={{ mr: 0.5, fontSize: 16 }} />Nhiều chuyến nhất
              </ToggleButton>
              <ToggleButton value="created" sx={{ px: 2, fontSize: 12 }}>
                Mới nhất
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
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
              localeText={{
                noRowsLabel: keyword.trim()
                  ? 'Không có khách hàng phù hợp với bộ lọc'
                  : 'Chưa có khách hàng nào',
              }}
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

      {/* Confirm status toggle dialog */}
      <Dialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle fontWeight={800}>
          {((statusTarget as any)?.status || 'ACTIVE') === 'ACTIVE' ? 'Vô hiệu hóa tài khoản' : 'Kích hoạt tài khoản'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {((statusTarget as any)?.status || 'ACTIVE') === 'ACTIVE'
              ? `Vô hiệu hóa tài khoản "${statusTarget?.firstName} ${statusTarget?.lastName}"? Khách hàng sẽ không thể đặt xe cho đến khi được kích hoạt lại.`
              : `Kích hoạt lại tài khoản "${statusTarget?.firstName} ${statusTarget?.lastName}"?`}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setStatusTarget(null)} variant="outlined" sx={{ borderRadius: 2 }}>Huỷ</Button>
          <Button
            onClick={handleStatusConfirm}
            variant="contained"
            disabled={statusLoading}
            color={((statusTarget as any)?.status || 'ACTIVE') === 'ACTIVE' ? 'warning' : 'success'}
            sx={{ borderRadius: 2 }}
          >
            {statusLoading ? <CircularProgress size={20} color="inherit" /> : 'Xác nhận'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={3000}
        onClose={() => setSnackbar('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={snackbar}
      />
    </Box>
  );
};

export default Customers;
