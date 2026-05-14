import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  AddRounded,
  EditRounded,
  PauseCircleOutlineRounded,
  PlayCircleOutlineRounded,
  RestartAltRounded,
  SaveRounded,
} from '@mui/icons-material';
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

const formGridSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
  gap: 1.5,
  '& .MuiTextField-root': { minWidth: 0 },
};

const sectionTitleSx = {
  mb: 1.25,
  color: '#334155',
  fontSize: 13,
  fontWeight: 800,
  textTransform: 'uppercase',
};

const formatDiscount = (voucher: Voucher) => {
  if (voucher.discountType === 'PERCENT') {
    return `${voucher.discountValue}%${voucher.maxDiscount ? `, tối đa ${formatCurrency(voucher.maxDiscount)}` : ''}`;
  }

  return formatCurrency(voucher.discountValue);
};

const formatUsage = (voucher: Voucher) => (
  `${voucher.perUserLimit}/người${voucher.usageLimit ? `, ${voucher.usageLimit} tổng` : ', không giới hạn tổng'}`
);

const getVoucherStatus = (voucher: Voucher, now = new Date()) => {
  const start = new Date(voucher.startTime);
  const end = new Date(voucher.endTime);

  if (!voucher.isActive) {
    return { label: 'Tạm tắt', color: 'default' as const };
  }
  if (now < start) {
    return { label: 'Sắp diễn ra', color: 'info' as const };
  }
  if (now > end) {
    return { label: 'Hết hạn', color: 'warning' as const };
  }
  return { label: 'Đang hiệu lực', color: 'success' as const };
};

