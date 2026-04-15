import axiosInstance from './axios.config';

export interface WalletBalance {
  driverId: string;
  balance: number;
}

export interface WalletTransaction {
  id: string;
  driverId: string;
  type: 'EARN' | 'COMMISSION' | 'BONUS' | 'WITHDRAW' | 'REFUND' | 'TOP_UP';
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

export interface IncentiveRule {
  id: string;
  type: 'TRIP_COUNT' | 'DISTANCE_KM' | 'PEAK_HOUR';
  conditionValue: number;
  rewardAmount: number;
  isActive: boolean;
  description: string | null;
}

export interface DailyStats {
  date: string;
  tripsCompleted: number;
  distanceKm: number;
  peakTrips: number;
  bonusAwarded: number;
}

export interface WithdrawalResult {
  newBalance: number;
  withdrawalId: string;
  status: 'PENDING' | 'SUCCESS';
  bankInfo?: { bankName: string; accountNumber: string; accountHolder: string };
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

export const walletApi = {
  getBalance: () =>
    axiosInstance.get<{ success: boolean; data: WalletBalance }>('/wallet'),

  getTransactions: (limit = 20, offset = 0) =>
    axiosInstance.get<{ success: boolean; data: WalletTransactionsResponse }>(
      `/wallet/transactions?limit=${limit}&offset=${offset}`,
    ),

  withdraw: (amount: number, bankInfo?: { bankName: string; accountNumber: string; accountHolder: string }) =>
    axiosInstance.post<{ success: boolean; data: WithdrawalResult }>('/wallet/withdraw', { amount, bankInfo }),

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

  canAcceptCash: (commission: number) =>
    axiosInstance.get<{ success: boolean; data: { allowed: boolean; balance: number } }>(
      `/wallet/can-accept-cash?commission=${commission}`,
    ),

  getDailyStats: (days = 7) =>
    axiosInstance.get<{ success: boolean; data: DailyStats[] }>(`/wallet/daily-stats?days=${days}`),

  getIncentiveRules: () =>
    axiosInstance.get<{ success: boolean; data: IncentiveRule[] }>('/wallet/admin/rules'),
};
