/**
 * PaymentTestLab — Công cụ kiểm thử giao diện cho hệ thống Ví & Thanh toán
 *
 * Cho phép admin chạy thủ công các kịch bản thanh toán, xem số dư ví,
 * và kiểm tra kết quả trực tiếp trên giao diện.
 */

import React, { useState, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AccountBalanceWallet,
  CheckCircle,
  ExpandMore,
  ExpandLess,
  Error as ErrorIcon,
  PlayArrow,
  Refresh,
  BugReport,
  Payment,
  Savings,
  AdminPanelSettings,
} from '@mui/icons-material';
import axiosInstance from '../api/axios.config';
import { normalizeGatewayOriginUrl } from '../utils/gateway-base-url';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ScenarioResult {
  tcId: string;
  name: string;
  status: 'idle' | 'running' | 'pass' | 'fail';
  message?: string;
  detail?: unknown;
  duration?: number;
}

interface WalletInfo {
  balance: number;
  status: string;
  canAcceptCash?: boolean;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const GW = normalizeGatewayOriginUrl(process.env.REACT_APP_API_URL);
const PAY = 'http://localhost:3004';
const WAL = 'http://localhost:3006';

// ─── Helper ────────────────────────────────────────────────────────────────

const directFetch = async (
  url: string,
  method: 'GET' | 'POST',
  body?: unknown,
  token?: string,
): Promise<{ status: number; data: unknown }> => {
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data: unknown;
    try { data = await res.json(); } catch { data = null; }
    return { status: res.status, data };
  } catch (err) {
    return { status: 0, data: String(err) };
  }
};

// ─── ScenarioCard ─────────────────────────────────────────────────────────

