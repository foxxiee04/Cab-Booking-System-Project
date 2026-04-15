import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  CheckCircleRounded,
  ContentCopyRounded,
  LocalOfferRounded,
  QrCodeScannerRounded,
} from '@mui/icons-material';
import voucherApi, { MyVoucher, MyVoucherStatus, PublicVoucher } from '../api/voucher.api';
import { formatCurrency } from '../utils/format.utils';

/* ─── helpers ─────────────────────────────────────────────────────────────── */

const STATUS_META: Record<MyVoucherStatus, { label: string; color: 'success' | 'error' | 'default' }> = {
  USABLE:  { label: 'Có thể dùng', color: 'success' },
  USED:    { label: 'Đã sử dụng',  color: 'default' },
  EXPIRED: { label: 'Hết hạn',     color: 'error' },
};

function discountLabel(type: 'PERCENT' | 'FIXED', value: number, maxDiscount: number | null) {
  if (type === 'PERCENT') {
    return `Giảm ${value}%${maxDiscount ? ` (tối đa ${formatCurrency(maxDiscount)})` : ''}`;
  }
  return `Giảm ${formatCurrency(value)}`;
}

function requirementLabel(minFare: number) {
  return minFare > 0 ? `Đơn tối thiểu ${formatCurrency(minFare)}` : 'Không yêu cầu giá tối thiểu';
}

/* ─── ticket card ─────────────────────────────────────────────────────────── */

interface TicketCardProps {
  code: string;
  description: string | null;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  maxDiscount: number | null;
  minFare: number;
  endTime: string | null;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  dimmed?: boolean;
}

function TicketCard({
  code, description, discountType, discountValue, maxDiscount, minFare, endTime,
  leftSlot, rightSlot, dimmed,
}: TicketCardProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        borderRadius: 3,
        overflow: 'hidden',
        opacity: dimmed ? 0.55 : 1,
        boxShadow: dimmed ? 'none' : '0 2px 12px rgba(0,0,0,0.08)',
        border: '1px solid',
        borderColor: dimmed ? 'divider' : 'primary.100',
      }}
    >
      {/* Left accent strip */}
      <Box
        sx={{
          width: 72,
          flexShrink: 0,
          background: dimmed
            ? 'linear-gradient(160deg,#b0bec5,#90a4ae)'
            : 'linear-gradient(160deg,#1d4ed8,#3b82f6)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 1,
          gap: 0.75,
          position: 'relative',
        }}
      >
        <LocalOfferRounded sx={{ color: '#fff', fontSize: 26 }} />
        <Typography variant="caption" fontWeight={900} sx={{ color: '#fff', textAlign: 'center', fontSize: '0.62rem', lineHeight: 1.2 }}>
          {code}
        </Typography>
        {/* Punch holes */}
        {[0, 100].map((top) => (
          <Box key={top} sx={{ position: 'absolute', top: `calc(${top}% - 10px)`, right: -8, width: 16, height: 16, borderRadius: '50%', bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }} />
        ))}
      </Box>

      {/* Dashed divider */}
      <Box sx={{ width: '1px', borderLeft: '1.5px dashed', borderColor: 'divider', my: 1.5 }} />

      {/* Right body */}
      <Box sx={{ flex: 1, px: 2, py: 1.5 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
          <Box flex={1} minWidth={0}>
            <Typography variant="subtitle1" fontWeight={800} color={dimmed ? 'text.secondary' : 'primary.main'} noWrap>
              {discountLabel(discountType, discountValue, maxDiscount)}
            </Typography>
            {description && (
              <Typography variant="body2" color="text.secondary" noWrap>
                {description}
              </Typography>
            )}
            <Stack direction="row" flexWrap="wrap" spacing={1} mt={0.75} useFlexGap>
              <Chip
                label={requirementLabel(minFare)}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.68rem', height: 20 }}
              />
              {endTime && (
                <Chip
                  label={`HSD: ${new Date(endTime).toLocaleDateString('vi-VN')}`}
                  size="small"
                  variant="outlined"
                  color={dimmed ? 'error' : 'default'}
                  sx={{ fontSize: '0.68rem', height: 20 }}
                />
              )}
            </Stack>
          </Box>
          <Box flexShrink={0}>{rightSlot}</Box>
        </Stack>
        {leftSlot && <Box mt={0.5}>{leftSlot}</Box>}
      </Box>
    </Box>
  );
}

/* ─── section label ──────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="overline" fontWeight={700} color="text.secondary" sx={{ letterSpacing: 1.2 }}>
      {children}
    </Typography>
  );
}

/* ─── main page ──────────────────────────────────────────────────────────── */

