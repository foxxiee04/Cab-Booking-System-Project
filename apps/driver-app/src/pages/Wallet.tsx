import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppSelector } from '../store/hooks';
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
  Divider,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Tab,
  Tabs,
  TextField,
  Typography,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  AccountBalanceRounded,
  AccountBalanceWalletRounded,
  CheckCircleRounded,
  EmojiEventsRounded,
  ErrorRounded,
  HourglassTopRounded,
  InfoOutlined,
  LocalFireDepartmentRounded,
  LockRounded,
  RefreshRounded,
  RouteRounded,
  ScheduleRounded,
  TwoWheelerRounded,
  WarningAmberRounded,
  LockOpenRounded,
  BlockRounded,
  ArrowForwardIosRounded,
  MonetizationOnRounded,
  ReceiptLongRounded,
  SavingsRounded,
  TrendingDownRounded,
} from '@mui/icons-material';
import { walletApi, WalletTransaction, DailyStats, IncentiveRule, DebtRecord } from '../api/wallet.api';
import { formatCurrency, formatDate } from '../utils/format.utils';

// ─── Constants ───────────────────────────────────────────────────────────────

const MIN_WITHDRAW = 50_000;

const DEFAULT_BUSINESS_ACCOUNTS = {
  topUpAccount: {
    bankName: 'Techcombank',
    accountNumber: '8000 511 204',
    accountHolder: 'Cab Booking System Co., Ltd.',
    description: 'Tai khoan doanh nghiep nhan tien nap vi, ky quy kich hoat va doi soat cong no.',
    note: 'NAPVI [SO_DIEN_THOAI_TAI_XE]',
  },
  payoutAccount: {
    bankName: 'Techcombank',
    accountNumber: '8000 511 204',
    accountHolder: 'Cab Booking System Co., Ltd.',
    description: 'Tai khoan doanh nghiep chuyen tien rut vi ve ngan hang ca nhan cua tai xe.',
  },
} as const;

const BANK_OPTIONS = [
  { name: 'Vietcombank', short: 'VCB', color: '#16a34a', minDigits: 8,  maxDigits: 14 },
  { name: 'BIDV',        short: 'BIDV', color: '#1d4ed8', minDigits: 10, maxDigits: 14 },
  { name: 'Techcombank', short: 'TCB', color: '#dc2626', minDigits: 10, maxDigits: 14 },
  { name: 'MB Bank',     short: 'MB',  color: '#0f172a', minDigits: 8,  maxDigits: 16 },
  { name: 'ACB',         short: 'ACB', color: '#2563eb', minDigits: 8,  maxDigits: 13 },
  { name: 'VPBank',      short: 'VPB', color: '#059669', minDigits: 10, maxDigits: 14 },
];

const BANK_LOGO_MAP: Record<string, string> = {
  'Techcombank': '/bank-icons/techcombank.svg',
  'TCB':         '/bank-icons/techcombank.svg',
};
const getBankLogoUrl = (bankName: string): string | null =>
  BANK_LOGO_MAP[bankName] ?? null;

type TxFilter = 'ALL' | 'EARN' | 'DEBT' | 'WITHDRAW';

const TX_TYPE_META: Record<
  WalletTransaction['type'],
  { label: string; color: 'success' | 'error' | 'warning' | 'info' | 'default'; sign: '+' | '-'; filterKey: TxFilter }
> = {
  EARN:       { label: 'Thu nhập online',  color: 'success', sign: '+', filterKey: 'EARN'     },
  COMMISSION: { label: 'Công nợ tiền mặt', color: 'error',   sign: '-', filterKey: 'DEBT'     },
  BONUS:      { label: 'Thưởng',           color: 'warning', sign: '+', filterKey: 'EARN'     },
  WITHDRAW:   { label: 'Doanh nghiệp chuyển khoản', color: 'default', sign: '-', filterKey: 'WITHDRAW' },
  REFUND:     { label: 'Hoàn tiền',        color: 'info',    sign: '-', filterKey: 'WITHDRAW' },
  TOP_UP:     { label: 'Nạp vào tài khoản doanh nghiệp', color: 'success', sign: '+', filterKey: 'EARN' },
};

const TX_TYPE_ICONS: Record<WalletTransaction['type'], React.ReactNode> = {
  EARN:       <MonetizationOnRounded fontSize="small" />,
  COMMISSION: <TrendingDownRounded fontSize="small" />,
  BONUS:      <EmojiEventsRounded fontSize="small" />,
  WITHDRAW:   <AccountBalanceRounded fontSize="small" />,
  REFUND:     <ReceiptLongRounded fontSize="small" />,
  TOP_UP:     <SavingsRounded fontSize="small" />,
};

const RULE_ICONS: Record<IncentiveRule['type'], React.ReactNode> = {
  TRIP_COUNT:  <TwoWheelerRounded fontSize="small" />,
  DISTANCE_KM: <RouteRounded fontSize="small" />,
  PEAK_HOUR:   <LocalFireDepartmentRounded fontSize="small" />,
};

const RULE_TYPE_LABELS: Record<IncentiveRule['type'], string> = {
  TRIP_COUNT:  'Số cuốc/ngày',
  DISTANCE_KM: 'Quãng đường/ngày',
  PEAK_HOUR:   'Giờ cao điểm',
};

const TX_PAGE = 15;

const digitsOnly = (v: string) => v.replace(/\D/g, '');
const formatDigitGroups = (v: string) => digitsOnly(v).replace(/(\d{4})(?=\d)/g, '$1 ');
const formatMoneyInput  = (v: string) => { const d = digitsOnly(v); return d ? Number(d).toLocaleString('vi-VN') : ''; };

// ─── Wallet state type ────────────────────────────────────────────────────────

interface WalletState {
  balance: number;
  operationalBalance: number;
  availableBalance: number;
  pendingBalance: number;
  lockedBalance: number;
  withdrawableBalance: number;
  debt: number;
  status: 'INACTIVE' | 'ACTIVE' | 'BLOCKED';
  initialActivationCompleted: boolean;
  activationRequired: boolean;
  warningThresholdReached: boolean;
  hasOverdueDebt: boolean;
  canAcceptRide: boolean;
  activationThreshold: number;
  warningThreshold: number;
  debtLimit: number;
  reason?: string;
  businessAccounts?: {
    topUpAccount?: {
      bankName: string;
      accountNumber: string;
      accountHolder: string;
      description?: string;
      note?: string;
    } | null;
    payoutAccount?: {
      bankName: string;
      accountNumber: string;
      accountHolder: string;
      description?: string;
    } | null;
  };
}

// ─── Gradient helpers per wallet status ──────────────────────────────────────

const CARD_GRADIENT: Record<'INACTIVE' | 'ACTIVE' | 'BLOCKED', string> = {
  INACTIVE: 'linear-gradient(135deg, #1e293b 0%, #334155 60%, #475569 100%)',
  ACTIVE:   'linear-gradient(135deg, #1e40af 0%, #2563eb 55%, #3b82f6 100%)',
  BLOCKED:  'linear-gradient(135deg, #7f1d1d 0%, #b91c1c 60%, #dc2626 100%)',
};

