import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { adminApi } from '../api/admin.api';
import { Voucher, VoucherAudience, VoucherDiscountType } from '../types';
import { formatCurrency, formatDate } from '../utils/format.utils';

type VoucherFormState = {
  code: string;
  description: string;
  audienceType: VoucherAudience;
  discountType: VoucherDiscountType;
  discountValue: string;
  maxDiscount: string;
  minFare: string;
  startTime: string;
  endTime: string;
  usageLimit: string;
  perUserLimit: string;
  isActive: boolean;
};

const toLocalInput = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const createInitialForm = (): VoucherFormState => {
  const now = new Date();
  const start = new Date(now.getTime() + 5 * 60 * 1000);
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return {
    code: '',
    description: '',
    audienceType: 'ALL_CUSTOMERS',
    discountType: 'FIXED',
    discountValue: '',
    maxDiscount: '',
    minFare: '',
    startTime: toLocalInput(start),
    endTime: toLocalInput(end),
    usageLimit: '',
    perUserLimit: '1',
    isActive: true,
  };
};

const createFormFromVoucher = (voucher: Voucher): VoucherFormState => ({
  code: voucher.code,
  description: voucher.description || '',
  audienceType: voucher.audienceType,
  discountType: voucher.discountType,
  discountValue: String(voucher.discountValue),
  maxDiscount: voucher.maxDiscount ? String(voucher.maxDiscount) : '',
  minFare: voucher.minFare ? String(voucher.minFare) : '',
  startTime: toLocalInput(voucher.startTime),
  endTime: toLocalInput(voucher.endTime),
  usageLimit: voucher.usageLimit ? String(voucher.usageLimit) : '',
  perUserLimit: String(voucher.perUserLimit || 1),
  isActive: voucher.isActive,
});

const AUDIENCE_LABELS: Record<VoucherAudience, string> = {
  ALL_CUSTOMERS: 'Mọi khách hàng',
  NEW_CUSTOMERS: 'Khách hàng mới',
  RETURNING_CUSTOMERS: 'Khách hàng quay lại',
};

const DISCOUNT_LABELS: Record<VoucherDiscountType, string> = {
  FIXED: 'Giảm tiền cố định',
  PERCENT: 'Giảm theo phần trăm',
};

const formatDiscount = (voucher: Voucher) => {
  if (voucher.discountType === 'PERCENT') {
    return `${voucher.discountValue}%${voucher.maxDiscount ? ` (tối đa ${formatCurrency(voucher.maxDiscount)})` : ''}`;
  }

  return formatCurrency(voucher.discountValue);
};

