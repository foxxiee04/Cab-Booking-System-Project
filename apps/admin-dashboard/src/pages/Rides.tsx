import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { DirectionsCar, PinDrop, SearchRounded } from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { adminApi } from '../api/admin.api';
import { Ride } from '../types';
import { formatCurrency, formatDate, formatNumber, getRideStatusColor } from '../utils/format.utils';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 10;

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ tài xế',
  FINDING_DRIVER: 'Đang tìm tài xế',
  ASSIGNED: 'Đã gán tài xế',
  ACCEPTED: 'Tài xế đang đến',
  PICKING_UP: 'Đang đón khách',
  IN_PROGRESS: 'Đang chạy',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};

const VEHICLE_LABELS: Record<string, string> = {
  MOTORBIKE: 'Xe máy',
  SCOOTER: 'Xe ga',
  CAR_4: 'Ô tô 4 chỗ',
  CAR_7: 'Ô tô 7 chỗ',
  ECONOMY: 'Xe máy',
  COMFORT: 'Xe ga',
  PREMIUM: 'Ô tô',
};

// System currently supports CASH / MOMO / VNPAY only. Older rides may carry
// CARD or WALLET in the database — keep them in the lookup so historical data
// renders, but mark as legacy.
const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Tiền mặt',
  MOMO: 'MoMo',
  VNPAY: 'VNPay',
  CARD: 'Thẻ (cũ)',
  WALLET: 'Ví (cũ)',
};

const VEHICLE_COLOR: Record<string, string> = {
  MOTORBIKE: '#5a7fb8',
  SCOOTER:   '#06b6d4',
  CAR_4:     '#5ca38a',
  CAR_7:     '#f59e0b',
};

const DetailRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ py: 0.75 }}>
    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 140 }}>{label}</Typography>
    <Typography variant="body2" fontWeight={600} textAlign="right" sx={{ flex: 1 }}>{value}</Typography>
  </Stack>
);