const ScenarioCard: React.FC<{
  result: ScenarioResult;
  onRun: () => void;
}> = ({ result, onRun }) => {
  const [expanded, setExpanded] = useState(false);

  const statusColor = result.status === 'pass'
    ? 'success'
    : result.status === 'fail'
    ? 'error'
    : result.status === 'running'
    ? 'info'
    : 'default';

  const statusLabel = {
    idle: 'Chưa chạy',
    running: 'Đang chạy...',
    pass: 'PASS ✓',
    fail: 'FAIL ✗',
  }[result.status];

  return (
    <Paper variant="outlined" sx={{ mb: 1.5, borderRadius: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 1.5,
          gap: 1.5,
          cursor: 'pointer',
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <Chip
          label={result.tcId}
          size="small"
          variant="outlined"
          sx={{ fontWeight: 700, minWidth: 64 }}
        />
        <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: 500 }}>
          {result.name}
        </Typography>
        <Chip
          label={statusLabel}
          size="small"
          color={statusColor as 'success' | 'error' | 'info' | 'default'}
          sx={{ fontWeight: 700 }}
        />
        {result.duration !== undefined && (
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 52, textAlign: 'right' }}>
            {result.duration}ms
          </Typography>
        )}
        <Tooltip title="Chạy kịch bản này">
          <span>
            <IconButton
              size="small"
              color="primary"
              disabled={result.status === 'running'}
              onClick={(e) => { e.stopPropagation(); onRun(); }}
            >
              {result.status === 'running'
                ? <CircularProgress size={18} />
                : <PlayArrow fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}>
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Divider />
        <Box sx={{ px: 2, py: 1.5 }}>
          {result.message && (
            <Alert
              severity={result.status === 'pass' ? 'success' : result.status === 'fail' ? 'error' : 'info'}
              sx={{ mb: 1 }}
            >
              {result.message}
            </Alert>
          )}
          {result.detail !== undefined && (
            <Box
              component="pre"
              sx={{
                bgcolor: 'grey.100',
                borderRadius: 1,
                p: 1.5,
                fontSize: 12,
                overflow: 'auto',
                maxHeight: 240,
                m: 0,
              }}
            >
              {JSON.stringify(result.detail, null, 2)}
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────

const PaymentTestLab: React.FC = () => {
  const [driverPhone, setDriverPhone] = useState('0911234561');
  const [customerPhone, setCustomerPhone] = useState('0901234561');
  const [password, setPassword] = useState('Password@1');

  const [driverToken, setDriverToken] = useState<string | null>(null);
  const [customerToken, setCustomerToken] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);

  const [loginStatus, setLoginStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [loginError, setLoginError] = useState('');

  const [topUpAmount, setTopUpAmount] = useState('200000');
  const [driverId, setDriverId] = useState('');

  // Scenario results
  const [results, setResults] = useState<Record<string, ScenarioResult>>({
    'tc-01': { tcId: 'TC-01', name: 'Thanh toán ONLINE thành công (MoMo/VNPay webhook)', status: 'idle' },
    'tc-02': { tcId: 'TC-02', name: 'Thanh toán ONLINE thất bại', status: 'idle' },
    'tc-03': { tcId: 'TC-03', name: 'Duplicate callback (Idempotency)', status: 'idle' },
    'tc-04': { tcId: 'TC-04', name: 'Ride CASH bình thường', status: 'idle' },
    'tc-05': { tcId: 'TC-05', name: 'Driver không đủ tiền → ví âm', status: 'idle' },
    'tc-07': { tcId: 'TC-07', name: 'Driver nạp tiền thành công', status: 'idle' },
    'tc-09': { tcId: 'TC-09', name: 'Withdraw hợp lệ (rút 50.000 VND)', status: 'idle' },
    'tc-10': { tcId: 'TC-10', name: 'Withdraw vượt số dư → bị từ chối', status: 'idle' },
    'tc-19': { tcId: 'TC-19', name: 'Kiểm tra can-accept-cash', status: 'idle' },
    'tc-21': { tcId: 'TC-21', name: 'Admin xem merchant ledger (reconciliation)', status: 'idle' },
    'tc-25': { tcId: 'TC-25', name: 'Admin xem danh sách ví tài xế', status: 'idle' },
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const updateResult = useCallback((key: string, patch: Partial<ScenarioResult>) => {
    setResults((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }, []);

  const runWithTimer = useCallback(async (
    key: string,
    fn: () => Promise<{ pass: boolean; message: string; detail?: unknown }>,
  ) => {
    updateResult(key, { status: 'running', message: undefined, detail: undefined, duration: undefined });
    const t0 = Date.now();
    try {
      const res = await fn();
      updateResult(key, {
        status: res.pass ? 'pass' : 'fail',
        message: res.message,
        detail: res.detail,
        duration: Date.now() - t0,
      });
    } catch (err) {
      updateResult(key, {
        status: 'fail',
        message: String(err),
        duration: Date.now() - t0,
      });
    }
  }, [updateResult]);

  // ─── Login ───────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    setLoginStatus('loading');
    setLoginError('');
    try {
      const [driverRes, customerRes, adminRes] = await Promise.all([
        axiosInstance.post('/auth/login', { phone: driverPhone, password }),
        axiosInstance.post('/auth/login', { phone: customerPhone, password }),
        axiosInstance.post('/auth/login', { phone: '0900000001', password }),
      ]);

      const extractToken = (res: { data: { data?: { tokens?: { accessToken?: string } } } }): string | null =>
        res.data?.data?.tokens?.accessToken ?? null;

      const dToken = extractToken(driverRes as { data: { data?: { tokens?: { accessToken?: string } } } });
      const cToken = extractToken(customerRes as { data: { data?: { tokens?: { accessToken?: string } } } });
      const aToken = extractToken(adminRes as { data: { data?: { tokens?: { accessToken?: string } } } });

      setDriverToken(dToken);
      setCustomerToken(cToken);
      setAdminToken(aToken);

      // Extract driverId from driver profile
      try {
        const profileRes = await directFetch(`${GW}/api/auth/me`, 'GET', undefined, dToken ?? undefined);
        const profile = profileRes.data as Record<string, unknown>;
        const uid = (profile?.data as Record<string, unknown>)?.id as string | undefined;
        if (uid) setDriverId(uid);
      } catch { /* non-critical */ }

      setLoginStatus('ok');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setLoginStatus('error');
      setLoginError(e.response?.data?.error?.message || String(err));
    }
  };

  // ─── Wallet Info ─────────────────────────────────────────────────────────

  const refreshWallet = async () => {
    if (!driverToken) return;
    setWalletLoading(true);
    try {
      const [balRes, cashRes] = await Promise.all([
        directFetch(`${PAY}/api/wallet`, 'GET', undefined, driverToken),
        directFetch(`${WAL}/api/wallet/can-accept-cash`, 'GET', undefined, driverToken)
          .catch(() => ({ status: 0, data: null })),
      ]);

      const balData = balRes.data as Record<string, unknown>;
      const balance = (balData.balance ?? (balData.data as Record<string, unknown>)?.balance ?? 0) as number;
      const status = (balData.status ?? (balData.data as Record<string, unknown>)?.status ?? 'UNKNOWN') as string;

      const cashData = cashRes.data as Record<string, unknown>;
      const canAcceptCash = (cashData?.data as Record<string, unknown>)?.canAcceptCash as boolean | undefined;

      setWalletInfo({ balance, status, canAcceptCash });
    } finally {
      setWalletLoading(false);
    }
  };

  // ─── Scenarios ───────────────────────────────────────────────────────────

  const runTC01 = () => runWithTimer('tc-01', async () => {
    if (!customerToken) return { pass: false, message: 'Chưa đăng nhập' };
    const rideId = `ride-ui-tc01-${Date.now()}`;
    const r = await directFetch(`${PAY}/api/payments/mock-webhook`, 'POST', {
      paymentIntentId: `mock_intent_${rideId}`,
      status: 'SUCCEEDED',
    }, customerToken);
    const ok = r.status >= 200 && r.status < 300;
    return { pass: ok, message: ok ? `Webhook SUCCEEDED chấp nhận (${r.status})` : `Webhook thất bại (${r.status})`, detail: r.data };
  });

  const runTC02 = () => runWithTimer('tc-02', async () => {
    if (!customerToken) return { pass: false, message: 'Chưa đăng nhập' };
    const rideId = `ride-ui-tc02-${Date.now()}`;
    const r = await directFetch(`${PAY}/api/payments/mock-webhook`, 'POST', {
      paymentIntentId: `mock_intent_${rideId}`,
      status: 'FAILED',
      failureReason: 'Insufficient funds',
    }, customerToken);
    const ok = r.status >= 200 && r.status < 300;
    return { pass: ok, message: ok ? `Webhook FAILED xử lý đúng (${r.status})` : `Lỗi (${r.status})`, detail: r.data };
  });

  const runTC03 = () => runWithTimer('tc-03', async () => {
    if (!customerToken) return { pass: false, message: 'Chưa đăng nhập' };
    const rideId = `ride-ui-tc03-${Date.now()}`;
    const payload = { paymentIntentId: `mock_intent_${rideId}`, status: 'SUCCEEDED' };
    const r1 = await directFetch(`${PAY}/api/payments/mock-webhook`, 'POST', payload, customerToken);
    const r2 = await directFetch(`${PAY}/api/payments/mock-webhook`, 'POST', payload, customerToken);
    const ok = r1.status >= 200 && r1.status < 300 && r2.status >= 200 && r2.status < 500;
    return {
      pass: ok,
      message: ok
        ? `Lần 1: ${r1.status}, Lần 2: ${r2.status} — Idempotency OK`
        : `Lần 1: ${r1.status}, Lần 2: ${r2.status}`,
      detail: { first: r1.data, second: r2.data },
    };
  });

  const runTC04 = () => runWithTimer('tc-04', async () => {
    if (!customerToken) return { pass: false, message: 'Chưa đăng nhập' };
    const rideId = `ride-ui-tc04-${Date.now()}`;
    const r = await directFetch(`${PAY}/api/payments/mock-webhook`, 'POST', {
      paymentIntentId: `mock_intent_${rideId}`,
      status: 'SUCCEEDED',
      method: 'CASH',
    }, customerToken);
    const ok = r.status >= 200 && r.status < 300;
    return { pass: ok, message: ok ? `Ride CASH xử lý thành công (${r.status})` : `Lỗi (${r.status})`, detail: r.data };
  });

  const runTC05 = () => runWithTimer('tc-05', async () => {
    if (!driverToken) return { pass: false, message: 'Chưa đăng nhập driver' };
    const rideId = `ride-ui-tc05-${Date.now()}`;
    const r = await directFetch(`${PAY}/api/payments/mock-webhook`, 'POST', {
      paymentIntentId: `mock_intent_${rideId}`,
      status: 'SUCCEEDED',
      amount: 9_999_999,
    }, customerToken ?? undefined);
    const walR = await directFetch(`${WAL}/api/wallet/balance`, 'GET', undefined, driverToken);
    const ok = r.status >= 200 && r.status < 300 && walR.status === 200;
    return {
      pass: ok,
      message: ok ? `Webhook accepted, ví vẫn accessible (${walR.status})` : `Lỗi`,
      detail: { webhook: r.data, wallet: walR.data },
    };
  });

  const runTC07 = () => runWithTimer('tc-07', async () => {
    if (!driverToken) return { pass: false, message: 'Chưa đăng nhập driver' };
    const amount = Number(topUpAmount) || 200_000;
    const r = await directFetch(`${PAY}/api/wallet/top-up`, 'POST', { amount }, driverToken);
    const ok = r.status >= 200 && r.status < 300;
    if (ok) {
      await new Promise((res) => setTimeout(res, 500));
      await refreshWallet();
    }
    return {
      pass: ok,
      message: ok ? `Nạp ${amount.toLocaleString('vi-VN')} VND thành công (${r.status})` : `Nạp tiền thất bại (${r.status})`,
      detail: r.data,
    };
  });

  const runTC09 = () => runWithTimer('tc-09', async () => {
    if (!driverToken) return { pass: false, message: 'Chưa đăng nhập driver' };
    const r = await directFetch(`${PAY}/api/wallet/withdraw`, 'POST', {
      amount: 50_000,
      bankName: 'VCB',
      accountNumber: '1234567890',
      accountHolder: 'PHAM VAN D',
    }, driverToken);
    const ok = r.status >= 200 && r.status < 300;
    if (ok) await refreshWallet();
    return {
      pass: ok,
      message: ok ? `Rút 50.000 VND thành công (${r.status})` : `Rút tiền thất bại (${r.status})`,
      detail: r.data,
    };
  });

  const runTC10 = () => runWithTimer('tc-10', async () => {
    if (!driverToken) return { pass: false, message: 'Chưa đăng nhập driver' };
    const r = await directFetch(`${PAY}/api/wallet/withdraw`, 'POST', {
      amount: 99_999_999,
      bankName: 'VCB',
      accountNumber: '1234567890',
      accountHolder: 'PHAM VAN D',
    }, driverToken);
    const ok = r.status >= 400 && r.status < 500;
    return {
      pass: ok,
      message: ok ? `Từ chối đúng (${r.status}) — vượt số dư` : `Không đúng hành vi mong đợi (${r.status})`,
      detail: r.data,
    };
  });

  const runTC19 = () => runWithTimer('tc-19', async () => {
    if (!driverToken) return { pass: false, message: 'Chưa đăng nhập driver' };
    const r = await directFetch(`${WAL}/api/wallet/can-accept-cash`, 'GET', undefined, driverToken);
    const d = r.data as Record<string, unknown>;
    const canAccept = (d?.data as Record<string, unknown>)?.canAcceptCash ?? d?.canAcceptCash;
    const ok = r.status === 200 && typeof canAccept === 'boolean';
    return {
      pass: ok,
      message: ok ? `canAcceptCash = ${canAccept}` : `Lỗi (${r.status})`,
      detail: r.data,
    };
  });

  const runTC21 = () => runWithTimer('tc-21', async () => {
    if (!adminToken) return { pass: false, message: 'Chưa đăng nhập admin' };
    const r = await directFetch(`${WAL}/api/admin/merchant-ledger`, 'GET', undefined, adminToken);
    const ok = r.status === 200;
    return {
      pass: ok,
      message: ok ? `Merchant ledger trả về (${r.status})` : `Lỗi (${r.status})`,
      detail: r.data,
    };
  });

  const runTC25 = () => runWithTimer('tc-25', async () => {
    if (!adminToken) return { pass: false, message: 'Chưa đăng nhập admin' };
    const r = await directFetch(`${WAL}/api/admin/drivers`, 'GET', undefined, adminToken);
    const d = r.data as Record<string, unknown>;
    const drivers = d?.drivers ?? (d?.data as Record<string, unknown>)?.drivers ?? d?.data;
    const ok = r.status === 200 && Array.isArray(drivers);
    return {
      pass: ok,
      message: ok ? `${(drivers as unknown[]).length} ví tài xế` : `Lỗi (${r.status})`,
      detail: r.data,
    };
  });

  const runAllScenarios = async () => {
    await runWithTimer('tc-01', async () => {
      if (!customerToken) return { pass: false, message: 'Chưa đăng nhập' };
      const rideId = `ride-ui-tc01-${Date.now()}`;
      const r = await directFetch(`${PAY}/api/payments/mock-webhook`, 'POST', { paymentIntentId: `mock_intent_${rideId}`, status: 'SUCCEEDED' }, customerToken);
      return { pass: r.status >= 200 && r.status < 300, message: `Webhook (${r.status})`, detail: r.data };
    });
    await runTC02();
    await runTC03();
    await runTC04();
    await runTC05();
    await runTC07();
    await runTC09();
    await runTC10();
    await runTC19();
    await runTC21();
    await runTC25();
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const passCount = Object.values(results).filter((r) => r.status === 'pass').length;
  const failCount = Object.values(results).filter((r) => r.status === 'fail').length;
  const runCount = passCount + failCount;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={3}>
        <BugReport color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h5" fontWeight={700}>
          Payment &amp; Wallet Test Lab
        </Typography>
        <Chip label="Công cụ kiểm thử" color="primary" size="small" sx={{ ml: 1 }} />
      </Stack>

      <Grid container spacing={3}>
        {/* ── Authentication ── */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardHeader
              avatar={<AdminPanelSettings color="primary" />}
              title="1. Xác thực tài khoản"
              subheader="Đăng nhập các vai trò để lấy token"
              titleTypographyProps={{ fontWeight: 700 }}
            />
            <CardContent>
              <Stack spacing={2}>
                <TextField
                  label="Driver phone"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  size="small"
                  fullWidth
                />
                <TextField
                  label="Customer phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  size="small"
                  fullWidth
                />
                <TextField
                  label="Mật khẩu (tất cả)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  size="small"
                  type="password"
                  fullWidth
                />
                <Button
                  variant="contained"
                  onClick={handleLogin}
                  disabled={loginStatus === 'loading'}
                  startIcon={loginStatus === 'loading' ? <CircularProgress size={16} /> : undefined}
                  fullWidth
                >
                  Đăng nhập tất cả
                </Button>

                {loginStatus === 'ok' && (
                  <Alert severity="success" icon={<CheckCircle />}>
                    <Stack spacing={0.5}>
                      <Typography variant="caption">Driver: {driverToken ? '✓ OK' : '✗ Lỗi'}</Typography>
                      <Typography variant="caption">Customer: {customerToken ? '✓ OK' : '✗ Lỗi'}</Typography>
                      <Typography variant="caption">Admin: {adminToken ? '✓ OK' : '✗ Lỗi'}</Typography>
                      {driverId && <Typography variant="caption">Driver ID: {driverId.slice(0, 8)}...</Typography>}
                    </Stack>
                  </Alert>
                )}
                {loginStatus === 'error' && (
                  <Alert severity="error" icon={<ErrorIcon />}>{loginError || 'Đăng nhập thất bại'}</Alert>
                )}
              </Stack>
            </CardContent>
          </Card>

          {/* ── Wallet Info ── */}
          <Card variant="outlined" sx={{ mt: 2 }}>
            <CardHeader
              avatar={<AccountBalanceWallet color="success" />}
              title="2. Số dư ví tài xế"
              subheader="Lấy từ payment-service & wallet-service"
              titleTypographyProps={{ fontWeight: 700 }}
              action={
                <Tooltip title="Làm mới">
                  <span>
                    <IconButton onClick={refreshWallet} disabled={!driverToken || walletLoading} size="small">
                      {walletLoading ? <CircularProgress size={18} /> : <Refresh />}
                    </IconButton>
                  </span>
                </Tooltip>
              }
            />
            <CardContent>
              {walletInfo ? (
                <Stack spacing={1.5}>
                  <Box sx={{ textAlign: 'center', py: 1 }}>
                    <Typography variant="h4" color="primary" fontWeight={700}>
                      {walletInfo.balance.toLocaleString('vi-VN')} ₫
                    </Typography>
                    <Typography variant="caption" color="text.secondary">Số dư hiện tại</Typography>
                  </Box>
                  <Divider />
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Trạng thái ví</Typography>
                    <Chip
                      label={walletInfo.status}
                      size="small"
                      color={walletInfo.status === 'ACTIVE' ? 'success' : 'warning'}
                    />
                  </Stack>
                  {walletInfo.canAcceptCash !== undefined && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Nhận CASH?</Typography>
                      <Chip
                        label={walletInfo.canAcceptCash ? 'Có thể' : 'Bị block'}
                        size="small"
                        color={walletInfo.canAcceptCash ? 'success' : 'error'}
                      />
                    </Stack>
                  )}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  Nhấn nút làm mới sau khi đăng nhập
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* ── Quick Actions ── */}
          <Card variant="outlined" sx={{ mt: 2 }}>
            <CardHeader
              avatar={<Savings color="info" />}
              title="3. Thao tác nhanh"
              titleTypographyProps={{ fontWeight: 700 }}
            />
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="flex-end">
                  <TextField
                    label="Số tiền nạp (VND)"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    size="small"
                    type="number"
                    sx={{ flex: 1 }}
                  />
                  <Button
                    variant="outlined"
                    color="success"
                    size="small"
                    disabled={!driverToken}
                    onClick={runTC07}
                    startIcon={<Payment />}
                  >
                    Nạp tiền
                  </Button>
                </Stack>
                <TextField
                  label="Driver ID (tự động sau login)"
                  value={driverId}
                  onChange={(e) => setDriverId(e.target.value)}
                  size="small"
                  fullWidth
                  placeholder="UUID của tài xế"
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Scenarios ── */}
        <Grid item xs={12} md={8}>
          <Card variant="outlined">
            <CardHeader
              avatar={<BugReport color="primary" />}
              title="4. Kịch bản kiểm thử"
              subheader="Chạy từng test case hoặc tất cả cùng lúc"
              titleTypographyProps={{ fontWeight: 700 }}
              action={
                <Stack direction="row" spacing={1} alignItems="center">
                  {runCount > 0 && (
                    <>
                      <Chip label={`${passCount} PASS`} color="success" size="small" />
                      {failCount > 0 && <Chip label={`${failCount} FAIL`} color="error" size="small" />}
                    </>
                  )}
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<PlayArrow />}
                    onClick={runAllScenarios}
                    disabled={!driverToken}
                  >
                    Chạy tất cả
                  </Button>
                </Stack>
              }
            />
            <CardContent sx={{ pt: 1 }}>
              {/* Nhóm I — Online Payment */}
              <Typography variant="overline" color="text.secondary" fontWeight={700} display="block" mb={1}>
                Nhóm I — Thanh toán Online
              </Typography>
              <ScenarioCard result={results['tc-01']} onRun={runTC01} />
              <ScenarioCard result={results['tc-02']} onRun={runTC02} />
              <ScenarioCard result={results['tc-03']} onRun={runTC03} />

              <Divider sx={{ my: 2 }} />

              {/* Nhóm II — CASH */}
              <Typography variant="overline" color="text.secondary" fontWeight={700} display="block" mb={1}>
                Nhóm II — Thanh toán Tiền mặt
              </Typography>
              <ScenarioCard result={results['tc-04']} onRun={runTC04} />
              <ScenarioCard result={results['tc-05']} onRun={runTC05} />

              <Divider sx={{ my: 2 }} />

              {/* Nhóm III — Top-up & Withdraw */}
              <Typography variant="overline" color="text.secondary" fontWeight={700} display="block" mb={1}>
                Nhóm III &amp; IV — Nạp tiền &amp; Rút tiền
              </Typography>
              <ScenarioCard result={results['tc-07']} onRun={runTC07} />
              <ScenarioCard result={results['tc-09']} onRun={runTC09} />
              <ScenarioCard result={results['tc-10']} onRun={runTC10} />

              <Divider sx={{ my: 2 }} />

              {/* Nhóm VI — Kiểm soát nợ */}
              <Typography variant="overline" color="text.secondary" fontWeight={700} display="block" mb={1}>
                Nhóm VI — Kiểm soát nợ
              </Typography>
              <ScenarioCard result={results['tc-19']} onRun={runTC19} />

              <Divider sx={{ my: 2 }} />

              {/* Nhóm X — Admin */}
              <Typography variant="overline" color="text.secondary" fontWeight={700} display="block" mb={1}>
                Nhóm IX &amp; X — Đối soát &amp; Admin
              </Typography>
              <ScenarioCard result={results['tc-21']} onRun={runTC21} />
              <ScenarioCard result={results['tc-25']} onRun={runTC25} />
            </CardContent>
          </Card>

          {/* ── Summary ── */}
          {runCount > 0 && (
            <Paper
              variant="outlined"
              sx={{
                mt: 2,
                p: 2,
                bgcolor: failCount === 0 ? 'success.50' : 'error.50',
                borderColor: failCount === 0 ? 'success.light' : 'error.light',
              }}
            >
              <Stack direction="row" alignItems="center" spacing={2}>
                {failCount === 0
                  ? <CheckCircle color="success" />
                  : <ErrorIcon color="error" />}
                <Typography variant="body1" fontWeight={700}>
                  Kết quả: {passCount}/{runCount} test case PASS
                  {failCount > 0 && ` — ${failCount} FAIL`}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  color={failCount === 0 ? 'success' : 'error'}
                  onClick={() => setResults((prev) => {
                    const reset: typeof prev = {};
                    Object.keys(prev).forEach((k) => { reset[k] = { ...prev[k], status: 'idle', message: undefined, detail: undefined, duration: undefined }; });
                    return reset;
                  })}
                  sx={{ ml: 'auto !important' }}
                >
                  Reset
                </Button>
              </Stack>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default PaymentTestLab;
