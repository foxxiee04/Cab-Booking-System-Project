/**
 * Khi đặt `REACT_APP_PAYMENT_INTERNAL_FALLBACK=false`, app không dùng trang mock
 * `/payment/sandbox-gateway` — chỉ mở link MoMo/VNPay do payment-service trả về.
 *
 * Cần payment-service: `MOMO_ENABLED=true` / `VNPAY_ENABLED=true` và khóa sandbox hợp lệ.
 */
export const allowPaymentInternalFallback =
  process.env.REACT_APP_PAYMENT_INTERNAL_FALLBACK !== 'false';
