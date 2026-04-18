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
} from '@mui/material';
import {
  AccountBalanceWalletRounded,
  AccountBalanceRounded,
  ArrowDownwardRounded,
  ArrowUpwardRounded,
  CheckCircleRounded,
  EmojiEventsRounded,
  InfoOutlined,
  LocalFireDepartmentRounded,
  RouteRounded,
  TwoWheelerRounded,
  AddRounded,
  WarningAmberRounded,
  HourglassTopRounded,
} from '@mui/icons-material';
import { walletApi, WalletTransaction, DailyStats, IncentiveRule } from '../api/wallet.api';
import { formatCurrency, formatDate } from '../utils/format.utils';

const MIN_WITHDRAW = 50_000;

const BANK_OPTIONS = [
  { name: 'Vietcombank', short: 'VCB', accent: '#16a34a', minDigits: 8, maxDigits: 14, helper: 'STK 8-14 số' },
  { name: 'BIDV', short: 'BIDV', accent: '#1d4ed8', minDigits: 10, maxDigits: 14, helper: 'STK 10-14 số' },
  { name: 'Techcombank', short: 'TCB', accent: '#dc2626', minDigits: 10, maxDigits: 14, helper: 'STK 10-14 số' },
  { name: 'MB Bank', short: 'MB', accent: '#0f172a', minDigits: 8, maxDigits: 16, helper: 'STK 8-16 số' },
  { name: 'ACB', short: 'ACB', accent: '#2563eb', minDigits: 8, maxDigits: 13, helper: 'STK 8-13 số' },
];

const digitsOnly = (value: string) => value.replace(/\D/g, '');

const formatDigitGroups = (value: string) => digitsOnly(value).replace(/(\d{4})(?=\d)/g, '$1 ');

const formatMoneyInput = (value: string) => {
  const digits = digitsOnly(value);
  return digits ? Number(digits).toLocaleString('vi-VN') : '';
};

const TX_TYPE_META: Record<
  WalletTransaction['type'],
  { label: string; color: 'success' | 'error' | 'warning' | 'info' | 'default'; sign: '+' | '-' }
