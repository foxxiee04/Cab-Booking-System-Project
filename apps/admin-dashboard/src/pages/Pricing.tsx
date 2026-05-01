import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Slider,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  IconButton,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { TrendingUp, Save, DirectionsBike, DirectionsCar, AirportShuttle, Add, Edit, Delete, EmojiEvents } from '@mui/icons-material';
import { pricingApi } from '../api/pricing.api';
import { formatCurrency } from '../utils/format.utils';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

interface IncentiveRule {
  id: string;
  type: 'TRIP_COUNT' | 'DISTANCE_KM' | 'PEAK_HOUR';
  conditionValue: number;
  rewardAmount: number;
  isActive: boolean;
  description: string | null;
}

const RULE_TYPE_LABELS: Record<string, string> = {
  TRIP_COUNT:  'Số cuốc / ngày',
  DISTANCE_KM: 'Quãng đường / ngày (km)',
  PEAK_HOUR:   'Giờ cao điểm (mỗi cuốc)',
};

type RuleFormState = { type: 'TRIP_COUNT' | 'DISTANCE_KM' | 'PEAK_HOUR'; conditionValue: number; rewardAmount: number; description: string; isActive: boolean };
const EMPTY_RULE: RuleFormState = { type: 'TRIP_COUNT', conditionValue: 10, rewardAmount: 50000, description: '', isActive: true };

// Pricing rates — must match pricing-service/src/config/index.ts
const VEHICLE_RATES = [
  {
    type: 'MOTORBIKE',
    label: 'Xe máy',
    icon: <DirectionsBike fontSize="small" />,
    color: '#16a34a',
    base: 10_000,
    perKm: 6_200,
    perMin: 450,
    minFare: 15_000,
  },
  {
    type: 'SCOOTER',
    label: 'Xe tay ga',
    icon: <DirectionsBike fontSize="small" />,
    color: '#0284c7',
    base: 14_000,
    perKm: 8_400,
    perMin: 700,
    minFare: 15_000,
  },
  {
    type: 'CAR_4',
    label: 'Ô tô 4 chỗ',
    icon: <DirectionsCar fontSize="small" />,
    color: '#7c3aed',
    base: 24_000,
    perKm: 15_000,
    perMin: 1_900,
    minFare: 15_000,
  },
  {
    type: 'CAR_7',
    label: 'Ô tô 7 chỗ',
    icon: <AirportShuttle fontSize="small" />,
    color: '#b45309',
    base: 32_000,
    perKm: 18_500,
    perMin: 2_400,
    minFare: 15_000,
  },
];

// Example trip: 5 km, 15 minutes
const EXAMPLE_KM = 5;
const EXAMPLE_MIN = 15;

function calcFare(rate: typeof VEHICLE_RATES[0], surge: number) {
  const raw = rate.base + rate.perKm * EXAMPLE_KM + rate.perMin * EXAMPLE_MIN;
  return Math.max(rate.minFare, Math.round(raw * surge));
}

const getSurgeColor = (v: number): 'success' | 'warning' | 'error' =>
  v < 1.3 ? 'success' : v < 1.8 ? 'warning' : 'error';