const VouchersPage: React.FC = () => {
  const [rows, setRows] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState<VoucherFormState>(createInitialForm());
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);

  const loadVouchers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await adminApi.getVouchers();
      setRows(response.data.vouchers || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Không thể tải danh sách voucher');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVouchers();
  }, [loadVouchers]);

  const isEditing = Boolean(editingVoucherId);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, voucher) => {
        acc.total += 1;
        if (voucher.isActive) {
          acc.active += 1;
        }
        if (voucher.audienceType === 'NEW_CUSTOMERS') {
          acc.newCustomers += 1;
        }
        if (voucher.audienceType === 'RETURNING_CUSTOMERS') {
          acc.returningCustomers += 1;
        }
        return acc;
      },
      { total: 0, active: 0, newCustomers: 0, returningCustomers: 0 },
    );
  }, [rows]);

  const handleChange = (field: keyof VoucherFormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = field === 'isActive' ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm(createInitialForm());
    setEditingVoucherId(null);
  };

  const handleEditVoucher = (voucher: Voucher) => {
    setEditingVoucherId(voucher.id);
    setError('');
    setSuccess('');
    setForm(createFormFromVoucher(voucher));
  };

  const handleSubmitVoucher = async () => {
    const normalizedCode = form.code.trim().toUpperCase();
    const startTime = new Date(form.startTime);
    const endTime = new Date(form.endTime);

    if (!normalizedCode || !form.discountValue || !form.startTime || !form.endTime) {
      setError('Vui lòng nhập đầy đủ mã voucher, mức giảm và thời gian hiệu lực.');
      setSuccess('');
      return;
    }

    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || endTime <= startTime) {
      setError('Thời gian kết thúc phải sau thời gian bắt đầu.');
      setSuccess('');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        code: normalizedCode,
        description: form.description.trim() || undefined,
        audienceType: form.audienceType,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined,
        minFare: form.minFare ? Number(form.minFare) : undefined,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
        perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : undefined,
        isActive: form.isActive,
      };

      if (editingVoucherId) {
        await adminApi.updateVoucher(editingVoucherId, payload);
        setSuccess(`Đã cập nhật voucher ${normalizedCode} thành công.`);
      } else {
        await adminApi.createVoucher(payload);
        setSuccess(`Đã tạo voucher ${normalizedCode} thành công.`);
      }

      resetForm();
      await loadVouchers();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || (editingVoucherId ? 'Không thể cập nhật voucher' : 'Không thể tạo voucher'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVoucher = async (voucher: Voucher) => {
    setTogglingId(voucher.id);
    setError('');
    setSuccess('');
    try {
      await adminApi.toggleVoucher(voucher.id, !voucher.isActive);
      setSuccess(`${voucher.code} đã được ${voucher.isActive ? 'tắt' : 'kích hoạt'} thành công.`);
      await loadVouchers();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Không thể cập nhật voucher');
    } finally {
      setTogglingId(null);
    }
  };

  const columns: GridColDef<Voucher>[] = [
    { field: 'code', headerName: 'Mã voucher', minWidth: 140, flex: 0.9 },
    {
      field: 'audienceType',
      headerName: 'Nhóm nhận',
      minWidth: 170,
      flex: 1,
      valueFormatter: (params) => AUDIENCE_LABELS[params.value as VoucherAudience] || params.value,
    },
    {
      field: 'discountValue',
      headerName: 'Ưu đãi',
      minWidth: 220,
      flex: 1.2,
      sortable: false,
      renderCell: (params) => formatDiscount(params.row),
    },
    {
      field: 'minFare',
      headerName: 'Đơn tối thiểu',
      minWidth: 150,
      valueFormatter: (params) => formatCurrency(params.value || 0),
    },
    {
      field: 'timeWindow',
      headerName: 'Thời hạn',
      minWidth: 250,
      flex: 1.3,
      sortable: false,
      renderCell: (params) => `${formatDate(params.row.startTime)} - ${formatDate(params.row.endTime)}`,
    },
    {
      field: 'usageLimit',
      headerName: 'Lượt dùng',
      minWidth: 140,
      sortable: false,
      renderCell: (params) => `${params.row.perUserLimit}/người${params.row.usageLimit ? ` • ${params.row.usageLimit} tổng` : ' • Không giới hạn tổng'}`,
    },
    {
      field: 'isActive',
      headerName: 'Trạng thái',
      minWidth: 140,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Đang hoạt động' : 'Tạm tắt'}
          size="small"
          color={params.value ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Thao tác',
      minWidth: 150,
      sortable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.5 }}>
          <Button size="small" variant="text" onClick={() => handleEditVoucher(params.row)} sx={{ borderRadius: 999, fontWeight: 700 }}>
            Sửa
          </Button>
          <Button
            size="small"
            variant={params.row.isActive ? 'outlined' : 'contained'}
            onClick={() => handleToggleVoucher(params.row)}
            disabled={togglingId === params.row.id}
            sx={{ borderRadius: 999, fontWeight: 700 }}
          >
            {togglingId === params.row.id ? 'Đang cập nhật...' : params.row.isActive ? 'Tạm tắt' : 'Kích hoạt'}
          </Button>
        </Stack>
      ),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold">Quản lý voucher</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        Admin tạo voucher, chọn nhóm khách hàng nhận voucher và quản lý thời hạn hiệu lực.
      </Typography>

      {(error || success) && (
        <Stack spacing={1.25} sx={{ mt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}
        </Stack>
      )}

      <Box
        sx={{
          mt: 2,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        {[
          { label: 'Tổng voucher', value: summary.total, color: '#1d4ed8' },
          { label: 'Đang hoạt động', value: summary.active, color: '#15803d' },
          { label: 'Cho khách mới', value: summary.newCustomers, color: '#7c3aed' },
          { label: 'Cho khách quay lại', value: summary.returningCustomers, color: '#b45309' },
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

      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12} lg={4}>
          <Card sx={{ borderRadius: 4, height: '100%' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
                {isEditing ? 'Chỉnh sửa voucher' : 'Tạo voucher mới'}
              </Typography>
              <Stack spacing={1.5}>
                <TextField label="Mã voucher" value={form.code} onChange={handleChange('code')} placeholder="VD: WELCOME300" fullWidth />
                <TextField label="Mô tả" value={form.description} onChange={handleChange('description')} fullWidth multiline minRows={2} />
                <TextField select label="Nhóm khách hàng" value={form.audienceType} onChange={handleChange('audienceType')} fullWidth>
                  {Object.entries(AUDIENCE_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>{label}</MenuItem>
                  ))}
                </TextField>
                <TextField select label="Loại giảm" value={form.discountType} onChange={handleChange('discountType')} fullWidth>
                  {Object.entries(DISCOUNT_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>{label}</MenuItem>
                  ))}
                </TextField>
                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={6}>
                    <TextField label={form.discountType === 'PERCENT' ? 'Giá trị %' : 'Số tiền giảm'} value={form.discountValue} onChange={handleChange('discountValue')} fullWidth />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField label="Giảm tối đa" value={form.maxDiscount} onChange={handleChange('maxDiscount')} fullWidth disabled={form.discountType !== 'PERCENT'} />
                  </Grid>
                </Grid>
                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={6}>
                    <TextField label="Đơn tối thiểu" value={form.minFare} onChange={handleChange('minFare')} fullWidth />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField label="Lượt dùng / người" value={form.perUserLimit} onChange={handleChange('perUserLimit')} fullWidth />
                  </Grid>
                </Grid>
                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={6}>
                    <TextField label="Tổng lượt dùng" value={form.usageLimit} onChange={handleChange('usageLimit')} fullWidth />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField label="Bắt đầu" type="datetime-local" value={form.startTime} onChange={handleChange('startTime')} fullWidth InputLabelProps={{ shrink: true }} />
                  </Grid>
                </Grid>
                <TextField label="Kết thúc" type="datetime-local" value={form.endTime} onChange={handleChange('endTime')} fullWidth InputLabelProps={{ shrink: true }} />
                <Box>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1.5 }}>
                    <Chip
                      size="small"
                      color={form.isActive ? 'success' : 'default'}
                      label={form.isActive ? 'Lưu ở trạng thái đang hoạt động' : 'Lưu ở trạng thái tạm tắt'}
                    />
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => setForm((prev) => ({ ...prev, isActive: !prev.isActive }))}
                      sx={{ borderRadius: 999, fontWeight: 700 }}
                    >
                      {form.isActive ? 'Chuyển sang tạm tắt' : 'Kích hoạt khi lưu'}
                    </Button>
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                    <Button
                      variant="contained"
                      fullWidth
                      onClick={handleSubmitVoucher}
                      disabled={saving || !form.code.trim() || !form.discountValue || !form.startTime || !form.endTime}
                      sx={{ borderRadius: 3, fontWeight: 800, py: 1.25 }}
                    >
                      {saving ? (isEditing ? 'Đang cập nhật voucher...' : 'Đang tạo voucher...') : (isEditing ? 'Lưu thay đổi' : 'Tạo voucher')}
                    </Button>
                    {isEditing && (
                      <Button
                        variant="outlined"
                        fullWidth
                        onClick={resetForm}
                        sx={{ borderRadius: 3, fontWeight: 700, py: 1.25 }}
                      >
                        Hủy chỉnh sửa
                      </Button>
                    )}
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={8}>
          <Card sx={{ borderRadius: 4 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
                Danh sách voucher
              </Typography>
              <Box sx={{ height: 560 }}>
                <DataGrid
                  rows={rows}
                  columns={columns}
                  loading={loading}
                  getRowId={(row) => row.id}
                  pageSizeOptions={[10, 20, 50]}
                  initialState={{
                    pagination: {
                      paginationModel: { page: 0, pageSize: 10 },
                    },
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default VouchersPage;