const DetailBlock: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <Box sx={{ minWidth: 0 }}>
    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.25 }}>
      {label}
    </Typography>
    <Typography variant="body2" fontWeight={700} sx={{ color: '#1e293b', overflowWrap: 'anywhere' }}>
      {value}
    </Typography>
  </Box>
);

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
    const now = new Date();
    return rows.reduce(
      (acc, voucher) => {
        const status = getVoucherStatus(voucher, now).label;
        acc.total += 1;
        if (status === 'Đang hiệu lực') {
          acc.running += 1;
        }
        if (voucher.audienceType === 'NEW_CUSTOMERS') {
          acc.newCustomers += 1;
        }
        if (voucher.audienceType === 'RETURNING_CUSTOMERS') {
          acc.returningCustomers += 1;
        }
        return acc;
      },
      { total: 0, running: 0, newCustomers: 0, returningCustomers: 0 },
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

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight={900}>Quản lý voucher</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        Tạo, chỉnh sửa và theo dõi trạng thái ưu đãi đang phát hành.
      </Typography>

      {(error || success) && (
        <Stack spacing={1.25} sx={{ mt: 2 }}>
          {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ borderRadius: 2 }}>{success}</Alert>}
        </Stack>
      )}

      <Box
        sx={{
          mt: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        {[
          { label: 'Tổng voucher', value: summary.total, color: '#1d4ed8' },
          { label: 'Đang hiệu lực', value: summary.running, color: '#15803d' },
          { label: 'Cho khách mới', value: summary.newCustomers, color: '#7c3aed' },
          { label: 'Cho khách quay lại', value: summary.returningCustomers, color: '#b45309' },
        ].map((item) => (
          <Box
            key={item.label}
            sx={{
              p: 1.75,
              borderRadius: 2,
              border: '1px solid rgba(148,163,184,0.22)',
              background: '#fff',
              boxShadow: '0 10px 24px rgba(15,23,42,0.04)',
            }}
          >
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              {item.label}
            </Typography>
            <Typography variant="h6" fontWeight={900} sx={{ color: item.color }}>
              {item.value}
            </Typography>
          </Box>
        ))}
      </Box>

      <Card elevation={0} sx={{ mt: 2, borderRadius: 2, border: '1px solid rgba(148,163,184,0.22)' }}>
        <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5} sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h6" fontWeight={900}>
                {isEditing ? 'Chỉnh sửa voucher' : 'Tạo voucher mới'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {isEditing ? `Đang chỉnh sửa mã ${form.code || 'voucher'}` : 'Nhập thông tin phát hành voucher'}
              </Typography>
            </Box>
            <Chip
              size="small"
              color={form.isActive ? 'success' : 'default'}
              label={form.isActive ? 'Sẽ lưu ở trạng thái hoạt động' : 'Sẽ lưu ở trạng thái tạm tắt'}
              sx={{ fontWeight: 700 }}
            />
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.08fr) minmax(320px, 0.92fr)' },
              gap: { xs: 2, md: 3 },
            }}
          >
            <Box>
              <Typography sx={sectionTitleSx}>Thông tin voucher</Typography>
              <Box sx={formGridSx}>
                <TextField
                  size="small"
                  label="Mã voucher"
                  value={form.code}
                  onChange={handleChange('code')}
                  placeholder="VD: WELCOME300"
                  fullWidth
                />
                <TextField
                  select
                  size="small"
                  label="Nhóm khách hàng"
                  value={form.audienceType}
                  onChange={handleChange('audienceType')}
                  fullWidth
                >
                  {Object.entries(AUDIENCE_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>{label}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  label="Mô tả"
                  value={form.description}
                  onChange={handleChange('description')}
                  fullWidth
                  multiline
                  minRows={3}
                  sx={{ gridColumn: '1 / -1' }}
                />
              </Box>
            </Box>

            <Box>
              <Typography sx={sectionTitleSx}>Ưu đãi và lượt dùng</Typography>
              <Box sx={formGridSx}>
                <TextField
                  select
                  size="small"
                  label="Loại giảm"
                  value={form.discountType}
                  onChange={handleChange('discountType')}
                  fullWidth
                >
                  {Object.entries(DISCOUNT_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>{label}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  label={form.discountType === 'PERCENT' ? 'Giá trị %' : 'Số tiền giảm'}
                  type="number"
                  value={form.discountValue}
                  onChange={handleChange('discountValue')}
                  fullWidth
                  inputProps={{ min: 0 }}
                />
                <TextField
                  size="small"
                  label="Giảm tối đa"
                  type="number"
                  value={form.maxDiscount}
                  onChange={handleChange('maxDiscount')}
                  fullWidth
                  disabled={form.discountType !== 'PERCENT'}
                  inputProps={{ min: 0 }}
                />
                <TextField
                  size="small"
                  label="Đơn tối thiểu"
                  type="number"
                  value={form.minFare}
                  onChange={handleChange('minFare')}
                  fullWidth
                  inputProps={{ min: 0 }}
                />
                <TextField
                  size="small"
                  label="Lượt dùng / người"
                  type="number"
                  value={form.perUserLimit}
                  onChange={handleChange('perUserLimit')}
                  fullWidth
                  inputProps={{ min: 1 }}
                />
                <TextField
                  size="small"
                  label="Tổng lượt dùng"
                  type="number"
                  value={form.usageLimit}
                  onChange={handleChange('usageLimit')}
                  fullWidth
                  inputProps={{ min: 0 }}
                />
              </Box>
            </Box>

            <Box sx={{ gridColumn: '1 / -1' }}>
              <Typography sx={sectionTitleSx}>Thời gian hiệu lực</Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                  gap: 1.5,
                  '& .MuiTextField-root': { minWidth: 0 },
                }}
              >
                <TextField
                  size="small"
                  label="Bắt đầu"
                  type="datetime-local"
                  value={form.startTime}
                  onChange={handleChange('startTime')}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  size="small"
                  label="Kết thúc"
                  type="datetime-local"
                  value={form.endTime}
                  onChange={handleChange('endTime')}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ xs: 'stretch', md: 'center' }}
            justifyContent="space-between"
            spacing={1.5}
          >
            <Button
              variant="text"
              color={form.isActive ? 'warning' : 'success'}
              startIcon={form.isActive ? <PauseCircleOutlineRounded /> : <PlayCircleOutlineRounded />}
              onClick={() => setForm((prev) => ({ ...prev, isActive: !prev.isActive }))}
              sx={{ alignSelf: { xs: 'flex-start', md: 'center' }, borderRadius: 2, fontWeight: 800, textTransform: 'none' }}
            >
              {form.isActive ? 'Chuyển sang tạm tắt' : 'Kích hoạt khi lưu'}
            </Button>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ minWidth: { md: isEditing ? 380 : 220 } }}>
              {isEditing && (
                <Button
                  variant="outlined"
                  startIcon={<RestartAltRounded />}
                  onClick={resetForm}
                  sx={{ borderRadius: 2, fontWeight: 800, py: 1, textTransform: 'none' }}
                >
                  Hủy chỉnh sửa
                </Button>
              )}
              <Button
                variant="contained"
                startIcon={isEditing ? <SaveRounded /> : <AddRounded />}
                onClick={handleSubmitVoucher}
                disabled={saving || !form.code.trim() || !form.discountValue || !form.startTime || !form.endTime}
                sx={{ borderRadius: 2, fontWeight: 900, py: 1, textTransform: 'none' }}
              >
                {saving ? (isEditing ? 'Đang cập nhật...' : 'Đang tạo...') : (isEditing ? 'Lưu thay đổi' : 'Tạo voucher')}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card elevation={0} sx={{ mt: 2, borderRadius: 2, border: '1px solid rgba(148,163,184,0.22)' }}>
        <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} sx={{ mb: 1.5 }}>
            <Box>
              <Typography variant="h6" fontWeight={900}>Danh sách voucher</Typography>
              <Typography variant="caption" color="text.secondary">
                {loading ? 'Đang tải dữ liệu...' : `${rows.length} voucher trong hệ thống`}
              </Typography>
            </Box>
          </Stack>

          {loading ? (
            <Box sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>
              <Typography variant="body2">Đang tải danh sách voucher...</Typography>
            </Box>
          ) : rows.length === 0 ? (
            <Box
              sx={{
                py: 5,
                px: 2,
                textAlign: 'center',
                borderRadius: 2,
                border: '1px dashed rgba(148,163,184,0.5)',
                color: 'text.secondary',
              }}
            >
              <Typography variant="body2">Chưa có voucher nào.</Typography>
            </Box>
          ) : (
            <Stack spacing={1.25} sx={{ maxHeight: 680, overflow: 'auto', pr: { md: 0.5 } }}>
              {rows.map((voucher) => {
                const status = getVoucherStatus(voucher);
                const isToggling = togglingId === voucher.id;

                return (
                  <Box
                    key={voucher.id}
                    sx={{
                      p: { xs: 1.5, md: 2 },
                      borderRadius: 2,
                      border: '1px solid rgba(148,163,184,0.24)',
                      backgroundColor: '#fff',
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 176px' },
                      gap: 1.5,
                      alignItems: 'center',
                      transition: 'border-color 160ms ease, box-shadow 160ms ease',
                      '&:hover': {
                        borderColor: 'rgba(37,99,235,0.35)',
                        boxShadow: '0 12px 28px rgba(15,23,42,0.07)',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                          xs: '1fr',
                          sm: 'repeat(2, minmax(0, 1fr))',
                          lg: 'minmax(200px, 1.2fr) repeat(3, minmax(140px, 1fr))',
                          xl: 'minmax(220px, 1.35fr) repeat(4, minmax(140px, 1fr))',
                        },
                        gap: { xs: 1.25, md: 1.5 },
                        alignItems: 'center',
                        minWidth: 0,
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center">
                          <Typography
                            variant="subtitle2"
                            fontWeight={900}
                            sx={{ color: '#0f172a', fontFamily: 'monospace', overflowWrap: 'anywhere' }}
                          >
                            {voucher.code}
                          </Typography>
                          <Chip size="small" color={status.color} label={status.label} sx={{ fontWeight: 700 }} />
                        </Stack>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: '-webkit-box',
                            mt: 0.5,
                            overflow: 'hidden',
                            WebkitBoxOrient: 'vertical',
                            WebkitLineClamp: 2,
                          }}
                        >
                          {voucher.description || 'Không có mô tả'}
                        </Typography>
                      </Box>

                      <DetailBlock label="Nhóm nhận" value={AUDIENCE_LABELS[voucher.audienceType]} />
                      <DetailBlock label="Ưu đãi" value={formatDiscount(voucher)} />
                      <DetailBlock label="Đơn tối thiểu" value={formatCurrency(voucher.minFare || 0)} />
                      <DetailBlock label="Thời hạn" value={`${formatDate(voucher.startTime)} - ${formatDate(voucher.endTime)}`} />
                      <DetailBlock label="Lượt dùng" value={formatUsage(voucher)} />
                    </Box>

                    <Stack
                      direction={{ xs: 'row', md: 'column' }}
                      spacing={1}
                      useFlexGap
                      flexWrap="wrap"
                      sx={{
                        justifyContent: { xs: 'flex-start', md: 'center' },
                        '& .MuiButton-root': {
                          minWidth: { xs: 132, md: '100%' },
                          whiteSpace: 'nowrap',
                          textTransform: 'none',
                          borderRadius: 2,
                          fontWeight: 800,
                        },
                      }}
                    >
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<EditRounded />}
                        onClick={() => handleEditVoucher(voucher)}
                      >
                        Sửa
                      </Button>
                      <Button
                        size="small"
                        variant={voucher.isActive ? 'outlined' : 'contained'}
                        color={voucher.isActive ? 'warning' : 'success'}
                        startIcon={voucher.isActive ? <PauseCircleOutlineRounded /> : <PlayCircleOutlineRounded />}
                        onClick={() => handleToggleVoucher(voucher)}
                        disabled={isToggling}
                      >
                        {isToggling ? 'Đang cập nhật' : voucher.isActive ? 'Tạm tắt' : 'Kích hoạt'}
                      </Button>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default VouchersPage;