const Pricing: React.FC = () => {
  const [multiplier, setMultiplier] = useState(1.0);
  const [reason, setReason] = useState('');
  const [currentSurge, setCurrentSurge] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Incentive rules state
  const [rules, setRules] = useState<IncentiveRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [ruleDialog, setRuleDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<IncentiveRule | null>(null);
  const [ruleForm, setRuleForm] = useState(EMPTY_RULE);
  const [ruleError, setRuleError] = useState('');
  const [ruleSaving, setRuleSaving] = useState(false);

  const token = sessionStorage.getItem('accessToken') || '';
  const headers = { Authorization: `Bearer ${token}` };

  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/wallet/incentive-rules`, { headers });
      setRules(res.data?.data ?? res.data ?? []);
    } catch { setRules([]); }
    finally { setRulesLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { loadRules(); }, [loadRules]);

  const openCreateDialog = () => {
    setEditingRule(null);
    setRuleForm(EMPTY_RULE);
    setRuleError('');
    setRuleDialog(true);
  };

  const openEditDialog = (rule: IncentiveRule) => {
    setEditingRule(rule);
    setRuleForm({ type: rule.type, conditionValue: rule.conditionValue, rewardAmount: rule.rewardAmount, description: rule.description ?? '', isActive: rule.isActive });
    setRuleError('');
    setRuleDialog(true);
  };

  const handleSaveRule = async () => {
    if (ruleForm.conditionValue <= 0 || ruleForm.rewardAmount <= 0) {
      setRuleError('Vui lòng nhập giá trị hợp lệ > 0');
      return;
    }
    setRuleSaving(true);
    setRuleError('');
    try {
      if (editingRule) {
        await axios.patch(`${API_BASE}/admin/wallet/incentive-rules/${editingRule.id}`, ruleForm, { headers });
      } else {
        await axios.post(`${API_BASE}/admin/wallet/incentive-rules`, ruleForm, { headers });
      }
      setRuleDialog(false);
      await loadRules();
    } catch (e: any) {
      setRuleError(e.response?.data?.message || 'Lưu thất bại');
    } finally { setRuleSaving(false); }
  };

  const handleDeleteRule = async (id: string) => {
    if (!window.confirm('Xác nhận xoá rule này?')) return;
    try {
      await axios.delete(`${API_BASE}/admin/wallet/incentive-rules/${id}`, { headers });
      await loadRules();
    } catch { setError('Xoá rule thất bại'); }
  };

  useEffect(() => {
    pricingApi.getSurge()
      .then((res) => {
        setCurrentSurge(res.data.multiplier ?? 1.0);
        setMultiplier(res.data.multiplier ?? 1.0);
      })
      .catch(() => {});
  }, []);

  const handleUpdateSurge = async () => {
    setLoading(true);
    setSuccess('');
    setError('');
    try {
      await pricingApi.updateSurge({ multiplier, reason });
      setCurrentSurge(multiplier);
      setSuccess('Đã cập nhật hệ số surge thành công.');
      setReason('');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Cập nhật thất bại, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={800} gutterBottom>
        Giá cước & Hệ số surge
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Điều chỉnh hệ số surge toàn hệ thống. Giá cước cơ bản theo từng loại xe hiển thị bên dưới.
      </Typography>

      {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}
      {error   && <Alert severity="error"   onClose={() => setError('')}   sx={{ mb: 2 }}>{error}</Alert>}

      {/* Surge control */}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1fr 320px' }, mb: 3 }}>
        <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Stack direction="row" alignItems="center" spacing={1.5} mb={3}>
              <TrendingUp color="primary" />
              <Box>
                <Typography variant="h6" fontWeight={800}>Hệ số surge hiện tại</Typography>
                <Chip label={`${currentSurge.toFixed(1)}x`} color={getSurgeColor(currentSurge)} size="small" />
              </Box>
            </Stack>

            <Typography variant="body2" gutterBottom>
              Điều chỉnh: <strong>{multiplier.toFixed(1)}x</strong>
            </Typography>
            <Slider
              value={multiplier}
              onChange={(_, v) => setMultiplier(v as number)}
              min={1.0} max={3.0} step={0.1}
              marks={[1.0, 1.5, 2.0, 2.5, 3.0].map((v) => ({ value: v, label: `${v}x` }))}
              color={getSurgeColor(multiplier)}
              sx={{ mt: 2, mb: 3 }}
            />

            <TextField
              fullWidth
              label="Lý do điều chỉnh (tùy chọn)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Cao điểm giờ tan tầm, thời tiết xấu..."
              multiline rows={2}
              sx={{ mb: 2.5 }}
            />

            <Button
              variant="contained"
              fullWidth
              size="large"
              startIcon={loading ? <CircularProgress size={18} /> : <Save />}
              onClick={handleUpdateSurge}
              disabled={loading || multiplier === currentSurge}
              sx={{ borderRadius: 3 }}
            >
              Áp dụng surge {multiplier.toFixed(1)}x
            </Button>
          </CardContent>
        </Card>

        {/* Surge guide */}
        <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>Hướng dẫn</Typography>
            <Stack spacing={1.5} mt={1}>
              {[
                { range: '1.0–1.2x', color: 'success' as const, desc: 'Bình thường — cung đủ cầu' },
                { range: '1.3–1.7x', color: 'warning' as const, desc: 'Tăng nhẹ — giờ cao điểm' },
                { range: '1.8–3.0x', color: 'error'   as const, desc: 'Cao — thiếu tài xế hoặc thời tiết xấu' },
              ].map((g) => (
                <Box key={g.range} sx={{ p: 1.5, borderRadius: 2, bgcolor: g.color === 'success' ? '#f0fdf4' : g.color === 'warning' ? '#fffbeb' : '#fef2f2' }}>
                  <Chip label={g.range} color={g.color} size="small" sx={{ mb: 0.5 }} />
                  <Typography variant="body2" color="text.secondary">{g.desc}</Typography>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {/* Base fare table */}
      <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', mb: 3 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="subtitle1" fontWeight={800} gutterBottom>
            Bảng giá cơ bản theo loại xe
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Ví dụ tính cho chuyến {EXAMPLE_KM} km / {EXAMPLE_MIN} phút.&nbsp;
            Surge hiện tại: <strong>{currentSurge.toFixed(1)}x</strong>
            {multiplier !== currentSurge && <>&nbsp;→ dự kiến: <strong>{multiplier.toFixed(1)}x</strong></>}
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Loại xe</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Mở cửa</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Giá/km</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Giá/phút</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                    Ví dụ ({currentSurge.toFixed(1)}x)
                  </TableCell>
                  {multiplier !== currentSurge && (
                    <TableCell align="right" sx={{ fontWeight: 700, color: 'warning.main' }}>
                      Dự kiến ({multiplier.toFixed(1)}x)
                    </TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {VEHICLE_RATES.map((v) => {
                  const current = calcFare(v, currentSurge);
                  const preview = calcFare(v, multiplier);
                  return (
                    <TableRow key={v.type} hover>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Box sx={{ color: v.color }}>{v.icon}</Box>
                          <Box>
                            <Typography variant="body2" fontWeight={700}>{v.label}</Typography>
                            <Typography variant="caption" color="text.secondary">{v.type}</Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell align="right">{formatCurrency(v.base)}</TableCell>
                      <TableCell align="right">{formatCurrency(v.perKm)}</TableCell>
                      <TableCell align="right">{formatCurrency(v.perMin)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: v.color }}>
                        {formatCurrency(current)}
                      </TableCell>
                      {multiplier !== currentSurge && (
                        <TableCell align="right" sx={{ fontWeight: 700, color: 'warning.dark' }}>
                          {formatCurrency(preview)}
                          <Typography variant="caption" color={preview > current ? 'error.main' : 'success.main'} sx={{ display: 'block' }}>
                            {preview > current ? `+${formatCurrency(preview - current)}` : `-${formatCurrency(current - preview)}`}
                          </Typography>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Incentive Rules */}
      <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <EmojiEvents color="warning" />
                <Typography variant="subtitle1" fontWeight={800}>Quy tắc thưởng tài xế</Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Cấu hình các rule thưởng theo số cuốc, quãng đường hoặc giờ cao điểm.
              </Typography>
            </Box>
            <Button variant="contained" startIcon={<Add />} onClick={openCreateDialog} sx={{ borderRadius: 3 }}>
              Thêm rule
            </Button>
          </Stack>

          {rulesLoading ? (
            <Box display="flex" justifyContent="center" py={3}><CircularProgress /></Box>
          ) : rules.length === 0 ? (
            <Typography color="text.secondary" variant="body2" textAlign="center" py={3}>
              Chưa có quy tắc thưởng nào.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Loại thưởng</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Điều kiện</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Phần thưởng</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Mô tả</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Trạng thái</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Hành động</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id} hover>
                      <TableCell>
                        <Chip label={RULE_TYPE_LABELS[rule.type] ?? rule.type} size="small" color="warning" />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {rule.type === 'DISTANCE_KM' ? `≥ ${rule.conditionValue} km` : rule.type === 'TRIP_COUNT' ? `≥ ${rule.conditionValue} cuốc` : `+${rule.conditionValue} VND/cuốc`}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>
                        +{formatCurrency(rule.rewardAmount)}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>
                        {rule.description || '—'}
                      </TableCell>
                      <TableCell>
                        <Chip label={rule.isActive ? 'Đang bật' : 'Tắt'} size="small" color={rule.isActive ? 'success' : 'default'} />
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          <IconButton size="small" onClick={() => openEditDialog(rule)}><Edit fontSize="small" /></IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDeleteRule(rule.id)}><Delete fontSize="small" /></IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Incentive Rule Dialog */}
      <Dialog open={ruleDialog} onClose={() => setRuleDialog(false)} PaperProps={{ sx: { borderRadius: 4, minWidth: 380 } }}>
        <DialogTitle fontWeight={800}>{editingRule ? 'Sửa quy tắc thưởng' : 'Thêm quy tắc thưởng'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} pt={1}>
            <FormControl fullWidth size="small">
              <InputLabel>Loại thưởng</InputLabel>
              <Select label="Loại thưởng" value={ruleForm.type} onChange={(e) => setRuleForm((f) => ({ ...f, type: e.target.value as any }))}>
                {Object.entries(RULE_TYPE_LABELS).map(([k, v]) => (
                  <MenuItem key={k} value={k}>{v}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label={ruleForm.type === 'DISTANCE_KM' ? 'Điều kiện (km/ngày)' : ruleForm.type === 'TRIP_COUNT' ? 'Điều kiện (số cuốc/ngày)' : 'Thưởng mỗi cuốc giờ cao điểm (VND)'}
              type="number" fullWidth size="small"
              value={ruleForm.conditionValue}
              onChange={(e) => setRuleForm((f) => ({ ...f, conditionValue: Number(e.target.value) }))}
              helperText={ruleForm.type === 'PEAK_HOUR' ? 'Giá trị này không dùng cho PEAK_HOUR; dùng rewardAmount' : ''}
            />

            <TextField
              label="Phần thưởng (VND)" type="number" fullWidth size="small"
              value={ruleForm.rewardAmount}
              onChange={(e) => setRuleForm((f) => ({ ...f, rewardAmount: Number(e.target.value) }))}
            />

            <TextField
              label="Mô tả (tuỳ chọn)" fullWidth size="small"
              value={ruleForm.description}
              onChange={(e) => setRuleForm((f) => ({ ...f, description: e.target.value }))}
            />

            <FormControlLabel
              control={<Switch checked={ruleForm.isActive} onChange={(e) => setRuleForm((f) => ({ ...f, isActive: e.target.checked }))} />}
              label="Kích hoạt rule này"
            />

            {ruleError && <Alert severity="error" sx={{ borderRadius: 2 }}>{ruleError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button variant="outlined" onClick={() => setRuleDialog(false)} disabled={ruleSaving} sx={{ borderRadius: 3 }}>Huỷ</Button>
          <Button variant="contained" onClick={handleSaveRule} disabled={ruleSaving} sx={{ borderRadius: 3, fontWeight: 700 }}>
            {ruleSaving ? <CircularProgress size={18} /> : 'Lưu'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Pricing;