> = {
  EARN:       { label: 'Thu nhập online',    color: 'success', sign: '+' },
  COMMISSION: { label: 'Hoa hồng platform',  color: 'error',   sign: '-' },
  BONUS:      { label: 'Thưởng',             color: 'warning',  sign: '+' },
  WITHDRAW:   { label: 'Rút tiền',           color: 'default',  sign: '-' },
  REFUND:     { label: 'Hoàn tiền',          color: 'info',     sign: '-' },
  TOP_UP:     { label: 'Nạp ví',            color: 'success',  sign: '+' },
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

export default function WalletPage() {
  const [tab, setTab] = useState(0);

  // Balance
  const [balance, setBalance] = useState<number | null>(null);
  const [walletState, setWalletState] = useState<{
    initialActivationCompleted?: boolean;
    activationRequired?: boolean;
    warningThresholdReached?: boolean;
    canAcceptRide?: boolean;
    activationThreshold?: number;
    warningThreshold?: number;
    debtLimit?: number;
    reason?: string;
  } | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState('');

  // Transactions
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txOffset, setTxOffset] = useState(0);
  const [txLoading, setTxLoading] = useState(false);
  const TX_PAGE = 15;

  // Incentive
  const [rules, setRules] = useState<IncentiveRule[]>([]);
  const [stats, setStats] = useState<DailyStats[]>([]);
  const [incentiveLoading, setIncentiveLoading] = useState(false);

  // Withdraw dialog
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawBankName, setWithdrawBankName] = useState('');
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState('');
  const [withdrawAccountHolder, setWithdrawAccountHolder] = useState('');
  const [withdrawStep, setWithdrawStep] = useState<0 | 1 | 2>(0); // 0=form, 1=pending, 2=success
  const [withdrawalId, setWithdrawalId] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState('');

  // Top-up dialog
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpProvider, setTopUpProvider] = useState<'MOMO' | 'VNPAY' | null>(null);
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpError, setTopUpError] = useState('');
  const [topUpSuccess, setTopUpSuccess] = useState('');

  // ─── Loaders ─────────────────────────────────────────────────────────────

  const loadBalance = useCallback(async () => {
    setBalanceLoading(true);
    setBalanceError('');
    try {
      const res = await walletApi.getBalance();
      setBalance(res.data.data.balance);
      setWalletState(res.data.data);
    } catch (err: any) {
      setBalanceError(err.response?.data?.error?.message || 'Không thể tải số dư ví');
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  const loadTransactions = useCallback(
    async (offset: number, append = false) => {
      setTxLoading(true);
      try {
        const res = await walletApi.getTransactions(TX_PAGE, offset);
        const { transactions: newTx, total } = res.data.data;
        setTransactions((prev) => (append ? [...prev, ...newTx] : newTx));
        setTxTotal(total);
        setTxOffset(offset);
      } finally {
        setTxLoading(false);
      }
    },
    [],
  );

  const loadIncentive = useCallback(async () => {
    setIncentiveLoading(true);
    try {
      const [rulesRes, statsRes] = await Promise.all([
        walletApi.getIncentiveRules(),
        walletApi.getDailyStats(7),
      ]);
      setRules(rulesRes.data.data);
      setStats(statsRes.data.data);
    } finally {
      setIncentiveLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBalance();
    loadTransactions(0);
    loadIncentive();
  }, [loadBalance, loadTransactions, loadIncentive]);

  const selectedWithdrawBank = useMemo(
    () => BANK_OPTIONS.find((bank) => bank.name === withdrawBankName) || null,
    [withdrawBankName],
  );

  // ─── Withdraw ─────────────────────────────────────────────────────────────

  const handleWithdraw = async () => {
    const amount = Number(digitsOnly(withdrawAmount));
    const accountNumberDigits = digitsOnly(withdrawAccountNumber);
    setWithdrawError('');

    if (!amount || amount <= 0) {
      setWithdrawError('Vui lòng nhập số tiền hợp lệ');
      return;
    }
    if (amount < MIN_WITHDRAW) {
      setWithdrawError(`Số tiền rút tối thiểu là ${formatCurrency(MIN_WITHDRAW)}`);
      return;
    }
    if (balance !== null && amount > balance) {
      setWithdrawError(
        `Số dư không đủ. Số dư hiện tại: ${formatCurrency(balance)}`,
      );
      return;
    }
    if (!withdrawBankName) {
      setWithdrawError('Vui lòng chọn ngân hàng');
      return;
    }
    if (!selectedWithdrawBank) {
      setWithdrawError('Ngân hàng nhận tiền chưa được hỗ trợ');
      return;
    }
    if (
      !accountNumberDigits
      || accountNumberDigits.length < selectedWithdrawBank.minDigits
      || accountNumberDigits.length > selectedWithdrawBank.maxDigits
    ) {
      setWithdrawError(`Số tài khoản ${selectedWithdrawBank.name} phải có ${selectedWithdrawBank.minDigits}-${selectedWithdrawBank.maxDigits} chữ số`);
      return;
    }
    if (!withdrawAccountHolder.trim()) {
      setWithdrawError('Vui lòng nhập tên chủ tài khoản');
      return;
    }
    if (!/^[A-Za-zÀ-ỹ\s]+$/u.test(withdrawAccountHolder.trim())) {
      setWithdrawError('Tên chủ tài khoản chỉ nên chứa chữ cái và khoảng trắng');
      return;
    }

    setWithdrawLoading(true);
    try {
      const bankInfo = {
        bankName: withdrawBankName,
        accountNumber: accountNumberDigits,
        accountHolder: withdrawAccountHolder.trim().toUpperCase(),
      };
      const res = await walletApi.withdraw(amount, bankInfo);
      const { newBalance, withdrawalId: wdId, status } = res.data.data;
      setBalance(newBalance);
      setWithdrawalId(wdId);

      if (status === 'PENDING') {
        // Show pending step
        setWithdrawStep(1);
        // Simulate bank processing: auto-confirm after 3 seconds
        setTimeout(() => {
          setWithdrawStep(2);
        }, 3000);
      } else {
        setWithdrawStep(2);
      }

      // Reload transactions
      loadTransactions(0);
    } catch (err: any) {
      setWithdrawError(
        err.response?.data?.error?.message || 'Rút tiền thất bại, vui lòng thử lại',
      );
    } finally {
      setWithdrawLoading(false);
    }
  };

  const closeWithdrawDialog = () => {
    if (withdrawLoading) return;
    setWithdrawOpen(false);
    setWithdrawStep(0);
    setWithdrawAmount('');
    setWithdrawBankName('');
    setWithdrawAccountNumber('');
    setWithdrawAccountHolder('');
    setWithdrawError('');
    if (withdrawStep === 2) {
      setWithdrawSuccess(`Rút tiền thành công! Mã giao dịch: ${withdrawalId}`);
    }
  };

  const handleTopUp = async () => {
    const amount = parseFloat(topUpAmount.replace(/[.,]/g, ''));
    setTopUpError('');

    if (!amount || amount <= 0) {
      setTopUpError('Vui lòng nhập số tiền hợp lệ');
      return;
    }
    if (!topUpProvider) {
      setTopUpError('Vui lòng chọn phương thức thanh toán');
      return;
    }

    setTopUpLoading(true);
    try {
      // Return URL: driver app callback page
      const returnUrl = `${window.location.origin}/wallet/topup/return`;
      const res = await walletApi.initTopUp(amount, topUpProvider, returnUrl);
      const { payUrl, topUpId } = res.data.data;

      // Save topUpId + provider to sessionStorage so the return page can poll status
      if (topUpId) {
        sessionStorage.setItem('wallet:pendingTopUpId', topUpId);
        sessionStorage.setItem('wallet:pendingTopUpProvider', topUpProvider);
      }

      // Close dialog and redirect to gateway
      setTopUpOpen(false);
      setTopUpAmount('');
      setTopUpProvider(null);
      window.location.href = payUrl;
    } catch (err: any) {
      setTopUpError(
        err.response?.data?.error?.message || 'Không thể khởi tạo thanh toán, vui lòng thử lại',
      );
    } finally {
      setTopUpLoading(false);
    }
  };

  const todayStats = stats[0];
  const activationThreshold = walletState?.activationThreshold ?? 300_000;
  const warningThreshold = walletState?.warningThreshold ?? -100_000;
  const debtLimit = walletState?.debtLimit ?? -200_000;
  const activationTopUpNeeded = walletState?.activationRequired && balance !== null
    ? Math.max(activationThreshold - balance, 10_000)
    : 0;

  // ─── Render helpers ───────────────────────────────────────────────────────

  const renderBalance = () => (
    <Card
      elevation={0}
      sx={{
        background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 60%, #3b82f6 100%)',
        color: '#fff',
        borderRadius: 4,
        mb: 3,
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
          <AccountBalanceWalletRounded sx={{ fontSize: 28, opacity: 0.9 }} />
          <Typography variant="subtitle1" sx={{ opacity: 0.85, fontWeight: 600 }}>
            Số dư ví
          </Typography>
        </Stack>

        {balanceLoading ? (
          <Skeleton variant="text" width={180} height={52} sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} />
        ) : balanceError ? (
          <Typography color="error.light">{balanceError}</Typography>
        ) : (
          <Typography variant="h4" fontWeight={800} letterSpacing={-0.5}>
            {formatCurrency(balance ?? 0)}
          </Typography>
        )}

        {balance !== null && balance < 0 && (
          <Chip
            label={`Nợ platform: ${formatCurrency(Math.abs(balance))}`}
            color="error"
            size="small"
            sx={{ mt: 1, fontWeight: 700, bgcolor: 'rgba(239,68,68,0.25)', border: '1px solid rgba(239,68,68,0.4)' }}
          />
        )}

        {walletState?.canAcceptRide === false && walletState?.activationRequired !== true && balance !== null && (
          <Alert
            severity="error"
            sx={{
              mt: 1.5,
              bgcolor: 'rgba(239,68,68,0.15)',
              color: '#fca5a5',
              border: '1px solid rgba(239,68,68,0.3)',
              '& .MuiAlert-icon': { color: '#f87171' },
            }}
          >
            Số dư đã chạm mốc khóa {formatCurrency(debtLimit)}. Bạn tạm thời không thể nhận cuốc mới.
          </Alert>
        )}

        <Stack direction="row" spacing={1.5} mt={2.5}>
          <Button
            variant="contained"
            startIcon={<AddRounded />}
            onClick={() => { setTopUpOpen(true); setTopUpError(''); setTopUpAmount(''); }}
            sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
              color: '#fff',
              fontWeight: 700,
              borderRadius: 3,
              flex: 1,
            }}
          >
            Nạp tiền
          </Button>
          <Button
            variant="contained"
            startIcon={<ArrowUpwardRounded />}
            onClick={() => { setWithdrawOpen(true); setWithdrawError(''); setWithdrawAmount(''); setWithdrawStep(0); setWithdrawBankName(''); setWithdrawAccountNumber(''); setWithdrawAccountHolder(''); }}
            disabled={!balance || balance < MIN_WITHDRAW}
            sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
              color: '#fff',
              fontWeight: 700,
              borderRadius: 3,
              flex: 1,
            }}
          >
            Rút tiền
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );

  const renderTxList = () => (
    <Box>
      {txLoading && transactions.length === 0 ? (
        <Stack spacing={1.5}>
          {[1, 2, 3, 4].map((k) => (
            <Skeleton key={k} variant="rounded" height={68} />
          ))}
        </Stack>
      ) : transactions.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{ p: 4, textAlign: 'center', borderRadius: 3, mt: 1 }}
        >
          <InfoOutlined sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">Chưa có giao dịch nào</Typography>
        </Paper>
      ) : (
        <Stack spacing={1.2}>
          {transactions.map((tx) => {
            const meta = TX_TYPE_META[tx.type];
            const isCredit = meta.sign === '+';
            return (
              <Card key={tx.id} variant="outlined" sx={{ borderRadius: 3 }}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Box
                        sx={{
                          width: 38,
                          height: 38,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: isCredit ? 'success.50' : 'error.50',
                          color: isCredit ? 'success.main' : 'error.main',
                        }}
                      >
                        {isCredit ? (
                          <ArrowDownwardRounded fontSize="small" />
                        ) : (
                          <ArrowUpwardRounded fontSize="small" />
                        )}
                      </Box>
                      <Box>
                        <Stack direction="row" alignItems="center" spacing={0.75}>
                          <Typography variant="body2" fontWeight={700}>
                            {tx.description || meta.label}
                          </Typography>
                          <Chip
                            label={meta.label}
                            color={meta.color}
                            size="small"
                            sx={{ height: 16, fontSize: '0.62rem', px: 0.5 }}
                          />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(tx.createdAt)}
                          {tx.rideId && ` • Cuốc ${tx.rideId.slice(-6)}`}
                        </Typography>
                      </Box>
                    </Stack>
                    <Box textAlign="right">
                      <Typography
                        variant="subtitle2"
                        fontWeight={800}
                        color={isCredit ? 'success.main' : 'error.main'}
                      >
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

          {transactions.length < txTotal && (
            <Button
              variant="outlined"
              fullWidth
              onClick={() => loadTransactions(txOffset + TX_PAGE, true)}
              disabled={txLoading}
              sx={{ mt: 1, borderRadius: 3 }}
            >
              {txLoading ? <CircularProgress size={20} /> : 'Tải thêm'}
            </Button>
          )}
        </Stack>
      )}
    </Box>
  );

  const renderIncentive = () => {
    if (incentiveLoading) {
      return (
        <Stack spacing={1.5}>
          {[1, 2, 3].map((k) => <Skeleton key={k} variant="rounded" height={72} />)}
        </Stack>
      );
    }

    return (
      <Stack spacing={2}>
        {/* Today summary */}
        {todayStats && (
          <Card
            variant="outlined"
            sx={{ borderRadius: 3, bgcolor: 'success.50', borderColor: 'success.200' }}
          >
            <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="subtitle2" fontWeight={700} color="success.dark" gutterBottom>
                Hôm nay
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <Box>
                  <Typography variant="caption" color="text.secondary">Số cuốc</Typography>
                  <Typography fontWeight={700}>{todayStats.tripsCompleted}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Quãng đường</Typography>
                  <Typography fontWeight={700}>{todayStats.distanceKm.toFixed(1)} km</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Cuốc cao điểm</Typography>
                  <Typography fontWeight={700}>{todayStats.peakTrips}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Thưởng nhận</Typography>
                  <Typography fontWeight={700} color="success.dark">
                    {formatCurrency(todayStats.bonusAwarded)}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        )}

        <Typography variant="subtitle1" fontWeight={700}>
          Quy tắc thưởng hiện hành
        </Typography>

        {rules.length === 0 ? (
          <Typography color="text.secondary">Chưa có quy tắc thưởng nào.</Typography>
        ) : (
          rules.filter((r) => r.isActive).map((rule) => {
            // Progress for today
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
                progressLabel = `${todayStats.peakTrips} cuốc giờ cao điểm`;
                progress = Math.min(100, todayStats.peakTrips * 10);
              }
            }

            return (
              <Card key={rule.id} variant="outlined" sx={{ borderRadius: 3 }}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'warning.50',
                        color: 'warning.dark',
                        flexShrink: 0,
                      }}
                    >
                      {RULE_ICONS[rule.type]}
                    </Box>
                    <Box flex={1} minWidth={0}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography variant="body2" fontWeight={700}>
                            {rule.description || RULE_TYPE_LABELS[rule.type]}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {rule.type === 'PEAK_HOUR'
                              ? 'Mỗi cuốc trong giờ cao điểm (6–9h, 16–19h)'
                              : rule.type === 'TRIP_COUNT'
                              ? `Đạt ≥ ${rule.conditionValue} cuốc/ngày`
                              : `Đạt ≥ ${rule.conditionValue} km/ngày`}
                          </Typography>
                        </Box>
                        <Chip
                          icon={<EmojiEventsRounded fontSize="small" />}
                          label={`+${formatCurrency(rule.rewardAmount)}`}
                          color="warning"
                          size="small"
                          sx={{ fontWeight: 800, ml: 1 }}
                        />
                      </Stack>

                      {progressLabel && rule.type !== 'PEAK_HOUR' && (
                        <Box mt={1}>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="caption" color="text.secondary">
                              {progressLabel}
                            </Typography>
                            {progress >= 100 && (
                              <Chip
                                icon={<CheckCircleRounded />}
                                label="Đã đạt"
                                color="success"
                                size="small"
                                sx={{ height: 18, fontSize: '0.62rem' }}
                              />
                            )}
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={progress}
                            color={progress >= 100 ? 'success' : 'warning'}
                            sx={{ height: 6, borderRadius: 3, mt: 0.5 }}
                          />
                        </Box>
                      )}

                      {rule.type === 'PEAK_HOUR' && progressLabel && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          {progressLabel} hôm nay
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            );
          })
        )}
      </Stack>
    );
  };

  return (
    <Box
      sx={{
        pt: 1.5,
        pb: 1.5,
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      {/* Balance card */}
      {renderBalance()}

      {/* Activation banner — shown when balance has never exceeded 300k (new driver) */}
      {walletState?.activationRequired && balance !== null && (
        <Alert
          severity="info"
          icon={<AccountBalanceWalletRounded />}
          action={
            <Button
              color="inherit"
              size="small"
              sx={{ fontWeight: 700 }}
              onClick={() => {
                setTopUpOpen(true);
                setTopUpError('');
                setTopUpAmount(String(activationTopUpNeeded));
              }}
            >
              Nạp ngay
            </Button>
          }
          sx={{ mb: 2, borderRadius: 2 }}
        >
          <strong>Kích hoạt tài khoản tài xế:</strong> Nạp thêm tối thiểu <strong>{formatCurrency(activationTopUpNeeded)}</strong> vào ví
          để đạt ngưỡng <strong>{formatCurrency(activationThreshold)}</strong> trước khi bật nhận cuốc. Số dư hiện tại: {formatCurrency(balance)}.
        </Alert>
      )}

      {/* Withdraw success */}
      {withdrawSuccess && (
        <Alert
          severity="success"
          onClose={() => setWithdrawSuccess('')}
          sx={{ mb: 2, borderRadius: 2 }}
        >
          {withdrawSuccess}
        </Alert>
      )}

      {/* Top-up success */}
      {topUpSuccess && (
        <Alert
          severity="success"
          onClose={() => setTopUpSuccess('')}
          sx={{ mb: 2, borderRadius: 2 }}
        >
          {topUpSuccess}
        </Alert>
      )}

      {/* Negative balance warning */}
      {walletState?.warningThresholdReached && walletState?.canAcceptRide !== false && balance !== null && (
        <Alert
          severity="warning"
          icon={<WarningAmberRounded />}
          sx={{ mb: 2, borderRadius: 2 }}
        >
          Số dư ví đã âm quá {formatCurrency(Math.abs(warningThreshold))} ({formatCurrency(balance)}). Tài khoản vẫn hoạt động nhưng bạn nên nạp thêm trước khi chạm mốc khóa {formatCurrency(debtLimit)}.
        </Alert>
      )}

      {walletState?.canAcceptRide === false && walletState?.activationRequired !== true && balance !== null && (
        <Alert
          severity="error"
          icon={<WarningAmberRounded />}
          sx={{ mb: 2, borderRadius: 2 }}
        >
          Số dư ví đã xuống {formatCurrency(balance)} và tài khoản đang bị chặn nhận cuốc mới. Hãy nạp thêm tiền để mở lại.
        </Alert>
      )}

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_e, v) => setTab(v)}
        variant="fullWidth"
        sx={{ mb: 2, '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' } }}
      >
        <Tab label="Giao dịch" />
        <Tab label="Thưởng" />
      </Tabs>

      {tab === 0 && renderTxList()}
      {tab === 1 && renderIncentive()}

      {/* Withdraw Dialog — Bank info + Pending/Success flow */}
      <Dialog
        open={withdrawOpen}
        onClose={closeWithdrawDialog}
        PaperProps={{ sx: { borderRadius: 4, mx: 2, width: '100%', maxWidth: 480 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountBalanceRounded /> Rút tiền về ngân hàng
        </DialogTitle>
        <DialogContent>
          {/* Stepper */}
          <Stepper activeStep={withdrawStep} sx={{ mb: 2.5, mt: 0.5 }}>
            <Step completed={withdrawStep > 0}><StepLabel>Nhập thông tin</StepLabel></Step>
            <Step completed={withdrawStep > 1}><StepLabel>Đang xử lý</StepLabel></Step>
            <Step completed={withdrawStep > 1}><StepLabel>Hoàn tất</StepLabel></Step>
          </Stepper>

          {/* Step 0: Form */}
          {withdrawStep === 0 && (
            <Stack spacing={2}>
              <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: 'grey.50' }}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Số dư khả dụng
                      </Typography>
                      <Typography fontWeight={800} variant="h6" color="primary">
                        {formatCurrency(balance ?? 0)}
                      </Typography>
                    </Box>
                    <Chip label="Chỉ hỗ trợ ngân hàng đã cấu hình" sx={{ borderRadius: 999, fontWeight: 700, bgcolor: '#eff6ff', color: '#1d4ed8' }} />
                  </Stack>
                </CardContent>
              </Card>

              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>
                  Chọn nhanh số tiền
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {[50_000, 100_000, 200_000, 500_000].map((preset) => (
                    <Chip
                      key={preset}
                      label={formatCurrency(preset)}
                      onClick={() => setWithdrawAmount(String(preset))}
                      color={digitsOnly(withdrawAmount) === String(preset) ? 'primary' : 'default'}
                      variant={digitsOnly(withdrawAmount) === String(preset) ? 'filled' : 'outlined'}
                      sx={{ fontWeight: 700 }}
                    />
                  ))}
                </Stack>
              </Box>

              <TextField
                label="Số tiền rút (VND)"
                type="text"
                fullWidth
                value={formatMoneyInput(withdrawAmount)}
                onChange={(e) => setWithdrawAmount(digitsOnly(e.target.value))}
                inputProps={{ inputMode: 'numeric' }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button
                        size="small"
                        onClick={() => setWithdrawAmount(String(balance ?? 0))}
                        sx={{ fontWeight: 700 }}
                      >
                        Tất cả
                      </Button>
                    </InputAdornment>
                  ),
                }}
                helperText={`Tối thiểu ${formatCurrency(MIN_WITHDRAW)}`}
              />

              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>
                  Ngân hàng nhận tiền
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1.25 }}>
                  {BANK_OPTIONS.map((bank) => {
                    const selected = withdrawBankName === bank.name;

                    return (
                      <Card
                        key={bank.name}
                        variant="outlined"
                        onClick={() => setWithdrawBankName(bank.name)}
                        sx={{
                          cursor: 'pointer',
                          borderRadius: 3,
                          border: '2px solid',
                          borderColor: selected ? bank.accent : 'rgba(148,163,184,0.22)',
                          bgcolor: selected ? `${bank.accent}10` : '#fff',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <CardContent sx={{ p: 1.4, '&:last-child': { pb: 1.4 } }}>
                          <Stack spacing={1} alignItems="center" textAlign="center">
                            <Box
                              sx={{
                                width: 40,
                                height: 40,
                                borderRadius: '50%',
                                display: 'grid',
                                placeItems: 'center',
                                bgcolor: bank.accent,
                                color: '#fff',
                                fontWeight: 800,
                                fontSize: '0.8rem',
                              }}
                            >
                              {bank.short}
                            </Box>
                            <Box>
                              <Typography variant="body2" fontWeight={700}>{bank.name}</Typography>
                              <Typography variant="caption" color="text.secondary">{bank.helper}</Typography>
                            </Box>
                          </Stack>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Box>
              </Box>

              <TextField
                label="Số tài khoản"
                fullWidth
                value={formatDigitGroups(withdrawAccountNumber)}
                onChange={(e) => setWithdrawAccountNumber(digitsOnly(e.target.value))}
                inputProps={{ maxLength: 24, inputMode: 'numeric' }}
                helperText={selectedWithdrawBank ? `${selectedWithdrawBank.name}: ${selectedWithdrawBank.helper}` : 'Chỉ nhập chữ số, không dấu cách'}
              />

              <TextField
                label="Tên chủ tài khoản"
                fullWidth
                value={withdrawAccountHolder}
                onChange={(e) => setWithdrawAccountHolder(e.target.value.toUpperCase())}
                helperText="Dùng đúng tên trên tài khoản ngân hàng"
              />

              <Card variant="outlined" sx={{ borderRadius: 3, bgcolor: '#f8fafc' }}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
                    Xem trước giao dịch
                  </Typography>
                  <Stack spacing={0.85} sx={{ mt: 1 }}>
                    <Stack direction="row" justifyContent="space-between" spacing={2}>
                      <Typography variant="body2" color="text.secondary">Ngân hàng</Typography>
                      <Typography variant="body2" fontWeight={700}>{withdrawBankName || 'Chưa chọn'}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" spacing={2}>
                      <Typography variant="body2" color="text.secondary">Số tài khoản</Typography>
                      <Typography variant="body2" fontWeight={700}>{formatDigitGroups(withdrawAccountNumber) || 'Chưa nhập'}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" spacing={2}>
                      <Typography variant="body2" color="text.secondary">Chủ tài khoản</Typography>
                      <Typography variant="body2" fontWeight={700}>{withdrawAccountHolder || 'Chưa nhập'}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" spacing={2}>
                      <Typography variant="body2" color="text.secondary">Số tiền nhận</Typography>
                      <Typography variant="body2" fontWeight={800} color="primary">{formatCurrency(Number(digitsOnly(withdrawAmount)) || 0)}</Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              {withdrawError && <Alert severity="error">{withdrawError}</Alert>}
            </Stack>
          )}

          {/* Step 1: Pending */}
          {withdrawStep === 1 && (
            <Stack spacing={3} alignItems="center" sx={{ py: 4 }}>
              <HourglassTopRounded sx={{ fontSize: 64, color: 'warning.main', animation: 'spin 2s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />
              <Typography variant="h6" fontWeight={700} color="warning.main">
                Đang xử lý rút tiền...
              </Typography>
              <Card variant="outlined" sx={{ borderRadius: 2, width: '100%' }}>
                <CardContent>
                  <Stack spacing={0.5}>
                    <Typography variant="body2">Mã giao dịch: <strong>{withdrawalId}</strong></Typography>
                    <Typography variant="body2">Số tiền: <strong>{formatCurrency(Number(digitsOnly(withdrawAmount)) || 0)}</strong></Typography>
                    <Typography variant="body2">Ngân hàng: <strong>{withdrawBankName}</strong></Typography>
                    <Typography variant="body2">STK: <strong>****{digitsOnly(withdrawAccountNumber).slice(-4)}</strong></Typography>
                    <Typography variant="body2">Chủ TK: <strong>{withdrawAccountHolder.toUpperCase()}</strong></Typography>
                  </Stack>
                </CardContent>
              </Card>
              <LinearProgress sx={{ width: '100%', borderRadius: 3 }} />
            </Stack>
          )}

          {/* Step 2: Success */}
          {withdrawStep === 2 && (
            <Stack spacing={3} alignItems="center" sx={{ py: 4 }}>
              <CheckCircleRounded sx={{ fontSize: 64, color: 'success.main' }} />
              <Typography variant="h6" fontWeight={700} color="success.main">
                Rút tiền thành công!
              </Typography>
              <Card variant="outlined" sx={{ borderRadius: 2, width: '100%', bgcolor: 'success.50' }}>
                <CardContent>
                  <Stack spacing={0.5}>
                    <Typography variant="body2">Mã giao dịch: <strong>{withdrawalId}</strong></Typography>
                    <Typography variant="body2">Số tiền: <strong>{formatCurrency(Number(digitsOnly(withdrawAmount)) || 0)}</strong></Typography>
                    <Typography variant="body2">Ngân hàng: <strong>{withdrawBankName}</strong></Typography>
                    <Typography variant="body2">STK: <strong>****{digitsOnly(withdrawAccountNumber).slice(-4)}</strong></Typography>
                    <Typography variant="body2">Số dư còn lại: <strong>{formatCurrency(balance ?? 0)}</strong></Typography>
                  </Stack>
                </CardContent>
              </Card>

            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          {withdrawStep === 0 && (
            <>
              <Button
                variant="outlined"
                onClick={closeWithdrawDialog}
                disabled={withdrawLoading}
                sx={{ borderRadius: 3, flex: 1 }}
              >
                Huỷ
              </Button>
              <Button
                variant="contained"
                onClick={handleWithdraw}
                disabled={withdrawLoading}
                sx={{ borderRadius: 3, fontWeight: 700, flex: 1 }}
              >
                {withdrawLoading ? <CircularProgress size={20} /> : 'Xác nhận rút'}
              </Button>
            </>
          )}
          {withdrawStep === 1 && (
            <Typography variant="caption" color="text.secondary" sx={{ mx: 'auto' }}>
              Đang chờ xử lý...
            </Typography>
          )}
          {withdrawStep === 2 && (
            <Button
              variant="contained"
              fullWidth
              onClick={closeWithdrawDialog}
              sx={{ borderRadius: 3, fontWeight: 700 }}
            >
              Đóng
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Top-up Dialog — MoMo / VNPay gateway */}
      <Dialog
        open={topUpOpen}
        onClose={() => !topUpLoading && (setTopUpOpen(false), setTopUpProvider(null), setTopUpAmount(''), setTopUpError(''))}
        PaperProps={{ sx: { borderRadius: 4, mx: 2, width: '100%', maxWidth: 420 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Nạp tiền ví</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: 'grey.50' }}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">Số dư hiện tại</Typography>
                <Typography fontWeight={800} variant="h6" color="primary">
                  {formatCurrency(balance ?? 0)}
                </Typography>
              </CardContent>
            </Card>

            {/* Quick-select amounts */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>
                Chọn nhanh
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {[50_000, 100_000, 200_000, 500_000].map((preset) => (
                  <Chip
                    key={preset}
                    label={formatCurrency(preset)}
                    onClick={() => setTopUpAmount(String(preset))}
                    color={topUpAmount === String(preset) ? 'primary' : 'default'}
                    variant={topUpAmount === String(preset) ? 'filled' : 'outlined'}
                    sx={{ fontWeight: 700 }}
                  />
                ))}
              </Stack>
            </Box>

            <TextField
              label="Số tiền nạp (VND)"
              type="number"
              fullWidth
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              inputProps={{ min: 10000, step: 10000 }}
              helperText="Tối thiểu 10.000 VND"
              error={!!topUpError && !topUpProvider}
            />

            {/* Payment method */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>
                Phương thức thanh toán
              </Typography>
              <Stack direction="row" spacing={1.5}>
                <Card
                  variant="outlined"
                  onClick={() => setTopUpProvider('MOMO')}
                  sx={{
                    flex: 1,
                    borderRadius: 3,
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: topUpProvider === 'MOMO' ? '#ae2070' : 'divider',
                    bgcolor: topUpProvider === 'MOMO' ? '#fdf0f5' : 'background.paper',
                    textAlign: 'center',
                    py: 1.5,
                    transition: 'all 0.15s',
                  }}
                >
                  <Typography fontWeight={800} sx={{ color: '#ae2070', fontSize: '0.9rem' }}>MoMo</Typography>
                  <Typography variant="caption" color="text.secondary">Ví MoMo</Typography>
                </Card>
                <Card
                  variant="outlined"
                  onClick={() => setTopUpProvider('VNPAY')}
                  sx={{
                    flex: 1,
                    borderRadius: 3,
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: topUpProvider === 'VNPAY' ? '#0066cc' : 'divider',
                    bgcolor: topUpProvider === 'VNPAY' ? '#f0f5ff' : 'background.paper',
                    textAlign: 'center',
                    py: 1.5,
                    transition: 'all 0.15s',
                  }}
                >
                  <Typography fontWeight={800} sx={{ color: '#0066cc', fontSize: '0.9rem' }}>VNPay</Typography>
                  <Typography variant="caption" color="text.secondary">ATM / QR</Typography>
                </Card>
              </Stack>
            </Box>

            {topUpError && <Alert severity="error">{topUpError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => { setTopUpOpen(false); setTopUpProvider(null); setTopUpAmount(''); setTopUpError(''); }}
            disabled={topUpLoading}
            sx={{ borderRadius: 3, flex: 1 }}
          >
            Huỷ
          </Button>
          <Button
            variant="contained"
            onClick={handleTopUp}
            disabled={topUpLoading || !topUpProvider}
            sx={{ borderRadius: 3, fontWeight: 700, flex: 2,
              bgcolor: topUpProvider === 'MOMO' ? '#ae2070' : topUpProvider === 'VNPAY' ? '#0066cc' : undefined,
              '&:hover': { bgcolor: topUpProvider === 'MOMO' ? '#8c1858' : topUpProvider === 'VNPAY' ? '#0055aa' : undefined },
            }}
          >
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
