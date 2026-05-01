/**
 * MerchantWallet — Admin view of platform wallet financials.
 *
 * Sections:
 *  1. Merchant Balance snapshot card  (totalIn / totalOut / net)
 *  2. Merchant Ledger table           (paginated, filter by type / category)
 *  3. Reconciliation card             (ledger identity + driver wallet totals)
 *  4. Driver Wallets table            (paginated, filter by status)
 *  5. System Bank Accounts
 *  6. Bank Transactions
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  Alert,
  Divider,
} from '@mui/material';
import {
  AccountBalance,
  ArrowUpward,
  ArrowDownward,
  Refresh,
  CheckCircle,
  Warning,
  ContentCopy,
  AccountBalanceWallet,
  SwapHoriz,
} from '@mui/icons-material';
import axios from 'axios';
import { useAppSelector } from '../store/hooks';
import { copyToClipboard } from '../utils/clipboard.utils';

// ─── API helpers ─────────────────────────────────────────────────────────────

// API_BASE already includes /api (e.g. http://localhost:3000/api)
// So WALLET_ADMIN path starts AFTER the /api prefix
const WALLET_ADMIN = '/admin/wallet';

function useAuthHeaders() {
  const { accessToken } = useAppSelector((s) => s.auth);
  return accessToken;
}

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

async function get<T>(path: string, headers: Record<string, string>, params?: Record<string, unknown>): Promise<T> {
  const url = new URL(API_BASE + path);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    });
  }
  const res = await axios.get<T>(url.toString(), { headers });
  return res.data;
}

async function apiPost<T>(path: string, headers: Record<string, string>, body?: unknown): Promise<T> {
  const res = await axios.post<T>(API_BASE + path, body ?? {}, { headers });
  return res.data;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MerchantBalance {
  balance: number;
  totalIn: number;
  totalOut: number;
  updatedAt?: string;
  source: 'snapshot' | 'computed';
}

interface LedgerEntry {
  id: string;
  type: 'IN' | 'OUT';
  category: string;
  amount: number;
  referenceId?: string;
  description?: string;
  createdAt: string;
}

interface LedgerStats {
  totalIn: number;
  totalOut: number;
  netRevenue: number;
  byCategory: Record<string, { in: number; out: number }>;
}

interface ReconciliationData {
  expectedMerchantBalance: number;
  totalDriverBalances: number;
  pendingWithdrawals: number;
  ledgerStats: LedgerStats;
}

interface DriverWallet {
  id: string;
  driverId: string;
  balance: number;
  availableBalance: number;
  lockedBalance: number;
  debt: number;
  status: 'ACTIVE' | 'BLOCKED';
  initialActivationCompleted: boolean;
  updatedAt: string;
}

interface SystemBankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  type: 'SETTLEMENT_ACCOUNT' | 'PAYOUT_ACCOUNT';
  description?: string;
  isActive: boolean;
  createdAt: string;
}

interface BankTransaction {
  id: string;
  fromAccount: string;
  toAccount: string;
  amount: number;
  type: 'PAYMENT' | 'PAYOUT' | 'TOP_UP' | 'REFUND';
  status: 'SUCCESS' | 'FAILED';
  referenceId?: string;
  description?: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

// ─── Format helpers ───────────────────────────────────────────────────────────

const vnd = (n: number) =>
  n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

const dateStr = (s: string) =>
  new Date(s).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'medium' });

const CATEGORY_COLOR: Record<string, 'success' | 'info' | 'warning' | 'error' | 'default'> = {
  PAYMENT:    'success',
  COMMISSION: 'success',
  TOP_UP:     'info',
  PAYOUT:     'warning',
  WITHDRAW:   'warning',
  BONUS:      'default',
  VOUCHER:    'default',
  REFUND:     'error',
};

const CATEGORY_LABEL: Record<string, string> = {
  PAYMENT: 'Thanh toán',
  COMMISSION: 'Phí nền tảng',
  TOP_UP: 'Nạp tiền',
  PAYOUT: 'Chi trả tài xế',
  WITHDRAW: 'Rút tiền',
  BONUS: 'Thưởng',
  VOUCHER: 'Voucher / trợ giá',
  REFUND: 'Hoàn tiền',
};

const TYPE_LABEL: Record<string, string> = {
  IN: 'THU',
  OUT: 'CHI',
};

const WALLET_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Hoạt động',
  BLOCKED: 'Bị khóa',
};

const BANK_ACCOUNT_TYPE_LABEL: Record<string, string> = {
  SETTLEMENT_ACCOUNT: 'Nhận thanh toán (MoMo/VNPay) — Techcombank 8000511204',
  PAYOUT_ACCOUNT:     'Chi trả rút ví tài xế — Techcombank 8000511204',
};

// Map system account IDs to readable labels for bank transaction display
const SYSTEM_ACCOUNT_LABEL: Record<string, string> = {
  MAIN_ACCOUNT:   'Techcombank 8000511204',
  PAYOUT_ACCOUNT: 'Techcombank 8000511204',
  CUSTOMER_BANK:  'Ví/Ngân hàng khách hàng',
  DRIVER_BANK:    'Ngân hàng tài xế',
  DRIVER_MOMO:    'Ví MoMo',
  DRIVER_VNPAY:   'Ví VNPay',
};

const BANK_TXN_TYPE_LABEL: Record<string, string> = {
  PAYMENT: 'Nhận thanh toán',
  PAYOUT:  'Tài xế rút',
  TOP_UP:  'Tài xế nạp',
  REFUND:  'Hoàn tiền',
};

const BANK_TXN_TYPE_COLOR: Record<string, 'success' | 'warning' | 'info' | 'error'> = {
  PAYMENT: 'success',
  PAYOUT:  'warning',
  TOP_UP:  'info',
  REFUND:  'error',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
  subtitle,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}) {
  return (
    <Card sx={{ flex: 1, minWidth: 180 }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} mb={1}>
          <Box sx={{ color, display: 'flex' }}>{icon}</Box>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            {label}
          </Typography>
        </Stack>
        <Typography variant="h5" fontWeight={700} sx={{ color }}>
          {vnd(value)}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const MerchantWallet: React.FC = () => {
  const token = useAuthHeaders();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  // ── Snackbar feedback ──
  const [snackMsg, setSnackMsg] = useState('');

  // ── Merchant balance snapshot ──
  const [balance, setBalance] = useState<MerchantBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // ── Ledger table ──
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerLimit] = useState(20);
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('');
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState('');
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // ── Reconciliation ──
  const [recon, setRecon] = useState<ReconciliationData | null>(null);
  const [reconLoading, setReconLoading] = useState(false);

  // ── Driver wallets ──
  const [wallets, setWallets] = useState<DriverWallet[]>([]);
  const [walletsTotal, setWalletsTotal] = useState(0);
  const [walletsPage, setWalletsPage] = useState(1);
  const [walletsLimit] = useState(10);
  const [walletStatusFilter, setWalletStatusFilter] = useState('');
  const [walletsLoading, setWalletsLoading] = useState(false);

  // ── System bank accounts ──
  const [bankAccounts, setBankAccounts] = useState<SystemBankAccount[]>([]);
  const [bankAccountsLoading, setBankAccountsLoading] = useState(false);

  // ── Bank transactions ──
  const [bankTxns, setBankTxns] = useState<BankTransaction[]>([]);
  const [bankTxnsTotal, setBankTxnsTotal] = useState(0);
  const [bankTxnsPage, setBankTxnsPage] = useState(1);
  const [bankTxnsLimit] = useState(20);
  const [bankTxnTypeFilter, setBankTxnTypeFilter] = useState('');
  const [bankTxnsLoading, setBankTxnsLoading] = useState(false);

  // ── Fetch functions ──

  const fetchBalance = useCallback(async () => {
    setBalanceLoading(true);
    try {
      const res: any = await get(`${WALLET_ADMIN}/merchant-balance`, headers);
      setBalance(res.data);
    } catch (e) {
      console.error('fetchBalance', e);
    } finally {
      setBalanceLoading(false);
    }
  }, [headers]);

  const fetchLedger = useCallback(async () => {
    setLedgerLoading(true);
    try {
      const res: any = await get(`${WALLET_ADMIN}/merchant-ledger`, headers, {
        page: ledgerPage,
        limit: ledgerLimit,
        type: ledgerTypeFilter,
        category: ledgerCategoryFilter,
      });
      setEntries(res.entries ?? []);
      setLedgerTotal(res.total ?? 0);
    } catch (e) {
      console.error('fetchLedger', e);
    } finally {
      setLedgerLoading(false);
    }
  }, [headers, ledgerPage, ledgerLimit, ledgerTypeFilter, ledgerCategoryFilter]);

  const fetchRecon = useCallback(async () => {
    setReconLoading(true);
    try {
      const res: any = await get(`${WALLET_ADMIN}/reconciliation`, headers);
      setRecon(res.data);
    } catch (e) {
      console.error('fetchRecon', e);
    } finally {
      setReconLoading(false);
    }
  }, [headers]);

  const fetchWallets = useCallback(async () => {
    setWalletsLoading(true);
    try {
      const res: any = await get(`${WALLET_ADMIN}/drivers`, headers, {
        page: walletsPage,
        limit: walletsLimit,
        status: walletStatusFilter,
      });
      setWallets(res.wallets ?? []);
      setWalletsTotal(res.total ?? 0);
    } catch (e) {
      console.error('fetchWallets', e);
    } finally {
      setWalletsLoading(false);
    }
  }, [headers, walletsPage, walletsLimit, walletStatusFilter]);

  const fetchBankAccounts = useCallback(async () => {
    setBankAccountsLoading(true);
    try {
      const res: any = await get(`${WALLET_ADMIN}/bank-accounts`, headers);
      setBankAccounts(res.data ?? []);
    } catch (e) {
      console.error('fetchBankAccounts', e);
    } finally {
      setBankAccountsLoading(false);
    }
  }, [headers]);

  const fetchBankTxns = useCallback(async () => {
    setBankTxnsLoading(true);
    try {
      const res: any = await get(`${WALLET_ADMIN}/bank-transactions`, headers, {
        page: bankTxnsPage,
        limit: bankTxnsLimit,
        type: bankTxnTypeFilter,
      });
      setBankTxns(res.transactions ?? []);
      setBankTxnsTotal(res.total ?? 0);
    } catch (e) {
      console.error('fetchBankTxns', e);
    } finally {
      setBankTxnsLoading(false);
    }
  }, [headers, bankTxnsPage, bankTxnsLimit, bankTxnTypeFilter]);

  useEffect(() => { fetchBalance(); fetchRecon(); fetchBankAccounts(); }, [fetchBalance, fetchRecon, fetchBankAccounts]);
  useEffect(() => { fetchLedger(); }, [fetchLedger]);
  useEffect(() => { fetchWallets(); }, [fetchWallets]);
  useEffect(() => { fetchBankTxns(); }, [fetchBankTxns]);

  // ── Render ──

  return (
    <>
    <Box>
      {/* ── Header ── */}
      <Box sx={{ background: (theme: any) => `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`, borderRadius: 3, p: 3, mb: 3, color: '#fff' }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={0.5}>
          <Box sx={{ p: 1.25, borderRadius: 2.5, bgcolor: 'rgba(255,255,255,0.1)' }}>
            <AccountBalance sx={{ fontSize: 28, color: '#93c5fd' }} />
          </Box>
          <Box flex={1}>
            <Typography variant="h5" fontWeight={800}>Ví nền tảng</Typography>
            <Typography variant="body2" sx={{ opacity: 0.7 }}>Quản lý tài chính và đối soát sổ cái hệ thống</Typography>
          </Box>
          <Tooltip title="Làm mới tất cả">
            <IconButton onClick={() => { fetchBalance(); fetchLedger(); fetchRecon(); fetchWallets(); fetchBankAccounts(); fetchBankTxns(); }} sx={{ color: '#93c5fd', bgcolor: 'rgba(255,255,255,0.08)', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* ── Section 1: Balance Snapshot ── */}
      <Card sx={{ mb: 3 }} elevation={2}>
        <CardHeader
          title="Bảng cân đối nền tảng"
          subheader={
            balance?.source === 'snapshot'
              ? `Cập nhật lúc: ${balance.updatedAt ? dateStr(balance.updatedAt) : '—'}`
              : 'Đã tính từ tổng sổ cái (chưa có bản ghi snapshot)'
          }
          action={
            balanceLoading ? <CircularProgress size={20} sx={{ mt: 1, mr: 1 }} /> : null
          }
        />
        <CardContent>
          {balance ? (
            <>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <StatCard
                  label="Tổng thu (IN)"
                  value={balance.totalIn}
                  icon={<ArrowUpward />}
                  color="success.main"
                  subtitle="Thanh toán + Hoa hồng + Nạp tiền"
                />
                <StatCard
                  label="Tổng chi (OUT)"
                  value={balance.totalOut}
                  icon={<ArrowDownward />}
                  color="error.main"
                  subtitle="Chi trả tài xế + Rút tiền + Thưởng + Voucher + Hoàn tiền"
                />
                <StatCard
                  label="Số dư nền tảng (Net)"
                  value={balance.balance}
                  icon={<AccountBalance />}
                  color={balance.balance >= 0 ? 'primary.main' : 'error.main'}
                  subtitle="THU − CHI = phí nền tảng − chi phí voucher"
                />
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Lưu ý: hoa hồng (COMMISSION) là tiền thu của nền tảng từ chuyến CASH; phí nền tảng là phần thu online của hệ thống và không nên hiểu nhầm với nhau.
              </Typography>
            </>
          ) : (
            <CircularProgress size={24} />
          )}
        </CardContent>
      </Card>

      {/* ── Section 3: Reconciliation ── */}
      <Card sx={{ mb: 3 }} elevation={2}>
        <CardHeader
          title="Đối soát sổ cái"
          subheader="Kiểm tra tính nhất quán các bút toán nền tảng"
          action={
            reconLoading ? <CircularProgress size={20} sx={{ mt: 1, mr: 1 }} /> : null
          }
        />
        <CardContent>
          {recon ? (
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <Card variant="outlined" sx={{ flex: 1, minWidth: 200, p: 2 }}>
                  <Typography variant="caption" color="text.secondary">Số dư mong đợi</Typography>
                  <Typography variant="h6" fontWeight={700} color="primary.main">
                    {vnd(recon.expectedMerchantBalance)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Tổng thu − Tổng chi</Typography>
                </Card>
                <Card variant="outlined" sx={{ flex: 1, minWidth: 200, p: 2 }}>
                  <Typography variant="caption" color="text.secondary">Tổng số dư tài xế</Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {vnd(recon.totalDriverBalances)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Σ số dư ví tài xế</Typography>
                </Card>
                <Card variant="outlined" sx={{ flex: 1, minWidth: 200, p: 2 }}>
                  <Typography variant="caption" color="text.secondary">Thanh toán chờ</Typography>
                  <Typography variant="h6" fontWeight={700} color="warning.main">
                    {vnd(recon.pendingWithdrawals)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Đang chờ chi trả</Typography>
                </Card>
              </Stack>

              {/* Ledger identity check */}
              {(() => {
                const stats = recon.ledgerStats;
                const isBalanced = Math.abs((stats.totalIn - stats.totalOut) - stats.netRevenue) < 0.01;
                return (
                  <Alert
                    severity={isBalanced ? 'success' : 'error'}
                    icon={isBalanced ? <CheckCircle /> : <Warning />}
                  >
                    <strong>Đồng nhất sổ cái:</strong> Tổng thu ({vnd(stats.totalIn)}) −
                    Tổng chi ({vnd(stats.totalOut)}) = Doanh thu ròng ({vnd(stats.netRevenue)})
                    &nbsp;
                    {isBalanced ? '✓ CÂN BẰNG' : '✗ SAI LỆCH — cần kiểm tra ngay'}
                  </Alert>
                );
              })()}

              {/* Category breakdown */}
              <Divider />
              <Typography variant="subtitle2" fontWeight={600}>Phân tích danh mục</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ '& .MuiTableCell-head': { bgcolor: '#f1f5f9', fontWeight: 700, fontSize: 12 } }}>
                    <TableRow>
                      <TableCell>Danh mục</TableCell>
                      <TableCell align="right">THU</TableCell>
                      <TableCell align="right">CHI</TableCell>
                      <TableCell align="right">Ròng</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(recon.ledgerStats.byCategory).map(([cat, v]) => (
                      <TableRow key={cat}>
                        <TableCell>
                          <Chip
                            label={CATEGORY_LABEL[cat] ?? cat}
                            size="small"
                            color={CATEGORY_COLOR[cat] ?? 'default'}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'success.main' }}>
                          {v.in > 0 ? vnd(v.in) : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'error.main' }}>
                          {v.out > 0 ? vnd(v.out) : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {vnd(v.in - v.out)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          ) : (
            <CircularProgress size={24} />
          )}
        </CardContent>
      </Card>

      {/* ── Section 2: Merchant Ledger ── */}
      <Card sx={{ mb: 3 }} elevation={2}>
        <CardHeader
          title="Sổ cái giao dịch"
          subheader={`${ledgerTotal.toLocaleString()} bản ghi`}
          action={
            <Stack direction="row" spacing={1} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 90 }}>
                <InputLabel>Loại</InputLabel>
                <Select
                  label="Loại"
                  value={ledgerTypeFilter}
                  onChange={(e) => { setLedgerTypeFilter(e.target.value); setLedgerPage(1); }}
                >
                  <MenuItem value="">Tất cả</MenuItem>
                  <MenuItem value="IN">{TYPE_LABEL.IN}</MenuItem>
                  <MenuItem value="OUT">{TYPE_LABEL.OUT}</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Loại mục</InputLabel>
                <Select
                  label="Loại mục"
                  value={ledgerCategoryFilter}
                  onChange={(e) => { setLedgerCategoryFilter(e.target.value); setLedgerPage(1); }}
                >
                  <MenuItem value="">Tất cả</MenuItem>
                  {['PAYMENT','PAYOUT','COMMISSION','TOP_UP','WITHDRAW','BONUS','VOUCHER','REFUND'].map((c) => (
                    <MenuItem key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {ledgerLoading && <CircularProgress size={20} />}
            </Stack>
          }
        />
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ '& .MuiTableCell-head': { bgcolor: '#f1f5f9', fontWeight: 700, fontSize: 12 } }}>
                <TableRow>
                  <TableCell>Thời gian</TableCell>
                  <TableCell>Loại</TableCell>
                  <TableCell>Danh mục</TableCell>
                  <TableCell align="right">Số tiền</TableCell>
                  <TableCell>Mã tham chiếu</TableCell>
                  <TableCell>Mô tả</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.length === 0 && !ledgerLoading && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary" py={2}>
                        Chưa có bứt toán
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {entries.map((e) => (
                  <TableRow key={e.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                      {dateStr(e.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={TYPE_LABEL[e.type] ?? e.type}
                        size="small"
                        color={e.type === 'IN' ? 'success' : 'error'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={CATEGORY_LABEL[e.category] ?? e.category}
                        size="small"
                        color={CATEGORY_COLOR[e.category] ?? 'default'}
                      />
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 700,
                        color: e.type === 'IN' ? 'success.main' : 'error.main',
                      }}
                    >
                      {e.type === 'IN' ? '+' : '−'}{vnd(e.amount)}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12, fontFamily: 'monospace' }}>
                      {e.referenceId ? (
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <span>{e.referenceId.slice(0, 8)}…</span>
                          <Tooltip title="Sao chép">
                            <IconButton
                              size="small"
                              onClick={() => copyToClipboard(e.referenceId!, () => setSnackMsg('Đã sao chép mã tham chiếu'))}
                            >
                              <ContentCopy sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      ) : '—'}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{e.description ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box display="flex" justifyContent="center" py={2}>
            <Pagination
              count={Math.ceil(ledgerTotal / ledgerLimit)}
              page={ledgerPage}
              onChange={(_, p) => setLedgerPage(p)}
              color="primary"
              size="small"
            />
          </Box>
        </CardContent>
      </Card>

      {/* ── Section 4: Driver Wallets ── */}
      <Card sx={{ mb: 3 }} elevation={2}>
        <CardHeader
          title="Ví tài xế"
          subheader={`${walletsTotal.toLocaleString()} ví`}
          action={
            <Stack direction="row" spacing={1} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 110 }}>
                <InputLabel>Trạng thái</InputLabel>
                <Select
                  label="Trạng thái"
                  value={walletStatusFilter}
                  onChange={(e) => { setWalletStatusFilter(e.target.value); setWalletsPage(1); }}
                >
                  <MenuItem value="">Tất cả</MenuItem>
                  <MenuItem value="ACTIVE">Hoạt động</MenuItem>
                  <MenuItem value="BLOCKED">Bị khóa</MenuItem>
                </Select>
              </FormControl>
              {walletsLoading && <CircularProgress size={20} />}
            </Stack>
          }
        />
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ '& .MuiTableCell-head': { bgcolor: '#f1f5f9', fontWeight: 700, fontSize: 12 } }}>
                <TableRow>
                  <TableCell>Mã tài xế</TableCell>
                  <TableCell align="right">Số dư</TableCell>
                  <TableCell align="right">Ký quỹ</TableCell>
                  <TableCell align="right">Công nợ</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell>Kích hoạt</TableCell>
                  <TableCell>Cập nhật</TableCell>
                  <TableCell align="center">Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {wallets.length === 0 && !walletsLoading && (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body2" color="text.secondary" py={2}>Chưa có ví nào</Typography>
                    </TableCell>
                  </TableRow>
                )}
                {wallets.map((w) => (
                  <TableRow key={w.id} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 11 }}>
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <span title={w.driverId}>{w.driverId.slice(0, 12)}…</span>
                        <Tooltip title="Sao chép ID">
                          <IconButton size="small" onClick={() => copyToClipboard(w.driverId, () => setSnackMsg('Đã sao chép ID tài xế'))}>
                            <ContentCopy sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ fontWeight: 700, color: w.balance < 0 ? 'error.main' : 'text.primary' }}
                    >
                      {vnd(w.balance)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'text.secondary' }}>
                      {vnd(w.lockedBalance ?? 0)}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ color: w.debt > 0 ? 'error.main' : 'text.secondary' }}
                    >
                      {w.debt > 0 ? vnd(w.debt) : '—'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={WALLET_STATUS_LABEL[w.status] ?? w.status}
                        size="small"
                        color={w.status === 'ACTIVE' ? 'success' : 'error'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={w.initialActivationCompleted ? 'Đã KH' : 'Chưa KH'}
                        size="small"
                        color={w.initialActivationCompleted ? 'success' : 'warning'}
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{dateStr(w.updatedAt)}</TableCell>
                    <TableCell align="center">
                      {w.status === 'ACTIVE' && (
                        <Tooltip title="Ngừng hoạt động tài xế này">
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            onClick={async () => {
                              const lockedAmount = (w.lockedBalance ?? 0).toLocaleString('vi-VN');
                              const confirmed = window.confirm(
                                `Xác nhận ngừng hoạt động tài xế này?\n\n• Ký quỹ ${lockedAmount} VND sẽ được hoàn trả về số dư\n• Tài khoản sẽ bị đình chỉ và không thể nhận chuyến mới`
                              );
                              if (!confirmed) return;
                              try {
                                const token = sessionStorage.getItem('accessToken') ?? '';
                                const data = await apiPost<{ success: boolean; message: string }>(
                                  `/wallet/admin/drivers/${w.driverId}/deactivate`,
                                  { Authorization: `Bearer ${token}` }
                                );
                                alert(data.message);
                                fetchWallets();
                              } catch (err: any) {
                                const msg = err?.response?.data?.message ?? 'Không thể kết nối đến máy chủ';
                                alert(`Lỗi: ${msg}`);
                              }
                            }}
                          >
                            Ngừng HĐ
                          </Button>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box display="flex" justifyContent="center" py={2}>
            <Pagination
              count={Math.ceil(walletsTotal / walletsLimit)}
              page={walletsPage}
              onChange={(_, p) => setWalletsPage(p)}
              color="primary"
              size="small"
            />
          </Box>
        </CardContent>
      </Card>

      {/* ── Section 5: System Bank Accounts ── */}
      <Card sx={{ mb: 3 }} elevation={2}>
        <CardHeader
          title={
            <Stack direction="row" spacing={1} alignItems="center">
              <AccountBalanceWallet color="primary" />
              <span>Tài khoản ngân hàng liên kết</span>
            </Stack>
          }
          subheader="Tài khoản đại diện mô phỏng dòng tiền — không kết nối ngân hàng thật"
          action={bankAccountsLoading ? <CircularProgress size={20} sx={{ mt: 1, mr: 1 }} /> : null}
        />
        <CardContent>
          {bankAccountsLoading && (
            <Box sx={{ textAlign: 'center', py: 2 }}><CircularProgress size={24} /></Box>
          )}
          {!bankAccountsLoading && bankAccounts.length === 0 && (
            <Typography variant="body2" color="text.secondary" align="center" py={2}>Chưa có dữ liệu</Typography>
          )}
          {!bankAccountsLoading && bankAccounts.length > 0 && (() => {
            // Deduplicate by accountNumber — show one card per unique account
            const seen = new Set<string>();
            const unique = bankAccounts.filter((a) => {
              if (seen.has(a.accountNumber)) return false;
              seen.add(a.accountNumber);
              return true;
            });
            return (
              <Stack spacing={2}>
                {unique.map((a) => (
                  <Box
                    key={a.accountNumber}
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      border: '1.5px solid',
                      borderColor: 'primary.light',
                      bgcolor: '#f0f7ff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <AccountBalanceWallet sx={{ fontSize: 40, color: 'primary.main', flexShrink: 0 }} />
                    <Box>
                      <Typography variant="subtitle1" fontWeight={800} color="primary.dark">
                        {a.bankName}
                      </Typography>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem', letterSpacing: 1.5 }}>
                        {a.accountNumber}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {a.accountHolder}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            );
          })()}
        </CardContent>
      </Card>

      {/* ── Section 6: Bank Transactions ── */}
      <Card sx={{ mb: 3 }} elevation={2}>
        <CardHeader
          title={
            <Stack direction="row" spacing={1} alignItems="center">
              <SwapHoriz color="primary" />
              <span>Giao dịch ngân hàng</span>
            </Stack>
          }
          subheader={`${bankTxnsTotal.toLocaleString()} giao dịch`}
          action={
            <Stack direction="row" spacing={1} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Loại</InputLabel>
                <Select
                  label="Loại"
                  value={bankTxnTypeFilter}
                  onChange={(e) => { setBankTxnTypeFilter(e.target.value); setBankTxnsPage(1); }}
                >
                  <MenuItem value="">Tất cả</MenuItem>
                  {['PAYMENT', 'PAYOUT', 'TOP_UP', 'REFUND'].map((t) => (
                    <MenuItem key={t} value={t}>{BANK_TXN_TYPE_LABEL[t] ?? t}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {bankTxnsLoading && <CircularProgress size={20} />}
            </Stack>
          }
        />
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ '& .MuiTableCell-head': { bgcolor: '#f1f5f9', fontWeight: 700, fontSize: 12 } }}>
                <TableRow>
                  <TableCell>Thời gian</TableCell>
                  <TableCell>Loại</TableCell>
                  <TableCell>Từ</TableCell>
                  <TableCell>Đến</TableCell>
                  <TableCell align="right">Số tiền</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell>Mã tham chiếu</TableCell>
                  <TableCell>Mô tả</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bankTxns.length === 0 && !bankTxnsLoading && (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body2" color="text.secondary" py={2}>Chưa có giao dịch</Typography>
                    </TableCell>
                  </TableRow>
                )}
                {bankTxns.map((t) => (
                  <TableRow key={t.id} hover>
                    <TableCell sx={{ fontSize: 11, whiteSpace: 'nowrap' }}>{dateStr(t.createdAt)}</TableCell>
                    <TableCell>
                      <Chip
                        label={BANK_TXN_TYPE_LABEL[t.type] ?? t.type}
                        size="small"
                        color={BANK_TXN_TYPE_COLOR[t.type] ?? 'default'}
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{SYSTEM_ACCOUNT_LABEL[t.fromAccount] ?? t.fromAccount}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{SYSTEM_ACCOUNT_LABEL[t.toAccount] ?? t.toAccount}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{vnd(t.amount)}</TableCell>
                    <TableCell>
                      <Chip
                        label={t.status === 'SUCCESS' ? 'Thành công' : 'Thất bại'}
                        size="small"
                        color={t.status === 'SUCCESS' ? 'success' : 'error'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: 12, fontFamily: 'monospace' }}>
                      {t.referenceId ? (
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <span>{t.referenceId.slice(0, 8)}…</span>
                          <Tooltip title="Sao chép">
                            <IconButton size="small" onClick={() => copyToClipboard(t.referenceId!, () => setSnackMsg('Đã sao chép mã tham chiếu'))}>
                              <ContentCopy sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      ) : '—'}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{t.description ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box display="flex" justifyContent="center" py={2}>
            <Pagination
              count={Math.ceil(bankTxnsTotal / bankTxnsLimit)}
              page={bankTxnsPage}
              onChange={(_, p) => setBankTxnsPage(p)}
              color="primary"
              size="small"
            />
          </Box>
        </CardContent>
      </Card>
    </Box>
    <Snackbar
      open={Boolean(snackMsg)}
      autoHideDuration={2000}
      onClose={() => setSnackMsg('')}
      message={snackMsg}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    />
  </>
  );
};

export default MerchantWallet;