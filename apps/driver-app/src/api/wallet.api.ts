import axios from 'axios';
import axiosInstance, { API_BASE_URL } from './axios.config';

export interface WalletBalance {
  driverId: string;
  balance: number;
  operationalBalance?: number;
  availableBalance: number;
  pendingBalance: number;       // online earnings held T+24h before becoming withdrawable
  lockedBalance: number;        // security deposit (ký quỹ), cannot be withdrawn
  withdrawableBalance: number;  // what driver can actually withdraw right now
  debt: number;
  status: 'INACTIVE' | 'ACTIVE' | 'BLOCKED';
  initialActivationCompleted?: boolean;
  activationRequired?: boolean;
  warningThresholdReached?: boolean;
  hasOverdueDebt?: boolean;
  canAcceptRide?: boolean;
  activationThreshold?: number;
  warningThreshold?: number;
  debtLimit?: number;
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

export interface DebtRecord {
  id: string;
  amount: number;
  remaining: number;
  rideId: string | null;
  status: 'ACTIVE' | 'OVERDUE' | 'SETTLED';
  dueDate: string;
  settledAt: string | null;
  createdAt: string;
}

export interface WalletTransaction {
  id: string;
  driverId: string;
  type: 'EARN' | 'COMMISSION' | 'WITHDRAW' | 'REFUND' | 'TOP_UP' | string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  rideId: string | null;
  createdAt: string;
}

export interface WalletTransactionsResponse {
  transactions: WalletTransaction[];
  total: number;
  limit: number;
  offset: number;
}

export interface WithdrawalResult {
  newBalance: number;
  withdrawalId: string;
  status: 'PENDING' | 'SUCCESS';
  bankInfo?: { bankName: string; accountNumber: string; accountHolder: string };
}

export interface WalletDeactivateResult {
  refundedAmount: number;
  depositRefunded: number;
  availableRefunded: number;
  debtSettled: number;
  status: 'INACTIVE';
}

export interface TopUpInitResult {
  topUpId: string;
  orderId: string;
  payUrl: string;
}

export interface TopUpStatusResult {
  topUpId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  amount: number;
  provider: 'MOMO' | 'VNPAY';
  createdAt: string;
  completedAt: string | null;
}

export interface TopUpGatewayReturnResponse {
  success: boolean;
  data: {
    topUpId?: string;
    paid?: boolean;
    status?: 'PENDING' | 'COMPLETED' | 'FAILED';
    amount?: number;
    provider?: 'MOMO' | 'VNPAY';
    newBalance?: number;
    activated?: boolean;
    initialActivationCompleted?: boolean;
    warningThresholdReached?: boolean;
    transactionId?: string;
    responseCode?: string;
    resultCode?: number;
    message?: string;
  };
}

export const walletApi = {
  getBalance: () =>
    axiosInstance.get<{ success: boolean; data: WalletBalance }>('/wallet/balance'),

  getTransactions: (limit = 20, offset = 0) => {
    const page = Math.floor(offset / Math.max(1, limit)) + 1;
    return axiosInstance.get<{ success: boolean; data: WalletTransactionsResponse }>(
      `/wallet/transactions?limit=${limit}&page=${page}`,
    );
  },

  withdraw: (amount: number, bankInfo?: { bankName: string; accountNumber: string; accountHolder: string }) =>
    axiosInstance.post<{ success: boolean; data: WithdrawalResult }>('/wallet/withdraw', { amount, bankInfo }),

  deactivate: () =>
    axiosInstance.post<{ success: boolean; data: WalletDeactivateResult }>('/wallet/deactivate'),

  /** Legacy simulated top-up (kept for fallback if gateways not configured). */
  topUp: (amount: number) =>
    axiosInstance.post<{ success: boolean; data: { newBalance: number } }>('/wallet/top-up', { amount }),

  /**
   * Initiate a real MoMo or VNPay top-up.
   * Returns a payUrl — the driver app should redirect to it.
   */
  initTopUp: (amount: number, provider: 'MOMO' | 'VNPAY', returnUrl: string) =>
    axiosInstance.post<{ success: boolean; data: TopUpInitResult }>('/wallet/top-up/init', {
      amount,
      provider,
      returnUrl,
    }),

  /** Poll the status of a wallet top-up after returning from the gateway. */
  getTopUpStatus: (topUpId: string) =>
    axiosInstance.get<{ success: boolean; data: TopUpStatusResult }>(
      `/wallet/top-up/status/${topUpId}`,
    ),

  confirmMomoReturn: async (searchParams: URLSearchParams): Promise<TopUpGatewayReturnResponse> => {
    const response = await axios.get(`${API_BASE_URL}/wallet/top-up/momo/return?${searchParams.toString()}`);
    return response.data;
  },

  confirmVnpayReturn: async (searchParams: URLSearchParams): Promise<TopUpGatewayReturnResponse> => {
    const response = await axios.get(`${API_BASE_URL}/wallet/top-up/vnpay/return?${searchParams.toString()}`);
    return response.data;
  },

  canAcceptCash: (commission: number) =>
    axiosInstance.get<{ success: boolean; data: { allowed: boolean; balance: number } }>(
      `/wallet/can-accept-cash?commission=${commission}`,
    ),

  getDebtRecords: () =>
    axiosInstance.get<{ success: boolean; data: DebtRecord[] }>('/wallet/debt-records'),
};
