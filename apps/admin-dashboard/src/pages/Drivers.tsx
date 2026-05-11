import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Tooltip,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { SearchRounded, Star, TrendingUp, AttachMoney } from '@mui/icons-material';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { adminApi } from '../api/admin.api';
import { Driver } from '../types';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatNumber } from '../utils/format.utils';

interface TopDriverRow {
  id: string;
  name: string;
  totalRides: number;
  rating: number;
  reviewCount?: number;
  totalEarnings?: number;
  vehicleType: string;
}

const TOP_DRIVER_PALETTE = ['#5a7fb8', '#5ca38a', '#f59e0b', '#06b6d4', '#8b5cf6', '#ef4444', '#84cc16', '#ec4899', '#f97316', '#2563eb'];

const PAGE_SIZE = 10;

const Drivers: React.FC = () => {
  const [rows, setRows] = useState<Driver[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'rides' | 'rating'>('rides');
  const [suspendTarget, setSuspendTarget] = useState<Driver | null>(null);
  const [suspendLoading, setSuspendLoading] = useState(false);
  const [snackbar, setSnackbar] = useState('');
  // Aggregate stats from /admin/stats so KPI cards reflect the full driver
  // population, not just the page being viewed.
  const [globalStats, setGlobalStats] = useState<{
    total: number; online: number; busy: number; offline: number;
  } | null>(null);
  const [topDrivers, setTopDrivers] = useState<TopDriverRow[]>([]);
  const [topMetric, setTopMetric] = useState<'rides' | 'rating' | 'earnings'>('rides');
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

  // One-shot fetch for full-system aggregates and top-10 charts.
  useEffect(() => {
    const fetchAggregates = async () => {
      try {
        const [statsRes, topRes] = await Promise.all([
          adminApi.getStats(),
          adminApi.getTopDrivers(10),
        ]);
        const stats = statsRes.data?.stats?.drivers;
        if (stats) {
          setGlobalStats({
            total: stats.total || 0,
            online: stats.online || 0,
            busy: stats.busy || 0,
            offline: stats.offline || 0,
          });
        }
        setTopDrivers(topRes.data?.drivers || []);
      } catch {
        /* non-critical */
      }
    };
    fetchAggregates();
  }, []);

  // Sort top-10 by the selected metric. Earnings come from the extended
  // top-drivers endpoint; if missing on a driver we treat as 0.
  const topDriversSorted = useMemo(() => {
    const cloned = [...topDrivers];
    if (topMetric === 'rating') {
      // Drivers with no reviews get pushed to the bottom even if rating=0.
      cloned.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.reviewCount || 0) - (a.reviewCount || 0));
    } else if (topMetric === 'earnings') {
      cloned.sort((a, b) => (b.totalEarnings || 0) - (a.totalEarnings || 0));
    } else {
      cloned.sort((a, b) => (b.totalRides || 0) - (a.totalRides || 0));
    }
    return cloned.slice(0, 10);
  }, [topDrivers, topMetric]);

  const topMetricMeta = {
    rides:    { dataKey: 'totalRides',    label: 'Số chuyến',  format: (v: number) => `${formatNumber(v)} chuyến` },
    rating:   { dataKey: 'rating',        label: 'Đánh giá ★', format: (v: number) => `${v.toFixed(2)} ★` },
    earnings: { dataKey: 'totalEarnings', label: 'Thu nhập',   format: (v: number) => formatCurrency(v) },
  } as const;

  const filteredRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    let result = rows;
    if (kw) {
      result = result.filter((driver) =>
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
          .includes(kw)
      );
    }
    if (sortBy === 'rides') {
      result = [...result].sort((a, b) => (b.totalRides || 0) - (a.totalRides || 0));
    } else {
      result = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    return result;
  }, [keyword, rows, sortBy]);

  const handleSuspendConfirm = async () => {
    if (!suspendTarget) return;
    setSuspendLoading(true);
    try {
      const willSuspend = suspendTarget.status !== 'SUSPENDED';
      await adminApi.suspendDriver(suspendTarget.id, willSuspend);
      setSnackbar(willSuspend ? 'Đã tạm khóa tài xế' : 'Đã kích hoạt lại tài xế');
      setSuspendTarget(null);
      void fetchDrivers();
    } catch {
      setSnackbar('Không thể cập nhật trạng thái tài xế');
    } finally {
      setSuspendLoading(false);
    }
  };

  const getApprovalMeta = (status: Driver['status']) => {
    if (status === 'APPROVED') return { label: t('labels.approved'), color: 'success' as const };
    if (status === 'REJECTED') return { label: t('labels.rejected'), color: 'error' as const };
    if (status === 'SUSPENDED') return { label: 'Tạm khóa', color: 'warning' as const };
    return { label: t('labels.pending'), color: 'default' as const };
  };

  const columns: GridColDef<Driver>[] = [
    {
      field: 'id',
      headerName: t('columns.driverId'),
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
      valueGetter: (params) =>
        params.row.user ? `${params.row.user.firstName} ${params.row.user.lastName}` : t('labels.na'),
    },
    {
      field: 'phoneNumber',
      headerName: 'Số điện thoại',
      width: 140,
      valueGetter: (params) => params.row.user?.phoneNumber || t('labels.na'),
    },
    {
      field: 'vehicleType',
      headerName: t('columns.vehicle'),
      width: 210,
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
      width: 130,
      renderCell: (params) => {
        const meta = getApprovalMeta(params.row.status);
        return <Chip label={meta.label} size="small" color={meta.color} />;
      },
    },
    {
      field: 'rating',
      headerName: t('columns.rating'),
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.row.reviewCount > 0 ? `${params.row.rating.toFixed(1)} / 5` : t('labels.noReviews')}
          size="small"
          color={params.row.reviewCount > 0 ? 'warning' : 'default'}
          variant={params.row.reviewCount > 0 ? 'filled' : 'outlined'}
        />
      ),
    },
    { field: 'totalRides', headerName: t('columns.rides'), width: 90 },
    {
      field: 'isOnline',
      headerName: t('columns.online'),
      width: 110,
      renderCell: (params) => (
        <Chip
          label={params.value ? t('labels.online') : t('labels.offline')}
          size="small"
          color={params.value ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Hành động',
      width: 150,
      sortable: false,
      renderCell: (params) => {
        const driver = params.row;
        if (driver.status === 'PENDING' || driver.status === 'REJECTED') return null;
        const isSuspended = driver.status === 'SUSPENDED';
        return (
          <Button
            size="small"
            variant="outlined"
            color={isSuspended ? 'success' : 'warning'}
            onClick={() => setSuspendTarget(driver)}
            sx={{ fontSize: 11, borderRadius: 2, textTransform: 'none' }}
          >
            {isSuspended ? 'Kích hoạt lại' : 'Tạm khóa'}
          </Button>
        );
      },
    },
  ];

  return (
    <Box sx={{ p: 3, minHeight: '100%', background: 'radial-gradient(circle at top left, rgba(34,197,94,0.1), transparent 30%), linear-gradient(180deg, #f8fafc 0%, #eef4fb 100%)' }}>
      <Typography variant="h4" fontWeight={900}>{t('tables.drivers')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
        Theo dõi đội ngũ tài xế theo trạng thái duyệt, mức độ online và chất lượng vận hành.
      </Typography>

      {error && <Alert severity="error" sx={{ mt: 2, borderRadius: 3 }}>{error}</Alert>}

      {/* KPI cards (full system, not page-scoped) */}
      <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' }, gap: 1.5 }}>
        {[
          { label: 'Tổng tài xế', value: globalStats ? formatNumber(globalStats.total) : '—', color: '#1e293b' },
          { label: 'Đang online', value: globalStats ? formatNumber(globalStats.online) : '—', color: '#0f766e' },
          { label: 'Đang chở khách', value: globalStats ? formatNumber(globalStats.busy) : '—', color: '#7c3aed' },
          { label: 'Offline', value: globalStats ? formatNumber(globalStats.offline) : '—', color: '#94a3b8' },
        ].map((item) => (
          <Card key={item.label} elevation={0} sx={{ borderRadius: 4, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.06)' }}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="caption" color="text.secondary">{item.label}</Typography>
              <Typography variant="h5" fontWeight={900} sx={{ mt: 0.5, color: item.color }}>{item.value}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Top 10 drivers chart with metric switcher */}
      <Card elevation={0} sx={{ mt: 2, borderRadius: 4, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.06)' }}>
        <CardContent sx={{ p: 2.5 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
            <Box>
              <Typography variant="subtitle1" fontWeight={800}>Top 10 tài xế</Typography>
              <Typography variant="caption" color="text.secondary">
                Xếp hạng theo chỉ số được chọn — dữ liệu cộng dồn toàn bộ vòng đời
              </Typography>
            </Box>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={topMetric}
              onChange={(_, v) => v && setTopMetric(v)}
            >
              <ToggleButton value="rides" sx={{ px: 1.5, fontSize: 11 }}>
                <TrendingUp sx={{ mr: 0.5, fontSize: 14 }} />Cuốc nhiều
              </ToggleButton>
              <ToggleButton value="rating" sx={{ px: 1.5, fontSize: 11 }}>
                <Star sx={{ mr: 0.5, fontSize: 14 }} />Rating
              </ToggleButton>
              <ToggleButton value="earnings" sx={{ px: 1.5, fontSize: 11 }}>
                <AttachMoney sx={{ mr: 0.5, fontSize: 14 }} />Thu nhập
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          {topDriversSorted.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>Chưa có dữ liệu</Typography>
          ) : (
            <Box sx={{ height: 360, mt: 2 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topDriversSorted}
                  layout="vertical"
                  margin={{ top: 0, right: 24, left: 16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={topMetric === 'rating'}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                    domain={topMetric === 'rating' ? [0, 5] : undefined as any}
                  />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: '#334155' }} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    formatter={(v: number) => [topMetricMeta[topMetric].format(v), topMetricMeta[topMetric].label]}
                  />
                  <Bar dataKey={topMetricMeta[topMetric].dataKey} name={topMetricMeta[topMetric].label} radius={[0, 4, 4, 0]}>
                    {topDriversSorted.map((_, index) => (
                      <Cell key={index} fill={TOP_DRIVER_PALETTE[index % TOP_DRIVER_PALETTE.length]} />
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
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 180px auto' } }}>
            <TextField
              fullWidth
              size="small"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm theo tên, email, biển số hoặc số điện thoại"
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
              onChange={(e) => { setPage(0); setStatusFilter(e.target.value); }}
            >
              <MenuItem value="ALL">Tất cả</MenuItem>
              <MenuItem value="APPROVED">Đã duyệt</MenuItem>
              <MenuItem value="PENDING">Chờ duyệt</MenuItem>
              <MenuItem value="REJECTED">Từ chối</MenuItem>
              <MenuItem value="SUSPENDED">Tạm khóa</MenuItem>
            </TextField>
            <ToggleButtonGroup value={sortBy} exclusive size="small" onChange={(_, v) => { if (v) setSortBy(v); }}>
              <ToggleButton value="rides" sx={{ px: 1.5, fontSize: 11 }}>
                <TrendingUp sx={{ mr: 0.5, fontSize: 14 }} />Cuốc nhiều
              </ToggleButton>
              <ToggleButton value="rating" sx={{ px: 1.5, fontSize: 11 }}>
                <Star sx={{ mr: 0.5, fontSize: 14 }} />Đánh giá
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
              rowCount={statusFilter === 'ALL' && !keyword.trim() ? total : filteredRows.length}
              loading={loading}
              paginationMode="server"
              pageSizeOptions={[PAGE_SIZE]}
              paginationModel={{ page, pageSize: PAGE_SIZE }}
              onPaginationModelChange={(model) => setPage(model.page)}
              getRowId={(row) => row.id}
              disableRowSelectionOnClick
              localeText={{
                noRowsLabel: keyword.trim() || statusFilter !== 'ALL'
                  ? 'Không có tài xế phù hợp với bộ lọc'
                  : 'Chưa có tài xế nào',
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

      {/* Confirm suspend/unsuspend dialog */}
      <Dialog
        open={Boolean(suspendTarget)}
        onClose={() => setSuspendTarget(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle fontWeight={800}>
          {suspendTarget?.status === 'SUSPENDED' ? 'Kích hoạt lại tài xế' : 'Tạm khóa tài xế'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {suspendTarget?.status === 'SUSPENDED'
              ? `Bạn có chắc muốn kích hoạt lại tài khoản tài xế "${suspendTarget?.user?.firstName} ${suspendTarget?.user?.lastName}"?`
              : `Bạn có chắc muốn tạm khóa tài khoản tài xế "${suspendTarget?.user?.firstName} ${suspendTarget?.user?.lastName}"? Tài xế sẽ không thể nhận cuốc xe cho đến khi được mở khóa.`}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setSuspendTarget(null)} variant="outlined" sx={{ borderRadius: 2 }}>Huỷ</Button>
          <Button
            onClick={handleSuspendConfirm}
            variant="contained"
            disabled={suspendLoading}
            color={suspendTarget?.status === 'SUSPENDED' ? 'success' : 'warning'}
            sx={{ borderRadius: 2 }}
          >
            {suspendLoading ? <CircularProgress size={20} color="inherit" /> : 'Xác nhận'}
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

export default Drivers;