export default function VouchersPage() {
  const [tab, setTab] = useState(0); // 0 = Ưu đãi, 1 = Của tôi
  const [publicVouchers, setPublicVouchers] = useState<PublicVoucher[]>([]);
  const [myVouchers, setMyVouchers] = useState<MyVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [publicLoading, setPublicLoading] = useState(true);

  const [collectCode, setCollectCode] = useState('');
  const [collectLoading, setCollectLoading] = useState(false);
  const [collectError, setCollectError] = useState('');
  const [collectSuccess, setCollectSuccess] = useState('');
  const [collectingId, setCollectingId] = useState<string | null>(null); // card-level collect

  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);

  const loadPublic = useCallback(async () => {
    setPublicLoading(true);
    try {
      const res = await voucherApi.getPublicVouchers();
      setPublicVouchers(res.data.data);
    } catch { /* ignore */ }
    finally { setPublicLoading(false); }
  }, []);

  const loadMy = useCallback(async () => {
    setLoading(true);
    try {
      const res = await voucherApi.getMyVouchers();
      setMyVouchers(res.data.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadPublic(); loadMy(); }, [loadPublic, loadMy]);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  const handleCollectCard = async (code: string, voucherId: string) => {
    setCollectingId(voucherId);
    setCollectError('');
    setCollectSuccess('');
    try {
      await voucherApi.collectVoucher(code);
      setCollectSuccess(`Đã lưu voucher "${code}" thành công!`);
      await Promise.all([loadPublic(), loadMy()]);
    } catch (err: any) {
      setCollectError(err.response?.data?.error?.message || 'Không thể lưu voucher.');
    } finally {
      setCollectingId(null);
    }
  };

  const handleCollectManual = async () => {
    const code = collectCode.trim().toUpperCase();
    if (!code) return;
    setCollectError('');
    setCollectSuccess('');
    setCollectLoading(true);
    try {
      await voucherApi.collectVoucher(code);
      setCollectSuccess(`Đã lưu voucher "${code}" thành công!`);
      setCollectCode('');
      setCodeDialogOpen(false);
      await Promise.all([loadPublic(), loadMy()]);
    } catch (err: any) {
      setCollectError(err.response?.data?.error?.message || 'Mã không hợp lệ hoặc đã được lưu.');
    } finally {
      setCollectLoading(false);
    }
  };

  const usable = myVouchers.filter((v) => v.status === 'USABLE');
  const others = myVouchers.filter((v) => v.status !== 'USABLE');

  /* ── render ── */
  return (
    <Box sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 1.5, pb: 1.5, background: '#f8fafc' }}>
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 5,
          background: '#ffffff',
          border: '1px solid rgba(148,163,184,0.16)',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 3,
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(59,130,246,0.2))',
              color: '#2563eb',
            }}
          >
            <LocalOfferRounded />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary">
              Ưu đãi đang có cho tài khoản của bạn
            </Typography>
            <Typography variant="h6" fontWeight={800}>
              Voucher và mã giảm giá
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            startIcon={<QrCodeScannerRounded />}
            onClick={() => { setCodeDialogOpen(true); setCollectError(''); setCollectSuccess(''); }}
            sx={{ borderRadius: 999, fontWeight: 700, px: 2 }}
          >
            Nhập mã
          </Button>
        </Stack>
      </Paper>

      <Paper
        elevation={8}
        sx={{
          borderRadius: 5,
          overflow: 'hidden',
          backgroundColor: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(18px)',
          border: '1px solid rgba(148,163,184,0.14)',
        }}
      >
        {collectSuccess && (
          <Alert severity="success" onClose={() => setCollectSuccess('')} sx={{ borderRadius: 2, m: 2, mb: 1 }}>
            {collectSuccess}
          </Alert>
        )}
        {collectError && (
          <Alert severity="error" onClose={() => setCollectError('')} sx={{ borderRadius: 2, m: 2, mb: 1 }}>
            {collectError}
          </Alert>
        )}

        {/* Tabs */}
        <Tabs
          value={tab}
          onChange={(_e, v) => setTab(v)}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
        >
          <Tab label="Ưu đãi dành cho bạn" />
          <Tab label={`Voucher của tôi${usable.length ? ` (${usable.length})` : ''}`} />
        </Tabs>

        {/* Content */}
        <Box sx={{ px: 2, py: 2 }}>
        {/* ── Tab 0: Public vouchers ── */}
        {tab === 0 && (
          <Stack spacing={1.5}>
            {publicLoading
              ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="rounded" height={96} sx={{ borderRadius: 3 }} />)
              : publicVouchers.length === 0
                ? (
                  <Box textAlign="center" py={6}>
                    <LocalOfferRounded sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">Chưa có ưu đãi nào đang diễn ra</Typography>
                  </Box>
                )
                : publicVouchers.map((pv) => (
                  <TicketCard
                    key={pv.voucherId}
                    code={pv.code}
                    description={pv.description}
                    discountType={pv.discountType}
                    discountValue={pv.discountValue}
                    maxDiscount={pv.maxDiscount}
                    minFare={pv.minFare}
                    endTime={pv.endTime}
                    dimmed={pv.collected}
                    rightSlot={
                      pv.collected ? (
                        <Chip label="Đã lưu" color="success" size="small" icon={<CheckCircleRounded />} sx={{ fontWeight: 700 }} />
                      ) : (
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => handleCollectCard(pv.code, pv.voucherId)}
                          disabled={collectingId === pv.voucherId}
                          sx={{ borderRadius: 2.5, fontWeight: 700, minWidth: 80 }}
                        >
                          {collectingId === pv.voucherId ? <CircularProgress size={16} color="inherit" /> : 'Thu thập'}
                        </Button>
                      )
                    }
                  />
                ))
            }
          </Stack>
        )}

        {/* ── Tab 1: My vouchers ── */}
        {tab === 1 && (
          <Stack spacing={1.5}>
            {loading
              ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="rounded" height={96} sx={{ borderRadius: 3 }} />)
              : myVouchers.length === 0
                ? (
                  <Box textAlign="center" py={6}>
                    <LocalOfferRounded sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary" mb={2}>Bạn chưa lưu voucher nào</Typography>
                    <Button variant="outlined" onClick={() => setTab(0)}>Khám phá ưu đãi</Button>
                  </Box>
                )
                : (
                  <>
                    {usable.length > 0 && (
                      <>
                        <SectionLabel>Có thể sử dụng ({usable.length})</SectionLabel>
                        {usable.map((uv) => (
                          <TicketCard
                            key={uv.voucherId}
                            code={uv.code}
                            description={uv.description}
                            discountType={uv.discountType}
                            discountValue={uv.discountValue}
                            maxDiscount={uv.maxDiscount}
                            minFare={uv.minFare}
                            endTime={uv.endTime}
                            rightSlot={
                              <Button
                                variant="text"
                                size="small"
                                onClick={() => handleCopy(uv.code)}
                                sx={{ minWidth: 0, p: 0.5 }}
                              >
                                {copiedCode === uv.code
                                  ? <CheckCircleRounded fontSize="small" color="success" />
                                  : <ContentCopyRounded fontSize="small" />}
                              </Button>
                            }
                            leftSlot={
                              <Chip
                                label={STATUS_META[uv.status].label}
                                color={STATUS_META[uv.status].color}
                                size="small"
                                sx={{ fontWeight: 700, height: 20, fontSize: '0.68rem' }}
                              />
                            }
                          />
                        ))}
                      </>
                    )}

                    {others.length > 0 && (
                      <>
                        {usable.length > 0 && <Divider sx={{ my: 0.5 }} />}
                        <SectionLabel>Đã dùng / Hết hạn</SectionLabel>
                        {others.map((uv) => (
                          <TicketCard
                            key={uv.voucherId}
                            code={uv.code}
                            description={uv.description}
                            discountType={uv.discountType}
                            discountValue={uv.discountValue}
                            maxDiscount={uv.maxDiscount}
                            minFare={uv.minFare}
                            endTime={uv.endTime}
                            dimmed
                            rightSlot={
                              <Chip
                                label={STATUS_META[uv.status].label}
                                color={STATUS_META[uv.status].color}
                                size="small"
                                sx={{ fontWeight: 700, height: 20, fontSize: '0.68rem' }}
                              />
                            }
                          />
                        ))}
                      </>
                    )}
                  </>
                )
            }
          </Stack>
        )}
        </Box>
      </Paper>

      {/* ── Manual code dialog ── */}
      <Dialog open={codeDialogOpen} onClose={() => setCodeDialogOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Nhập mã ưu đãi</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} pt={0.5}>
            <TextField
              autoFocus
              fullWidth
              placeholder="VD: GRAB20"
              value={collectCode}
              onChange={(e) => setCollectCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleCollectManual()}
              disabled={collectLoading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LocalOfferRounded color="action" fontSize="small" />
                  </InputAdornment>
                ),
                sx: { borderRadius: 3, letterSpacing: 1.5, fontWeight: 700 },
              }}
            />
            {collectError && <Alert severity="error" sx={{ borderRadius: 2 }}>{collectError}</Alert>}
            <Button
              variant="contained"
              fullWidth
              onClick={handleCollectManual}
              disabled={collectLoading || !collectCode.trim()}
              sx={{ borderRadius: 3, fontWeight: 800, py: 1.25 }}
            >
              {collectLoading ? <CircularProgress size={20} color="inherit" /> : 'Lưu voucher'}
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