const STATUS_CHIP: Record<'INACTIVE' | 'ACTIVE' | 'BLOCKED', { label: string; bg: string }> = {
  INACTIVE: { label: 'Chưa kích hoạt', bg: 'rgba(251,191,36,0.25)' },
  ACTIVE:   { label: 'Hoạt động',      bg: 'rgba(34,197,94,0.25)'  },
  BLOCKED:  { label: 'Bị khoá',        bg: 'rgba(239,68,68,0.3)'   },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function WalletPage() {
  const { user } = useAppSelector((state) => state.auth);
  const [tab, setTab] = useState(0);

  const [walletState, setWalletState] = useState<WalletState | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState('');

  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txOffset, setTxOffset] = useState(0);
  const [txLoading, setTxLoading] = useState(false);
  const [txFilter, setTxFilter] = useState<TxFilter>('ALL');

  const [debtRecords, setDebtRecords] = useState<DebtRecord[]>([]);
  const [debtLoading, setDebtLoading] = useState(false);

  const [rules, setRules] = useState<IncentiveRule[]>([]);
  const [stats, setStats] = useState<DailyStats[]>([]);
  const [incentiveLoading, setIncentiveLoading] = useState(false);

  // Withdraw dialog
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawBankName, setWithdrawBankName] = useState('');
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState('');
  const [withdrawAccountHolder, setWithdrawAccountHolder] = useState('');
  const [withdrawStep, setWithdrawStep] = useState<0 | 1 | 2>(0);
  const [withdrawalId, setWithdrawalId] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');

  // Top-up dialog
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpProvider, setTopUpProvider] = useState<'MOMO' | 'VNPAY' | null>(null);
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpError, setTopUpError] = useState('');
  const [globalSuccess, setGlobalSuccess] = useState('');

  // ─── Loaders ─────────────────────────────────────────────────────────────

  const loadBalance = useCallback(async () => {
    setBalanceLoading(true);
    setBalanceError('');
    try {
      const res = await walletApi.getBalance();
      const p = res.data?.data ?? (res.data as any);
      setWalletState(p ? {
        balance:                    p.balance ?? 0,
        operationalBalance:         p.operationalBalance ?? p.availableBalance ?? 0,
        availableBalance:           p.availableBalance ?? 0,
        pendingBalance:             p.pendingBalance ?? 0,
        lockedBalance:              p.lockedBalance ?? 0,
        withdrawableBalance:        p.withdrawableBalance ?? 0,
        debt:                       p.debt ?? 0,
        status:                     p.status ?? 'INACTIVE',
        initialActivationCompleted: p.initialActivationCompleted ?? false,
        activationRequired:         p.activationRequired ?? false,
        warningThresholdReached:    p.warningThresholdReached ?? false,
        hasOverdueDebt:             p.hasOverdueDebt ?? false,
        canAcceptRide:              p.canAcceptRide ?? false,
        activationThreshold:        p.activationThreshold ?? 300_000,
        warningThreshold:           p.warningThreshold ?? -100_000,
        debtLimit:                  p.debtLimit ?? -200_000,
        reason:                     p.reason,
        businessAccounts:           p.businessAccounts ?? undefined,
      } : null);
    } catch (err: any) {
      setBalanceError(err.response?.data?.error?.message || 'Không thể tải số dư ví');
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  const loadDebtRecords = useCallback(async () => {
    setDebtLoading(true);
    try {
      const res = await walletApi.getDebtRecords();
      const records = res.data?.data ?? (res.data as any);
      setDebtRecords(Array.isArray(records) ? records : []);
    } finally {
      setDebtLoading(false);
    }
  }, []);

  const loadTransactions = useCallback(async (offset: number, append = false) => {
    setTxLoading(true);
    try {
      const res = await walletApi.getTransactions(TX_PAGE, offset);
      const payload = (res.data?.data ?? res.data) as any;
      const newTx = Array.isArray(payload?.transactions) ? payload.transactions : [];
      const total = typeof payload?.total === 'number' ? payload.total : newTx.length;
      setTransactions((prev) => (append ? [...prev, ...newTx] : newTx));
      setTxTotal(total);
      setTxOffset(offset);
    } finally {
      setTxLoading(false);
    }
  }, []);

  const loadIncentive = useCallback(async () => {
    setIncentiveLoading(true);
    try {
      const [rulesRes, statsRes] = await Promise.all([
        walletApi.getIncentiveRules(),
        walletApi.getDailyStats(7),
      ]);
      const rulesPayload = (rulesRes.data?.data ?? rulesRes.data) as any;
      const statsPayload = (statsRes.data?.data ?? statsRes.data) as any;
      setRules(Array.isArray(rulesPayload) ? rulesPayload : []);
      setStats(Array.isArray(statsPayload) ? statsPayload : (statsPayload ? [statsPayload] : []));
    } finally {
      setIncentiveLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBalance();
    loadTransactions(0);
    loadIncentive();
    loadDebtRecords();
  }, [loadBalance, loadTransactions, loadIncentive, loadDebtRecords]);

  const selectedWithdrawBank = useMemo(
    () => BANK_OPTIONS.find((b) => b.name === withdrawBankName) ?? null,
    [withdrawBankName],
  );

  const walletStatus = walletState?.status ?? 'INACTIVE';
  const operationalBalance = walletState?.operationalBalance ?? walletState?.availableBalance ?? 0;
  const lockedBalance = walletState?.lockedBalance ?? 0;
  const pendingBalance = walletState?.pendingBalance ?? 0;
  const withdrawableBalance = walletState?.withdrawableBalance ?? 0;
  const debt = walletState?.debt ?? 0;
  const activationThreshold = walletState?.activationThreshold ?? 300_000;
  const hasOverdueDebt = walletState?.hasOverdueDebt ?? false;
  const businessAccounts = walletState?.businessAccounts ?? DEFAULT_BUSINESS_ACCOUNTS;
  const topUpBusinessAccount = businessAccounts.topUpAccount ?? DEFAULT_BUSINESS_ACCOUNTS.topUpAccount;
  const payoutBusinessAccount = businessAccounts.payoutAccount ?? topUpBusinessAccount;
  const todayStats = stats[0];
  const activeDebtRecords = debtRecords.filter((r) => r.status !== 'SETTLED');
  const overdueDebtRecords = debtRecords.filter((r) => r.status === 'OVERDUE');

  const filteredTxs = useMemo(
    () => txFilter === 'ALL' ? transactions : transactions.filter((t) => TX_TYPE_META[t.type]?.filterKey === txFilter),
    [transactions, txFilter],
  );

  // ─── Withdraw handler ─────────────────────────────────────────────────────

  const handleWithdraw = async () => {
    const amount = Number(digitsOnly(withdrawAmount));
    const accountNumberDigits = digitsOnly(withdrawAccountNumber);
    setWithdrawError('');

    if (!amount || amount < MIN_WITHDRAW) {
      setWithdrawError(`Số tiền tối thiểu là ${formatCurrency(MIN_WITHDRAW)}`);
      return;
    }
    if (amount > withdrawableBalance) {
      setWithdrawError(`Số dư khả dụng chỉ còn ${formatCurrency(withdrawableBalance)} (không tính ký quỹ ${formatCurrency(lockedBalance)})`);
      return;
    }
    if (!withdrawBankName) { setWithdrawError('Vui lòng chọn ngân hàng nhận'); return; }
    if (!selectedWithdrawBank) { setWithdrawError('Ngân hàng chưa được hỗ trợ'); return; }
    if (!accountNumberDigits || accountNumberDigits.length < selectedWithdrawBank.minDigits || accountNumberDigits.length > selectedWithdrawBank.maxDigits) {
      setWithdrawError(`STK ${selectedWithdrawBank.name} phải từ ${selectedWithdrawBank.minDigits}–${selectedWithdrawBank.maxDigits} chữ số`);
      return;
    }
    if (!withdrawAccountHolder.trim()) { setWithdrawError('Vui lòng nhập tên chủ tài khoản'); return; }

    setWithdrawLoading(true);
    try {
      const res = await walletApi.withdraw(amount, {
        bankName: withdrawBankName,
        accountNumber: accountNumberDigits,
        accountHolder: withdrawAccountHolder.trim().toUpperCase(),
      });
      const { withdrawalId: wdId, status } = res.data.data;
      setWithdrawalId(wdId);
      setWithdrawStep(status === 'PENDING' ? 1 : 2);
      if (status === 'PENDING') setTimeout(() => setWithdrawStep(2), 3000);
      await loadBalance();
      await loadTransactions(0);
    } catch (err: any) {
      setWithdrawError(err.response?.data?.message || err.response?.data?.error?.message || 'Rút tiền thất bại');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const closeWithdrawDialog = () => {
    if (withdrawLoading) return;
    if (withdrawStep === 2) setGlobalSuccess(`Rút tiền thành công! Mã: ${withdrawalId}`);
    setWithdrawOpen(false);
    setWithdrawStep(0);
    setWithdrawAmount('');
    setWithdrawBankName('');
    setWithdrawAccountNumber('');
    setWithdrawAccountHolder('');
    setWithdrawError('');
  };

  // ─── Top-up handler ───────────────────────────────────────────────────────

  const openTopUp = (preset?: number) => {
    setTopUpOpen(true);
    setTopUpError('');
    setTopUpAmount(preset ? String(preset) : '');
    setTopUpProvider(null);
  };

  const handleTopUp = async () => {
    const amount = Number(digitsOnly(topUpAmount));
    setTopUpError('');
    if (!amount || amount < 10_000) { setTopUpError('Số tiền nạp tối thiểu 10.000 VND'); return; }
    if (!topUpProvider) { setTopUpError('Vui lòng chọn phương thức thanh toán'); return; }

    setTopUpLoading(true);
    try {
      const returnUrl = `${window.location.origin}/wallet/topup/return`;
      const res = await walletApi.initTopUp(amount, topUpProvider, returnUrl);
      const { payUrl, topUpId } = res.data.data;
      if (topUpId) {
        sessionStorage.setItem('wallet:pendingTopUpId', topUpId);
        sessionStorage.setItem('wallet:pendingTopUpProvider', topUpProvider);
      }
      setTopUpOpen(false);
      window.location.href = payUrl;
    } catch (err: any) {
      setTopUpError(err.response?.data?.message || err.response?.data?.error?.message || 'Không thể khởi tạo thanh toán');
    } finally {
      setTopUpLoading(false);
    }
  };

  // ─── Render: Hero wallet card (status-aware) ──────────────────────────────

  const renderBalanceCard = () => {
    const gradient = CARD_GRADIENT[walletStatus];
    const chip     = STATUS_CHIP[walletStatus];

    return (
      <Card elevation={0} sx={{ background: gradient, color: '#fff', borderRadius: 4 }}>
        <CardContent sx={{ p: 3 }}>

          {/* Header row */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2.5}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <AccountBalanceWalletRounded sx={{ fontSize: 24, opacity: 0.9 }} />
              <Typography variant="subtitle1" sx={{ opacity: 0.85, fontWeight: 700 }}>
                Ví tài xế
              </Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Chip
                icon={
                  walletStatus === 'INACTIVE' ? <LockRounded sx={{ fontSize: '14px !important', color: '#fff !important' }} /> :
                  walletStatus === 'BLOCKED'  ? <BlockRounded sx={{ fontSize: '14px !important', color: '#fff !important' }} /> :
                  <LockOpenRounded sx={{ fontSize: '14px !important', color: '#fff !important' }} />
                }
                label={chip.label}
                size="small"
                sx={{ bgcolor: chip.bg, color: '#fff', fontWeight: 700, fontSize: '0.68rem', border: '1px solid rgba(255,255,255,0.2)' }}
              />
              <Chip
                icon={<RefreshRounded sx={{ fontSize: '14px !important', color: '#fff !important' }} />}
                label={balanceLoading ? '...' : 'Làm mới'}
                size="small"
                onClick={() => { loadBalance(); loadDebtRecords(); loadTransactions(0); }}
                disabled={balanceLoading}
                sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700, fontSize: '0.68rem', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}
              />
            </Stack>
          </Stack>

          {balanceLoading ? (
            <Stack spacing={1.5}>
              <Skeleton variant="rounded" height={44} sx={{ bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2 }} />
              <Skeleton variant="rounded" height={44} sx={{ bgcolor: 'rgba(255,255,255,0.1)',  borderRadius: 2 }} />
            </Stack>
          ) : balanceError ? (
            <Typography color="error.light" variant="body2">{balanceError}</Typography>
          ) : walletStatus === 'INACTIVE' ? (

            // ── INACTIVE: activation prompt ──────────────────────────────
            <Stack spacing={2}>
              <Box sx={{ bgcolor: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 3, p: 2 }}>
                <Typography variant="h6" fontWeight={800} sx={{ mb: 0.5 }}>
                  Nạp ký quỹ để kích hoạt
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.85, mb: 1.5 }}>
                  Tài khoản cần ký quỹ <strong>{formatCurrency(activationThreshold)}</strong> để bắt đầu nhận cuốc.
                  Khoản này được giữ ở tài khoản doanh nghiệp như tiền ký quỹ và sẽ được hoàn trả khi bạn ngừng hoạt động.
                </Typography>
                <Stack direction="row" justifyContent="space-between" sx={{ bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2, px: 2, py: 1.2 }}>
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>Cần nạp tối thiểu</Typography>
                  <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#fcd34d' }}>
                    {formatCurrency(activationThreshold)}
                  </Typography>
                </Stack>
              </Box>
              <Button
                variant="contained"
                fullWidth
                onClick={() => openTopUp(activationThreshold)}
                endIcon={<ArrowForwardIosRounded fontSize="small" />}
                sx={{
                  bgcolor: 'warning.main',
                  '&:hover': { bgcolor: 'warning.dark' },
                  color: '#1c1917',
                  fontWeight: 800,
                  borderRadius: 3,
                  py: 1.4,
                  fontSize: '0.95rem',
                }}
              >
                Kích hoạt ngay
              </Button>
            </Stack>

          ) : (

            // ── ACTIVE / BLOCKED: 4-section balance ─────────────────────
            <>
              <Stack spacing={1} mb={2.5}>

                {/* Section 1: Available balance (withdrawable) */}
                <Box sx={{
                  bgcolor: 'rgba(255,255,255,0.18)',
                  borderRadius: 2.5, px: 2, py: 1.4,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <Box>
                    <Typography variant="caption" sx={{ opacity: 0.75, display: 'block', lineHeight: 1.1 }}>
                      Số dư khả dụng
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.5, fontSize: '0.62rem' }}>
                      Có thể rút về ngân hàng cá nhân
                    </Typography>
                  </Box>
                  <Typography variant="h5" fontWeight={800}>
                    {formatCurrency(withdrawableBalance)}
                  </Typography>
                </Box>

                {/* Section 2: Pending balance (T+24h hold) — always visible */}
                <Box sx={{
                  bgcolor: pendingBalance > 0 ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.07)',
                  border: `1px solid ${pendingBalance > 0 ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 2.5, px: 2, py: 1.2,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <ScheduleRounded sx={{ fontSize: 15, color: pendingBalance > 0 ? '#fcd34d' : 'rgba(255,255,255,0.4)' }} />
                    <Box>
                      <Typography variant="caption" sx={{ color: pendingBalance > 0 ? '#fde68a' : 'rgba(255,255,255,0.55)', display: 'block', lineHeight: 1.1, fontWeight: 700 }}>
                        Tiền chờ xử lý
                      </Typography>
                      <Typography variant="caption" sx={{ color: pendingBalance > 0 ? '#fde68a' : 'rgba(255,255,255,0.35)', opacity: 0.7, fontSize: '0.62rem' }}>
                        {pendingBalance > 0 ? 'Thu nhập online — chuyển vào khả dụng sau 24h' : 'Thu nhập online sẽ hiển thị ở đây sau khi hoàn thành chuyến'}
                      </Typography>
                    </Box>
                  </Stack>
                  <Typography variant="subtitle2" fontWeight={800} sx={{ color: pendingBalance > 0 ? '#fcd34d' : 'rgba(255,255,255,0.3)' }}>
                    {formatCurrency(pendingBalance)}
                  </Typography>
                </Box>

                {/* Section 3: Debt (only if > 0) */}
                {debt > 0 && (
                  <Box sx={{
                    bgcolor: hasOverdueDebt ? 'rgba(220,38,38,0.25)' : 'rgba(239,68,68,0.2)',
                    border: `1px solid ${hasOverdueDebt ? 'rgba(220,38,38,0.6)' : 'rgba(239,68,68,0.4)'}`,
                    borderRadius: 2.5, px: 2, py: 1.2,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      {hasOverdueDebt
                        ? <ErrorRounded sx={{ fontSize: 15, color: '#f87171' }} />
                        : <WarningAmberRounded sx={{ fontSize: 15, color: '#fca5a5' }} />
                      }
                      <Box>
                        <Typography variant="caption" sx={{ color: '#fca5a5', display: 'block', lineHeight: 1.1, fontWeight: 700 }}>
                          Công nợ platform{hasOverdueDebt ? ' (quá hạn)' : ''}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#fca5a5', opacity: 0.7, fontSize: '0.62rem' }}>
                          {hasOverdueDebt ? 'Vui lòng thanh toán ngay' : 'Phí cuốc tiền mặt chưa thanh toán'}
                        </Typography>
                      </Box>
                    </Stack>
                    <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#f87171' }}>
                      -{formatCurrency(debt)}
                    </Typography>
                  </Box>
                )}

                {/* Section 4: Security deposit (locked) */}
                <Box sx={{
                  bgcolor: 'rgba(255,255,255,0.1)',
                  borderRadius: 2.5, px: 2, py: 1.2,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <LockRounded sx={{ fontSize: 15, opacity: 0.65 }} />
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', lineHeight: 1.1 }}>
                        Ký quỹ (khoá)
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.45, fontSize: '0.62rem' }}>
                        Hoàn trả khi ngừng hoạt động
                      </Typography>
                    </Box>
                  </Stack>
                  <Typography variant="subtitle2" fontWeight={700}>
                    {formatCurrency(lockedBalance)}
                  </Typography>
                </Box>
              </Stack>

              {/* Action buttons */}
              <Stack direction="row" spacing={1.5}>
                <Button
                  variant="contained" fullWidth
                  onClick={() => openTopUp()}
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }, color: '#fff', fontWeight: 700, borderRadius: 3, py: 1.1 }}
                >
                  + Nạp tiền vào ví
                </Button>
                <Button
                  variant="contained" fullWidth
                  onClick={() => { setWithdrawOpen(true); setWithdrawError(''); setWithdrawAmount(''); setWithdrawStep(0); setWithdrawBankName(''); setWithdrawAccountNumber(''); setWithdrawAccountHolder(''); }}
                  disabled={walletStatus !== 'ACTIVE' || withdrawableBalance < MIN_WITHDRAW}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                    color: '#fff', fontWeight: 700, borderRadius: 3, py: 1.1,
                    '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.3)' },
                  }}
                >
                  ↑ Rút về ngân hàng
                </Button>
              </Stack>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  // ─── Render: Status alerts ────────────────────────────────────────────────

  const renderAlerts = () => (
    <Stack spacing={1}>
      {globalSuccess && (
        <Alert severity="success" onClose={() => setGlobalSuccess('')} sx={{ borderRadius: 2 }}>
          {globalSuccess}
        </Alert>
      )}
      {walletStatus === 'BLOCKED' && (
        <Alert severity="error" icon={<BlockRounded />} sx={{ borderRadius: 2 }}
          action={<Button size="small" color="error" onClick={() => openTopUp()}>Nạp tiền</Button>}>
          Tài khoản bị khoá nhận cuốc. Số dư vận hành hiện tại là <strong>{formatCurrency(operationalBalance)}</strong>. Nạp thêm để mở khoá.
        </Alert>
      )}
      {walletState?.warningThresholdReached && walletStatus === 'ACTIVE' && (
        <Alert severity="warning" icon={<WarningAmberRounded />} sx={{ borderRadius: 2 }}>
          Số dư vận hành đang âm ({formatCurrency(operationalBalance)}). Tài khoản sẽ bị khoá khi chạm {formatCurrency(walletState.debtLimit)}.
        </Alert>
      )}
      {hasOverdueDebt && walletStatus === 'ACTIVE' && (
        <Alert severity="error" icon={<ErrorRounded />} sx={{ borderRadius: 2 }}
          action={<Button size="small" color="error" onClick={() => openTopUp()}>Trả nợ</Button>}>
          {overdueDebtRecords.length > 0
            ? <>Bạn có <strong>{overdueDebtRecords.length}</strong> khoản công nợ quá hạn. Thanh toán ngay để tránh bị hạn chế tài khoản.</>
            : 'Bạn có khoản công nợ quá hạn. Thanh toán ngay để tránh bị hạn chế tài khoản.'
          }
        </Alert>
      )}
      {pendingBalance > 0 && walletStatus === 'ACTIVE' && (
        <Alert severity="info" icon={<ScheduleRounded />} sx={{ borderRadius: 2 }}>
          <strong>{formatCurrency(pendingBalance)}</strong> đang chờ xử lý và sẽ chuyển vào số dư khả dụng sau 24h.
        </Alert>
      )}
    </Stack>
  );

  // ─── Render: Activation info card (shown below balance when INACTIVE) ─────

  const renderActivationCard = () => {
    if (walletStatus !== 'INACTIVE') return null;
    return (
      <Card variant="outlined" sx={{ borderRadius: 3, borderColor: 'warning.light', bgcolor: 'warning.50' }}>
        <CardContent sx={{ p: 2.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography variant="subtitle2" fontWeight={800} color="#92400e">
              Tài khoản nhận ký quỹ
            </Typography>
            {getBankLogoUrl(topUpBusinessAccount.bankName) && (
              <img src={getBankLogoUrl(topUpBusinessAccount.bankName)!} alt={topUpBusinessAccount.bankName} style={{ height: 28 }} />
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Tài xế có thể chuyển khoản trực tiếp tới tài khoản doanh nghiệp hoặc chọn nạp qua MoMo / VNPay để kích hoạt ví.
          </Typography>
          <Stack spacing={0.8}>
            {([
              ['Ngân hàng',   topUpBusinessAccount.bankName],
              ['Số tài khoản', topUpBusinessAccount.accountNumber],
              ['Chủ tài khoản', topUpBusinessAccount.accountHolder],
              ['Nội dung CK', (topUpBusinessAccount.note || DEFAULT_BUSINESS_ACCOUNTS.topUpAccount.note).replace('[SO_DIEN_THOAI_TAI_XE]', user?.phoneNumber ?? 'SĐT của bạn')],
              ['Số tiền',     `${formatCurrency(activationThreshold)} (tối thiểu)`],
            ] as const).map(([k, v]) => (
              <Stack key={k} direction="row" justifyContent="space-between" alignItems="flex-start">
                <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>{k}</Typography>
                <Typography variant="caption" fontWeight={700}
                  sx={{ textAlign: 'right', ml: 1, color: k === 'Số tài khoản' ? 'primary.main' : k === 'Số tiền' ? 'success.dark' : 'text.primary' }}>
                  {v}
                </Typography>
              </Stack>
            ))}
          </Stack>
          <Divider sx={{ my: 1.5 }}>
            <Typography variant="caption" color="text.secondary">hoặc thanh toán trực tuyến</Typography>
          </Divider>
          <Button
            variant="contained" fullWidth color="warning"
            onClick={() => openTopUp(activationThreshold)}
            sx={{ borderRadius: 3, fontWeight: 700, py: 1.2 }}
          >
            Nạp ký quỹ qua MoMo / VNPay
          </Button>
        </CardContent>
      </Card>
    );
  };

  // ─── Render: Transaction filter + list ───────────────────────────────────

  const renderTxList = () => (
    <Box>
      {/* Filter bar */}
      <ToggleButtonGroup
        value={txFilter}
        exclusive
        onChange={(_e, v) => { if (v) setTxFilter(v); }}
        size="small"
        fullWidth
        sx={{ mb: 1.5, '& .MuiToggleButton-root': { borderRadius: '20px !important', border: '1px solid', py: 0.5, fontWeight: 700, fontSize: '0.72rem' } }}
      >
        <ToggleButton value="ALL">Tất cả</ToggleButton>
        <ToggleButton value="EARN" sx={{ color: 'success.main', '&.Mui-selected': { bgcolor: 'success.50', color: 'success.dark' } }}>Thu nhập</ToggleButton>
        <ToggleButton value="DEBT" sx={{ color: 'error.main',   '&.Mui-selected': { bgcolor: 'error.50', color: 'error.dark'   } }}>Công nợ</ToggleButton>
        <ToggleButton value="WITHDRAW" sx={{ color: 'text.secondary', '&.Mui-selected': { bgcolor: 'action.selected' } }}>Rút tiền</ToggleButton>
      </ToggleButtonGroup>

      {txLoading && filteredTxs.length === 0 ? (
        <Stack spacing={1.2}>
          {[1, 2, 3, 4].map((k) => <Skeleton key={k} variant="rounded" height={68} sx={{ borderRadius: 3 }} />)}
        </Stack>
      ) : filteredTxs.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
          <InfoOutlined sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">Chưa có giao dịch nào</Typography>
        </Paper>
      ) : (
        <Stack spacing={1}>
          {filteredTxs.map((tx) => {
            const meta = TX_TYPE_META[tx.type];
            const isCredit = meta.sign === '+';
            const iconBg = isCredit
              ? tx.type === 'BONUS' ? 'rgba(251,191,36,0.12)' : 'rgba(22,163,74,0.1)'
              : tx.type === 'COMMISSION' ? 'rgba(239,68,68,0.1)' : 'rgba(100,116,139,0.1)';
            const iconColor = isCredit
              ? tx.type === 'BONUS' ? 'warning.main' : 'success.main'
              : tx.type === 'COMMISSION' ? 'error.main' : 'text.secondary';

            return (
              <Card key={tx.id} variant="outlined" sx={{ borderRadius: 3, '&:hover': { boxShadow: 1 } }}>
                <CardContent sx={{ py: 1.4, px: 2, '&:last-child': { pb: 1.4 } }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1.5} flex={1} minWidth={0}>
                      <Box sx={{
                        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        bgcolor: iconBg, color: iconColor,
                      }}>
                        {TX_TYPE_ICONS[tx.type]}
                      </Box>
                      <Box minWidth={0}>
                        <Stack direction="row" alignItems="center" spacing={0.6} flexWrap="wrap">
                          <Typography variant="body2" fontWeight={700} noWrap>
                            {tx.description || meta.label}
                          </Typography>
                          <Chip label={meta.label} color={meta.color} size="small"
                            sx={{ height: 15, fontSize: '0.6rem', display: { xs: 'none', sm: 'flex' } }} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(tx.createdAt)}
                          {tx.rideId ? ` · #${tx.rideId.slice(-6)}` : ''}
                        </Typography>
                      </Box>
                    </Stack>
                    <Box textAlign="right" flexShrink={0} ml={1}>
                      <Typography variant="subtitle2" fontWeight={800}
                        color={isCredit ? (tx.type === 'BONUS' ? 'warning.dark' : 'success.main') : (tx.type === 'COMMISSION' ? 'error.main' : 'text.secondary')}>
                        {meta.sign}{formatCurrency(tx.amount)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Dư: {formatCurrency(tx.balanceAfter)}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}

          {transactions.length < txTotal && txFilter === 'ALL' && (
            <Button variant="outlined" fullWidth onClick={() => loadTransactions(txOffset + TX_PAGE, true)}
              disabled={txLoading} sx={{ mt: 0.5, borderRadius: 3 }}>
              {txLoading ? <CircularProgress size={18} /> : 'Tải thêm'}
            </Button>
          )}
        </Stack>
      )}
    </Box>
  );

  // ─── Render: Debt Records ─────────────────────────────────────────────────

  const renderDebtRecords = () => {
    if (debtLoading) {
      return <Stack spacing={1.2}>{[1, 2, 3].map((k) => <Skeleton key={k} variant="rounded" height={72} sx={{ borderRadius: 3 }} />)}</Stack>;
    }

    if (activeDebtRecords.length === 0 && debtRecords.filter((r) => r.status === 'SETTLED').length === 0) {
      return (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
          <CheckCircleRounded sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
          <Typography variant="subtitle2" fontWeight={700} color="success.dark">Không có công nợ</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Tất cả các khoản phí tiền mặt đã được thanh toán.
          </Typography>
        </Paper>
      );
    }

    return (
      <Stack spacing={2}>
        {activeDebtRecords.length > 0 && (
          <Card variant="outlined" sx={{ borderRadius: 3, borderColor: hasOverdueDebt ? 'error.main' : 'warning.main', bgcolor: hasOverdueDebt ? '#fef2f2' : '#fffbeb' }}>
            <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="subtitle2" fontWeight={800} color={hasOverdueDebt ? 'error.dark' : 'warning.dark'}>
                  {hasOverdueDebt ? `Công nợ quá hạn (${overdueDebtRecords.length} khoản)` : 'Công nợ đang chờ thanh toán'}
                </Typography>
                <Button size="small" variant="contained" color={hasOverdueDebt ? 'error' : 'warning'}
                  onClick={() => openTopUp()} sx={{ borderRadius: 2, fontWeight: 700, fontSize: '0.72rem' }}>
                  Thanh toán
                </Button>
              </Stack>
              <Stack spacing={1}>
                {activeDebtRecords.map((rec) => {
                  const due = new Date(rec.dueDate);
                  const now = new Date();
                  const isOverdue = rec.status === 'OVERDUE';
                  const daysLeft = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <Box key={rec.id} sx={{
                      bgcolor: isOverdue ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.7)',
                      border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.3)' : 'rgba(0,0,0,0.08)'}`,
                      borderRadius: 2, px: 1.5, py: 1,
                    }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Stack direction="row" alignItems="center" spacing={0.6} mb={0.2}>
                            <Chip
                              label={isOverdue ? 'Quá hạn' : `Còn ${daysLeft} ngày`}
                              size="small"
                              color={isOverdue ? 'error' : 'warning'}
                              sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700 }}
                            />
                            {rec.rideId && (
                              <Typography variant="caption" color="text.disabled">
                                #{rec.rideId.slice(-6)}
                              </Typography>
                            )}
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            Ngày tạo: {formatDate(rec.createdAt)}
                          </Typography>
                          <Typography variant="caption" color={isOverdue ? 'error.main' : 'text.secondary'} sx={{ display: 'block' }}>
                            Hạn: {formatDate(rec.dueDate)}
                          </Typography>
                        </Box>
                        <Box textAlign="right">
                          <Typography variant="subtitle2" fontWeight={800} color={isOverdue ? 'error.main' : 'warning.dark'}>
                            -{formatCurrency(rec.remaining)}
                          </Typography>
                          {rec.remaining < rec.amount && (
                            <Typography variant="caption" color="text.disabled">
                              Còn lại / {formatCurrency(rec.amount)}
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Settled records */}
        {debtRecords.filter((r) => r.status === 'SETTLED').length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1 }}>
              Đã thanh toán
            </Typography>
            <Stack spacing={0.8}>
              {debtRecords.filter((r) => r.status === 'SETTLED').slice(0, 5).map((rec) => (
                <Box key={rec.id} sx={{
                  bgcolor: '#f0fdf4', border: '1px solid', borderColor: 'success.100',
                  borderRadius: 2, px: 1.5, py: 0.8,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <Stack>
                    <Stack direction="row" alignItems="center" spacing={0.6}>
                      <CheckCircleRounded sx={{ fontSize: 14, color: 'success.main' }} />
                      <Typography variant="caption" fontWeight={700} color="success.dark">Đã tất toán</Typography>
                      {rec.rideId && <Typography variant="caption" color="text.disabled">#{rec.rideId.slice(-6)}</Typography>}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">{formatDate(rec.createdAt)}</Typography>
                  </Stack>
                  <Typography variant="caption" fontWeight={700} color="text.secondary">
                    {formatCurrency(rec.amount)}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        <Card variant="outlined" sx={{ borderRadius: 3, bgcolor: 'primary.50', borderColor: 'primary.100' }}>
          <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="primary.dark" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>
              Cách thanh toán công nợ
            </Typography>
            <Stack spacing={0.4}>
              {[
                'Tự động: trừ khi bạn có thu nhập từ chuyến online',
                'Thủ công: nạp tiền vào tài khoản doanh nghiệp',
              ].map((s, i) => (
                <Typography key={i} variant="caption" color="text.secondary">• {s}</Typography>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    );
  };

  // ─── Render: Incentive ────────────────────────────────────────────────────

  const renderIncentive = () => {
    if (incentiveLoading) {
      return <Stack spacing={1.2}>{[1, 2, 3].map((k) => <Skeleton key={k} variant="rounded" height={72} sx={{ borderRadius: 3 }} />)}</Stack>;
    }
    return (
      <Stack spacing={2}>
        {todayStats && (
          <Card variant="outlined" sx={{ borderRadius: 3, bgcolor: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="subtitle2" fontWeight={700} color="success.dark" gutterBottom>
                Hôm nay
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                {[
                  { label: 'Số cuốc',     value: todayStats.tripsCompleted },
                  { label: 'Quãng đường', value: `${todayStats.distanceKm.toFixed(1)} km` },
                  { label: 'Cao điểm',    value: todayStats.peakTrips },
                  { label: 'Thưởng',      value: formatCurrency(todayStats.bonusAwarded), color: 'success.dark' },
                ].map((item) => (
                  <Box key={item.label}>
                    <Typography variant="caption" color="text.secondary" display="block">{item.label}</Typography>
                    <Typography fontWeight={700} color={item.color}>{item.value}</Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        )}

        <Typography variant="subtitle1" fontWeight={700}>Quy tắc thưởng</Typography>
        {rules.filter((r) => r.isActive).length === 0 ? (
          <Typography color="text.secondary" variant="body2">Chưa có quy tắc thưởng nào đang hoạt động.</Typography>
        ) : rules.filter((r) => r.isActive).map((rule) => {
          let progress = 0;
          let progressLabel = '';
          if (todayStats) {
            if (rule.type === 'TRIP_COUNT' && rule.conditionValue > 0) {
              progress = Math.min(100, (todayStats.tripsCompleted / rule.conditionValue) * 100);
              progressLabel = `${todayStats.tripsCompleted}/${rule.conditionValue} cuốc`;
            } else if (rule.type === 'DISTANCE_KM' && rule.conditionValue > 0) {
              progress = Math.min(100, (todayStats.distanceKm / rule.conditionValue) * 100);
              progressLabel = `${todayStats.distanceKm.toFixed(1)}/${rule.conditionValue} km`;
            } else if (rule.type === 'PEAK_HOUR') {
              progressLabel = `${todayStats.peakTrips} cuốc giờ cao điểm hôm nay`;
            }
          }
          return (
            <Card key={rule.id} variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" spacing={1.5}>
                  <Box sx={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#fffbeb', color: 'warning.dark' }}>
                    {RULE_ICONS[rule.type]}
                  </Box>
                  <Box flex={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="body2" fontWeight={700}>{rule.description || RULE_TYPE_LABELS[rule.type]}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {rule.type === 'PEAK_HOUR'    ? 'Mỗi cuốc giờ cao điểm (6–9h, 16–19h)' :
                           rule.type === 'TRIP_COUNT'   ? `≥ ${rule.conditionValue} cuốc/ngày` :
                                                          `≥ ${rule.conditionValue} km/ngày`}
                        </Typography>
                      </Box>
                      <Chip icon={<EmojiEventsRounded fontSize="small" />} label={`+${formatCurrency(rule.rewardAmount)}`}
                        color="warning" size="small" sx={{ fontWeight: 800, ml: 1, flexShrink: 0 }} />
                    </Stack>
                    {progressLabel && rule.type !== 'PEAK_HOUR' && (
                      <Box mt={1}>
                        <Stack direction="row" justifyContent="space-between" mb={0.3}>
                          <Typography variant="caption" color="text.secondary">{progressLabel}</Typography>
                          {progress >= 100 && <Chip icon={<CheckCircleRounded />} label="Đã đạt" color="success" size="small" sx={{ height: 18, fontSize: '0.6rem' }} />}
                        </Stack>
                        <LinearProgress variant="determinate" value={progress} color={progress >= 100 ? 'success' : 'warning'} sx={{ height: 5, borderRadius: 3 }} />
                      </Box>
                    )}
                    {rule.type === 'PEAK_HOUR' && progressLabel && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>{progressLabel}</Typography>
                    )}
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    );
  };

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <Box sx={{ pt: 1.5, pb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>

      {renderBalanceCard()}
      {renderActivationCard()}
      {renderAlerts()}

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="fullWidth"
        sx={{ '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' } }}>
        <Tab label="Giao dịch" />
        <Tab
          label={
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <span>Công nợ</span>
              {activeDebtRecords.length > 0 && (
                <Chip
                  label={activeDebtRecords.length}
                  size="small"
                  color={hasOverdueDebt ? 'error' : 'warning'}
                  sx={{ height: 16, fontSize: '0.6rem', fontWeight: 800, minWidth: 20 }}
                />
              )}
            </Stack>
          }
        />
        <Tab label="Thưởng" />
      </Tabs>

      {tab === 0 && renderTxList()}
      {tab === 1 && renderDebtRecords()}
      {tab === 2 && renderIncentive()}

      {/* ── Withdrawal Dialog ── */}
      <Dialog open={withdrawOpen} onClose={closeWithdrawDialog}
        PaperProps={{ sx: { borderRadius: 4, mx: 2, width: '100%', maxWidth: 480 } }}>
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountBalanceRounded /> Rút tiền về ngân hàng
        </DialogTitle>
        <DialogContent>
          <Stepper activeStep={withdrawStep} sx={{ mb: 2.5, mt: 0.5 }}>
            <Step><StepLabel>Nhập thông tin</StepLabel></Step>
            <Step><StepLabel>Đang xử lý</StepLabel></Step>
            <Step><StepLabel>Hoàn tất</StepLabel></Step>
          </Stepper>

          {withdrawStep === 0 && (
            <Stack spacing={2}>
              {/* Source account info */}
              <Card variant="outlined" sx={{ borderRadius: 2.5, bgcolor: '#eff6ff', borderColor: '#bfdbfe' }}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Typography variant="caption" color="primary.dark" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Nguồn chuyển tiền (tài khoản doanh nghiệp)
                    </Typography>
                    {getBankLogoUrl(payoutBusinessAccount.bankName) && (
                      <img src={getBankLogoUrl(payoutBusinessAccount.bankName)!} alt={payoutBusinessAccount.bankName} style={{ height: 24 }} />
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Hệ thống sẽ chuyển tiền từ tài khoản doanh nghiệp về ngân hàng cá nhân mà bạn khai báo.
                  </Typography>
                  <Stack spacing={0.6}>
                    {[
                      ['Ngân hàng', payoutBusinessAccount.bankName],
                      ['Số TK', payoutBusinessAccount.accountNumber],
                      ['Chủ TK', payoutBusinessAccount.accountHolder],
                      ['Số dư khả dụng', formatCurrency(withdrawableBalance)],
                      ...(lockedBalance > 0 ? [['Ký quỹ (khoá)', formatCurrency(lockedBalance)]] as const : []),
                    ].map(([k, v]) => (
                      <Stack key={k} direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">{k}</Typography>
                        <Typography variant="caption" fontWeight={700} color={k === 'Số dư khả dụng' ? 'success.dark' : 'inherit'}>{v}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </CardContent>
              </Card>

              {/* Quick preset */}
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.75}>Chọn nhanh</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {[100_000, 200_000, 500_000, 1_000_000].filter((p) => p <= withdrawableBalance).map((preset) => (
                    <Chip key={preset} label={formatCurrency(preset)}
                      onClick={() => setWithdrawAmount(String(preset))}
                      color={digitsOnly(withdrawAmount) === String(preset) ? 'primary' : 'default'}
                      variant={digitsOnly(withdrawAmount) === String(preset) ? 'filled' : 'outlined'}
                      sx={{ fontWeight: 700 }} />
                  ))}
                </Stack>
              </Box>

              <TextField
                label="Số tiền rút (VND)" type="text" fullWidth
                value={formatMoneyInput(withdrawAmount)}
                onChange={(e) => setWithdrawAmount(digitsOnly(e.target.value))}
                inputProps={{ inputMode: 'numeric' }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button size="small" sx={{ fontWeight: 700 }} onClick={() => setWithdrawAmount(String(Math.floor(withdrawableBalance)))}>Tất cả</Button>
                    </InputAdornment>
                  ),
                }}
                helperText={`Tối thiểu ${formatCurrency(MIN_WITHDRAW)} · Khả dụng: ${formatCurrency(withdrawableBalance)}`}
              />

              {/* Bank selection */}
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.75}>Ngân hàng nhận tiền của bạn</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                  {BANK_OPTIONS.map((bank) => {
                    const sel = withdrawBankName === bank.name;
                    return (
                      <Card key={bank.name} variant="outlined" onClick={() => setWithdrawBankName(bank.name)}
                        sx={{ cursor: 'pointer', borderRadius: 2.5, border: '2px solid', borderColor: sel ? bank.color : 'divider', bgcolor: sel ? `${bank.color}14` : '#fff', transition: 'all 0.12s' }}>
                        <CardContent sx={{ p: 1, '&:last-child': { pb: 1 }, textAlign: 'center' }}>
                          <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: bank.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.72rem', mx: 'auto', mb: 0.4 }}>
                            {bank.short}
                          </Box>
                          <Typography variant="caption" fontWeight={700} display="block" lineHeight={1.1}>{bank.name}</Typography>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Box>
              </Box>

              <TextField label="Số tài khoản nhận" fullWidth
                value={formatDigitGroups(withdrawAccountNumber)}
                onChange={(e) => setWithdrawAccountNumber(digitsOnly(e.target.value))}
                inputProps={{ maxLength: 24, inputMode: 'numeric' }}
                helperText={selectedWithdrawBank ? `${selectedWithdrawBank.name}: ${selectedWithdrawBank.minDigits}–${selectedWithdrawBank.maxDigits} chữ số` : 'Nhập STK không có dấu cách'} />

              <TextField label="Tên chủ tài khoản" fullWidth
                value={withdrawAccountHolder}
                onChange={(e) => setWithdrawAccountHolder(e.target.value.toUpperCase())}
                helperText="Nhập đúng tên trên thẻ/sổ ngân hàng (in hoa)" />

              {/* Preview */}
              <Card variant="outlined" sx={{ borderRadius: 2.5, bgcolor: '#f8fafc' }}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Xem trước</Typography>
                  <Stack spacing={0.7} mt={1}>
                    {[
                      ['Từ', `${payoutBusinessAccount.bankName} · ${payoutBusinessAccount.accountNumber}`],
                      ['Đến', withdrawBankName || 'Chưa chọn'],
                      ['STK', formatDigitGroups(withdrawAccountNumber) || 'Chưa nhập'],
                      ['Chủ TK', withdrawAccountHolder || 'Chưa nhập'],
                      ['Số tiền', formatCurrency(Number(digitsOnly(withdrawAmount)) || 0)],
                    ].map(([k, v]) => (
                      <Stack key={k} direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">{k}</Typography>
                        <Typography variant="caption" fontWeight={700} sx={{ textAlign: 'right', maxWidth: '65%' }}>{v}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </CardContent>
              </Card>

              {withdrawError && <Alert severity="error" sx={{ borderRadius: 2 }}>{withdrawError}</Alert>}
            </Stack>
          )}

          {withdrawStep === 1 && (
            <Stack spacing={3} alignItems="center" py={4}>
              <HourglassTopRounded sx={{ fontSize: 60, color: 'warning.main', animation: 'spin 2s linear infinite', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />
              <Typography variant="h6" fontWeight={700} color="warning.main">Đang xử lý...</Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                Chúng tôi đang chuyển tiền từ tài khoản doanh nghiệp đến ngân hàng của bạn.
              </Typography>
              <LinearProgress sx={{ width: '100%', borderRadius: 3 }} />
            </Stack>
          )}

          {withdrawStep === 2 && (
            <Stack spacing={2.5} alignItems="center" py={3}>
              <CheckCircleRounded sx={{ fontSize: 60, color: 'success.main' }} />
              <Typography variant="h6" fontWeight={700} color="success.main">Rút tiền thành công!</Typography>
              <Card variant="outlined" sx={{ borderRadius: 3, width: '100%', bgcolor: '#f0fdf4' }}>
                <CardContent>
                  <Stack spacing={0.6}>
                    {[
                      ['Mã giao dịch', withdrawalId.slice(-8).toUpperCase()],
                      ['Số tiền', formatCurrency(Number(digitsOnly(withdrawAmount)) || 0)],
                      ['Ngân hàng nhận', withdrawBankName],
                      ['STK', `****${digitsOnly(withdrawAccountNumber).slice(-4)}`],
                    ].map(([k, v]) => (
                      <Stack key={k} direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">{k}</Typography>
                        <Typography variant="body2" fontWeight={700}
                          color={k === 'Số tiền' ? 'success.dark' : 'inherit'}>{v}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          {withdrawStep === 0 && (
            <>
              <Button variant="outlined" onClick={closeWithdrawDialog} disabled={withdrawLoading} sx={{ borderRadius: 3, flex: 1 }}>Huỷ</Button>
              <Button variant="contained" onClick={handleWithdraw} disabled={withdrawLoading} sx={{ borderRadius: 3, fontWeight: 700, flex: 2 }}>
                {withdrawLoading ? <CircularProgress size={20} /> : 'Xác nhận rút tiền'}
              </Button>
            </>
          )}
          {withdrawStep === 1 && <Typography variant="caption" color="text.secondary" mx="auto">Vui lòng chờ...</Typography>}
          {withdrawStep === 2 && (
            <Button variant="contained" fullWidth onClick={closeWithdrawDialog} sx={{ borderRadius: 3, fontWeight: 700 }}>Đóng</Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ── Top-up / Deposit Dialog ── */}
      <Dialog open={topUpOpen}
        onClose={() => !topUpLoading && (setTopUpOpen(false), setTopUpProvider(null), setTopUpAmount(''), setTopUpError(''))}
        PaperProps={{ sx: { borderRadius: 4, mx: 2, width: '100%', maxWidth: 440 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {walletStatus === 'INACTIVE' ? 'Nạp ký quỹ kích hoạt tài khoản' : 'Nạp tiền vào tài khoản doanh nghiệp'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} pt={0.5}>
            {/* Business account info */}
            <Card variant="outlined" sx={{ borderRadius: 2.5, bgcolor: '#f0fdf4', borderColor: '#bbf7d0' }}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="caption" color="success.dark" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Tài khoản của doanh nghiệp
                  </Typography>
                  {getBankLogoUrl(topUpBusinessAccount.bankName) && (
                    <img src={getBankLogoUrl(topUpBusinessAccount.bankName)!} alt={topUpBusinessAccount.bankName} style={{ height: 24 }} />
                  )}
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Tài khoản này nhận tiền ký quỹ kích hoạt, tiền nạp ví và tiền tài xế dùng để thanh toán công nợ chuyến tiền mặt.
                </Typography>
                <Stack spacing={0.6}>
                  {([
                    ['Ngân hàng',   topUpBusinessAccount.bankName],
                    ['Số tài khoản', topUpBusinessAccount.accountNumber],
                    ['Chủ tài khoản', topUpBusinessAccount.accountHolder],
                    ['Nội dung',    (topUpBusinessAccount.note || DEFAULT_BUSINESS_ACCOUNTS.topUpAccount.note).replace('[SO_DIEN_THOAI_TAI_XE]', user?.phoneNumber ?? 'SĐT của bạn')],
                  ] as const).map(([k, v]) => (
                    <Stack key={k} direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>{k}</Typography>
                      <Typography variant="caption" fontWeight={700} sx={{ textAlign: 'right', ml: 1, color: k === 'Số tài khoản' ? 'primary.main' : 'inherit' }}>{v}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </CardContent>
            </Card>

            <Divider><Typography variant="caption" color="text.secondary">Hoặc thanh toán qua ví điện tử</Typography></Divider>

            {/* Quick amounts */}
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.75}>
                {walletStatus === 'INACTIVE'
                  ? `Cần nạp tối thiểu ${formatCurrency(activationThreshold)} để kích hoạt`
                  : 'Chọn nhanh số tiền muốn chuyển vào tài khoản doanh nghiệp'}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {(walletStatus === 'INACTIVE' ? [300_000, 500_000, 1_000_000] : [100_000, 200_000, 300_000, 500_000]).map((preset) => (
                  <Chip key={preset} label={formatCurrency(preset)}
                    onClick={() => setTopUpAmount(String(preset))}
                    color={digitsOnly(topUpAmount) === String(preset) ? 'primary' : 'default'}
                    variant={digitsOnly(topUpAmount) === String(preset) ? 'filled' : 'outlined'}
                    sx={{ fontWeight: 700 }} />
                ))}
              </Stack>
            </Box>

            <TextField label="Số tiền nạp (VND)" type="text" fullWidth
              value={formatMoneyInput(topUpAmount)}
              onChange={(e) => setTopUpAmount(digitsOnly(e.target.value))}
              inputProps={{ inputMode: 'numeric' }}
              helperText={walletStatus === 'INACTIVE'
                ? `Tối thiểu ${formatCurrency(activationThreshold)} để kích hoạt tài khoản`
                : 'Tối thiểu 10.000 đ · Dùng để nạp ví hoặc tất toán công nợ tiền mặt'} />

            {/* Payment method */}
            <Stack direction="row" spacing={1.5}>
              {[
                { id: 'MOMO'  as const, label: 'MoMo',  sublabel: 'Ví MoMo',        color: '#ae2070', bg: '#fdf0f5' },
                { id: 'VNPAY' as const, label: 'VNPay', sublabel: 'ATM / QR Code',  color: '#0066cc', bg: '#f0f5ff' },
              ].map((p) => (
                <Card key={p.id} variant="outlined" onClick={() => setTopUpProvider(p.id)}
                  sx={{ flex: 1, borderRadius: 3, cursor: 'pointer', border: '2px solid', borderColor: topUpProvider === p.id ? p.color : 'divider', bgcolor: topUpProvider === p.id ? p.bg : 'background.paper', transition: 'all 0.12s', textAlign: 'center', py: 1.5 }}>
                  <Typography fontWeight={800} sx={{ color: p.color, fontSize: '1rem' }}>{p.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{p.sublabel}</Typography>
                </Card>
              ))}
            </Stack>

            {topUpError && <Alert severity="error" sx={{ borderRadius: 2 }}>{topUpError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button variant="outlined"
            onClick={() => { setTopUpOpen(false); setTopUpProvider(null); setTopUpAmount(''); setTopUpError(''); }}
            disabled={topUpLoading} sx={{ borderRadius: 3, flex: 1 }}>Huỷ</Button>
          <Button variant="contained" onClick={handleTopUp}
            disabled={topUpLoading || !topUpProvider}
            sx={{
              borderRadius: 3, fontWeight: 700, flex: 2,
              bgcolor: topUpProvider === 'MOMO' ? '#ae2070' : topUpProvider === 'VNPAY' ? '#0066cc' : undefined,
              '&:hover': { bgcolor: topUpProvider === 'MOMO' ? '#8c1858' : topUpProvider === 'VNPAY' ? '#0055aa' : undefined },
            }}>
            {topUpLoading
              ? <CircularProgress size={20} sx={{ color: '#fff' }} />
              : topUpProvider
              ? `Thanh toán qua ${topUpProvider === 'MOMO' ? 'MoMo' : 'VNPay'}`
              : 'Chọn phương thức'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
