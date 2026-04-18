import axiosInstance from './axios.config';

export type VoucherDiscountType = 'PERCENT' | 'FIXED';
export type VoucherAudience = 'ALL_CUSTOMERS' | 'NEW_CUSTOMERS' | 'RETURNING_CUSTOMERS';
export type MyVoucherStatus = 'USABLE' | 'USED_UP' | 'EXPIRED';

/** Shape returned by GET /voucher/my — flat joined structure */
export interface MyVoucher {
  voucherId: string;
  code: string;
  description: string | null;
  audienceType: VoucherAudience;
  discountType: VoucherDiscountType;
  discountValue: number;
  maxDiscount: number | null;
  minFare: number;
  endTime: string | null;
  usedCount: number;
  perUserLimit: number;
  status: MyVoucherStatus;
}

/** Shape returned by GET /voucher/public */
export interface PublicVoucher {
  voucherId: string;
  code: string;
  description: string | null;
  audienceType: VoucherAudience;
  discountType: VoucherDiscountType;
  discountValue: number;
  maxDiscount: number | null;
  minFare: number;
  startTime: string;
  endTime: string;
  usageLimit: number | null;
  perUserLimit: number;
  collected: boolean; // true if logged-in user already saved it
}

export interface ApplyVoucherResult {
  voucherId: string;
  code: string;
  discountAmount: number;
  finalAmount: number;
  originalAmount: number;
}

const voucherApi = {
  /** List all active public vouchers (annotated with `collected` if authenticated) */
  getPublicVouchers: () =>
    axiosInstance.get<{ success: boolean; data: PublicVoucher[] }>('/voucher/public'),

  /** Save a voucher by code to the current user's collection */
  collectVoucher: (code: string) =>
    axiosInstance.post<{ success: boolean; data: MyVoucher }>('/voucher/collect', { code }),

  /** List all vouchers the current user has collected */
  getMyVouchers: () =>
    axiosInstance.get<{ success: boolean; data: MyVoucher[] }>('/voucher/my'),

  /** Calculate discount for a fare — does NOT mark as used */
  applyVoucher: (code: string, fare: number) =>
    axiosInstance.post<{ success: boolean; data: ApplyVoucherResult }>('/voucher/apply', {
      code,
      fare,
    }),
};

export default voucherApi;