const RideDetailDialog: React.FC<{ ride: Ride | null; onClose: () => void }> = ({ ride, onClose }) => {
  if (!ride) return null;

  const customerName = ride.customer
    ? `${ride.customer.firstName} ${ride.customer.lastName}`.trim()
    : ride.customerId?.slice(0, 8).toUpperCase();

  const driverName = ride.driver
    ? `${ride.driver.firstName} ${ride.driver.lastName}`.trim()
    : ride.driverId
      ? ride.driverId.slice(0, 8).toUpperCase()
      : '—';

  const vehicleInfo = ride.driver
    ? `${ride.driver.vehicleMake || ''} ${ride.driver.vehicleModel || ''} · ${ride.driver.licensePlate || ''}`.trim()
    : null;

  return (
    <Dialog
      open={Boolean(ride)}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ pb: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <DirectionsCar color="primary" />
          <Box>
            <Typography variant="h6" fontWeight={800}>Chi tiết chuyến đi</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              {ride.id}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2}>
          {/* Status banner */}
          <Box sx={{ textAlign: 'center' }}>
            <Chip
              label={STATUS_LABELS[ride.status] || ride.status}
              color={getRideStatusColor(ride.status)}
              sx={{ fontWeight: 800, px: 2, py: 0.5 }}
            />
          </Box>

          {/* Route */}
          <Card variant="outlined" sx={{ borderRadius: 3, p: 2 }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <PinDrop sx={{ color: 'primary.main', mt: 0.25, flexShrink: 0 }} fontSize="small" />
                <Box>
                  <Typography variant="caption" color="text.secondary">Điểm đón</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {(ride.pickupLocation as any)?.address || (ride as any).pickupAddress || '—'}
                  </Typography>
                </Box>
              </Stack>
              <Divider />
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <PinDrop sx={{ color: 'error.main', mt: 0.25, flexShrink: 0 }} fontSize="small" />
                <Box>
                  <Typography variant="caption" color="text.secondary">Điểm đến</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {(ride.dropoffLocation as any)?.address || (ride as any).dropoffAddress || '—'}
                  </Typography>
                </Box>
              </Stack>
            </Stack>
          </Card>

          {/* Participants */}
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Card variant="outlined" sx={{ borderRadius: 3, p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">Khách hàng</Typography>
                <Typography variant="body2" fontWeight={700} sx={{ mt: 0.25 }}>{customerName}</Typography>
                {ride.customer?.email && (
                  <Typography variant="caption" color="text.secondary">{ride.customer.email}</Typography>
                )}
              </Card>
            </Grid>
            <Grid item xs={6}>
              <Card variant="outlined" sx={{ borderRadius: 3, p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">Tài xế</Typography>
                <Typography variant="body2" fontWeight={700} sx={{ mt: 0.25 }}>{driverName}</Typography>
                {vehicleInfo && (
                  <Typography variant="caption" color="text.secondary">{vehicleInfo}</Typography>
                )}
              </Card>
            </Grid>
          </Grid>

          {/* Financial details */}
          <Box sx={{ borderRadius: 3, border: '1px solid rgba(148,163,184,0.18)', p: 2 }}>
            <DetailRow label="Loại xe" value={VEHICLE_LABELS[ride.vehicleType] || ride.vehicleType} />
            <Divider sx={{ my: 0.5 }} />
            <DetailRow label="Phương thức thanh toán" value={PAYMENT_LABELS[ride.paymentMethod] || ride.paymentMethod} />
            <Divider sx={{ my: 0.5 }} />
            {ride.distance && <DetailRow label="Khoảng cách" value={`${ride.distance.toFixed(1)} km`} />}
            {ride.duration && <DetailRow label="Thời gian" value={`${Math.round(ride.duration / 60)} phút`} />}
            {ride.fare != null && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <DetailRow
                  label="Cước chuyến"
                  value={<Typography variant="body2" fontWeight={800} color="primary.main">{formatCurrency(ride.fare)}</Typography>}
                />
              </>
            )}
          </Box>

          {/* Timestamps */}
          <Box sx={{ borderRadius: 3, border: '1px solid rgba(148,163,184,0.18)', p: 2 }}>
            <DetailRow label="Tạo lúc" value={formatDate(ride.createdAt)} />
            <Divider sx={{ my: 0.5 }} />
            <DetailRow label="Cập nhật" value={formatDate(ride.updatedAt)} />
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

const Rides: React.FC = () => {
  const [rows, setRows] = useState<Ride[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [keyword, setKeyword] = useState('');
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  // Aggregate stats over the FULL dataset (not just the current page) so the
  // user sees the system's actual completed/cancelled totals.
  const [globalStats, setGlobalStats] = useState<{ completed: number; cancelled: number } | null>(null);
  const [vehicleBreakdown, setVehicleBreakdown] = useState<Array<{ vehicleType: string; count: number; revenue: number }>>([]);
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

  // Fetch full-dataset aggregates once (and refresh occasionally) — independent
  // of the paginated table so the KPI cards always reflect system totals.
  useEffect(() => {
    const fetchAggregates = async () => {
      try {
        const [statsRes, vehiclesRes] = await Promise.all([
          adminApi.getStats(),
          adminApi.getVehicleBreakdown(365),
        ]);
        const stats = statsRes.data?.stats;
        if (stats?.rides) {
          setGlobalStats({
            completed: stats.rides.completed || 0,
            cancelled: stats.rides.cancelled || 0,
          });
        }
        setVehicleBreakdown(vehiclesRes.data?.breakdown || []);
      } catch {
        /* non-critical for table rendering */
      }
    };
    fetchAggregates();
  }, []);

  const filteredRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter((ride) => {
      const customerName = `${ride.customer?.firstName || ''} ${ride.customer?.lastName || ''}`.trim();
      const driverName = `${ride.driver?.firstName || ''} ${ride.driver?.lastName || ''}`.trim();
      return [ride.id, customerName, driverName, ride.customerId, ride.driverId]
        .filter(Boolean).join(' ').toLowerCase().includes(kw);
    });
  }, [keyword, rows]);

  const vehicleChartData = useMemo(
    () =>
      vehicleBreakdown.map((b) => ({
        name: VEHICLE_LABELS[b.vehicleType] || b.vehicleType,
        type: b.vehicleType,
        rides: b.count,
      })),
    [vehicleBreakdown],
  );

  const columns: GridColDef<Ride>[] = [
    {
      field: 'id',
      headerName: 'Mã chuyến',
      width: 100,
      renderCell: (params) => (
        <Tooltip title={params.value} arrow placement="top">
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 11, color: '#5a7fb8' }}>
            #{String(params.value).slice(0, 7).toUpperCase()}
          </span>
        </Tooltip>
      ),
    },
    {
      field: 'status',
      headerName: 'Trạng thái',
      width: 140,
      renderCell: (params) => (
        <Chip
          label={STATUS_LABELS[params.value] || params.value}
          size="small"
          color={getRideStatusColor(params.value)}
        />
      ),
    },
    {
      field: 'customer',
      headerName: 'Khách hàng',
      flex: 1,
      minWidth: 140,
      renderCell: (params) => {
        const name = params.row.customer
          ? `${params.row.customer.firstName} ${params.row.customer.lastName}`.trim()
          : null;
        return name ? (
          <Typography variant="body2" fontWeight={600}>{name}</Typography>
        ) : (
          <Tooltip title={params.row.customerId} placement="top">
            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
              {params.row.customerId?.slice(0, 8).toUpperCase() || '—'}
            </Typography>
          </Tooltip>
        );
      },
    },
    {
      field: 'driver',
      headerName: 'Tài xế',
      flex: 1,
      minWidth: 140,
      renderCell: (params) => {
        const name = params.row.driver
          ? `${params.row.driver.firstName} ${params.row.driver.lastName}`.trim()
          : null;
        if (!params.row.driverId) return <Typography variant="caption" color="text.secondary">—</Typography>;
        return name ? (
          <Typography variant="body2">{name}</Typography>
        ) : (
          <Tooltip title={params.row.driverId} placement="top">
            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
              {params.row.driverId.slice(0, 8).toUpperCase()}
            </Typography>
          </Tooltip>
        );
      },
    },
    {
      field: 'vehicleType',
      headerName: 'Loại xe',
      width: 110,
      renderCell: (params) => (
        <Typography variant="body2">{VEHICLE_LABELS[params.value] || params.value}</Typography>
      ),
    },
    {
      field: 'fare',
      headerName: 'Cước (₫)',
      width: 130,
      renderCell: (params) => (
        <Typography variant="body2" fontWeight={700} color={params.value ? 'primary.main' : 'text.disabled'}>
          {params.value ? formatCurrency(params.value) : '—'}
        </Typography>
      ),
    },
    {
      field: 'paymentMethod',
      headerName: 'Thanh toán',
      width: 100,
      renderCell: (params) => (
        <Typography variant="caption">{PAYMENT_LABELS[params.value] || params.value}</Typography>
      ),
    },
    {
      field: 'createdAt',
      headerName: 'Thời gian',
      width: 150,
      renderCell: (params) => (
        <Typography variant="caption" color="text.secondary">{formatDate(params.value)}</Typography>
      ),
    },
  ];

  return (
    <Box sx={{ p: 3, minHeight: '100%', background: 'radial-gradient(circle at top left, rgba(37,99,235,0.08), transparent 32%), linear-gradient(180deg, #f8fafc 0%, #eef4fb 100%)' }}>
      <Typography variant="h4" fontWeight={900}>{t('tables.rides')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        Nhấn vào hàng để xem chi tiết chuyến đi — tên khách, tài xế, lộ trình và cước phí.
      </Typography>

      {/* KPI cards (full-dataset aggregates, not page-scoped) */}
      <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1.5 }}>
        {[
          { label: 'Hoàn tất (toàn hệ thống)', value: globalStats ? formatNumber(globalStats.completed) : '—', color: '#15803d' },
          { label: 'Đã hủy (toàn hệ thống)', value: globalStats ? formatNumber(globalStats.cancelled) : '—', color: '#dc2626' },
        ].map((item) => (
          <Card key={item.label} elevation={0} sx={{ borderRadius: 4, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.06)' }}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="caption" color="text.secondary">{item.label}</Typography>
              <Typography variant="h5" fontWeight={900} sx={{ mt: 0.5, color: item.color }}>{item.value}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Vehicle breakdown chart (last 365 days, full system) */}
      <Card elevation={0} sx={{ mt: 2, borderRadius: 4, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.06)' }}>
        <CardContent sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" fontWeight={800}>Số chuyến theo loại xe</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Chuyến hoàn tất 365 ngày qua
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

      {/* Filters */}
      <Card elevation={0} sx={{ mt: 2, borderRadius: 4, border: '1px solid rgba(148,163,184,0.16)', boxShadow: '0 18px 40px rgba(15,23,42,0.06)' }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 180px' } }}>
            <TextField
              size="small"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm theo mã, tên khách, tên tài xế"
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
              <MenuItem value="PENDING">Chờ tài xế</MenuItem>
              <MenuItem value="ASSIGNED">Đã gán</MenuItem>
              <MenuItem value="ACCEPTED">Đã nhận</MenuItem>
              <MenuItem value="IN_PROGRESS">Đang chạy</MenuItem>
              <MenuItem value="COMPLETED">Hoàn tất</MenuItem>
              <MenuItem value="CANCELLED">Đã hủy</MenuItem>
            </TextField>
          </Box>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mt: 2, borderRadius: 3 }}>{error}</Alert>}

      {/* DataGrid — click row to open detail */}
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
              onRowClick={(params) => setSelectedRide(params.row)}
              localeText={{
                noRowsLabel: keyword.trim() || statusFilter !== 'ALL'
                  ? 'Không có chuyến phù hợp với bộ lọc'
                  : 'Chưa có chuyến nào',
              }}
              sx={{
                border: 0,
                '& .MuiDataGrid-row': { cursor: 'pointer' },
                '& .MuiDataGrid-row:hover': { bgcolor: 'rgba(90,127,184,0.05)' },
              }}
            />
          </Box>
        </CardContent>
      </Card>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Nhấn vào bất kỳ hàng nào để xem chi tiết đầy đủ bao gồm lộ trình, tài xế và cước phí.
      </Typography>

      <RideDetailDialog ride={selectedRide} onClose={() => setSelectedRide(null)} />
    </Box>
  );
};

export default Rides;
