/**
 * ============================================================
 * CabBooking System — Master E2E Test Case Specification
 * ============================================================
 *
 * Runner: VS Code integrated browser (Playwright tools)
 * Command to run all: tell GitHub Copilot "chạy test"
 *
 * URLs:
 *   Customer app : http://localhost:4000
 *   Driver app   : http://localhost:4001
 *   Admin app    : http://localhost:4002
 *   API Gateway  : http://localhost:3000
 *
 * ============================================================
 * ACCOUNTS (all passwords: Password@1)
 * ============================================================
 * Admin    : 0900000001
 *
 * Customers (Bến Thành cluster):
 *   C1 - Nguyen Van A  : 0901234561
 *   C2 - Tran Thi B    : 0901234562
 *   C3 - Le Van C      : 0901234563
 *
 * Customers (Tân Sơn Nhất cluster):
 *   C4 - Pham Minh D   : 0901234564
 *   C5 - Hoang Van E   : 0901234565
 *
 * Drivers ONLINE (Bến Thành cluster, Ô tô 4 chỗ):
 *   D1 - Pham Van D    : 0911234561  (Toyota Vios,   rating 1.0)
 *   D2 - Vo Thi E      : 0911234562  (Honda City,    rating 2.0)
 *   D3 - Pham Van M    : 0911234568  (Hyundai Accent,rating 3.0)
 *
 * Drivers PENDING (not yet approved):
 *   D38 - Seed38       : 0919100027
 *   D39 - Seed39       : 0919100028
 *   D40 - Seed40       : 0919100029
 * ============================================================
 */

// ---------------------------------------------------------------------------
// TYPE DEFINITIONS
// ---------------------------------------------------------------------------
export interface Step {
  action: string;
  selector?: string;
  value?: string;
  expect?: string;
  screenshot?: string;
  note?: string;
}

export interface TestCase {
  id: string;
  suite: string;
  title: string;
  app: 'customer' | 'driver' | 'admin' | 'api';
  url: string;
  accounts: string[];
  priority: 'P0' | 'P1' | 'P2';
  steps: Step[];
  expectedResult: string;
  tags: string[];
}

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------
const URL = {
  customer: 'http://localhost:4000',
  driver:   'http://localhost:4001',
  admin:    'http://localhost:4002',
  api:      'http://localhost:3000',
};

// ---------------------------------------------------------------------------
// SUITE 1 — AUTHENTICATION
// ---------------------------------------------------------------------------
const SUITE_AUTH: TestCase[] = [
  {
    id: 'TC-AUTH-01',
    suite: '1. Authentication',
    title: 'Customer login bằng số điện thoại + mật khẩu',
    app: 'customer',
    url: URL.customer + '/login',
    accounts: ['0901234561 / Password@1'],
    priority: 'P0',
    steps: [
      { action: 'navigate', value: URL.customer + '/login' },
      { action: 'screenshot', screenshot: 'login-page' },
      { action: 'fill', selector: 'input[type="tel"]', value: '0901234561', expect: 'Nhập số điện thoại' },
      { action: 'fill', selector: 'input[type="password"]', value: 'Password@1', expect: 'Nhập mật khẩu' },
      { action: 'click', selector: 'button[type="submit"]', expect: 'Nhấn đăng nhập' },
      { action: 'wait', value: '2000' },
      { action: 'screenshot', screenshot: 'after-customer-login' },
      { action: 'assert-url', value: '/home', expect: 'Redirect sang /home sau login thành công' },
      { action: 'assert-visible', selector: '[data-testid="map"]', expect: 'Bản đồ hiển thị' },
    ],
    expectedResult: 'Đăng nhập thành công, redirect sang HomeMap, bản đồ hiển thị',
    tags: ['auth', 'customer', 'P0'],
  },

  {
    id: 'TC-AUTH-02',
    suite: '1. Authentication',
    title: 'Driver login',
    app: 'driver',
    url: URL.driver + '/login',
    accounts: ['0911234561 / Password@1'],
    priority: 'P0',
    steps: [
      { action: 'navigate', value: URL.driver + '/login' },
      { action: 'screenshot', screenshot: 'driver-login-page' },
      { action: 'fill', selector: 'input[type="tel"]', value: '0911234561', expect: 'Nhập SĐT' },
      { action: 'fill', selector: 'input[type="password"]', value: 'Password@1' },
      { action: 'click', selector: 'button[type="submit"]' },
      { action: 'wait', value: '2000' },
      { action: 'screenshot', screenshot: 'driver-dashboard' },
      { action: 'assert-url', value: '/dashboard', expect: 'Redirect sang dashboard tài xế' },
    ],
    expectedResult: 'Driver đăng nhập thành công, hiển thị dashboard với toggle online/offline',
    tags: ['auth', 'driver', 'P0'],
  },

  {
    id: 'TC-AUTH-03',
    suite: '1. Authentication',
    title: 'Admin login',
    app: 'admin',
    url: URL.admin,
    accounts: ['admin@cabbooking.com / Password@1 — SĐT: 0900000001'],
    priority: 'P0',
    steps: [
      { action: 'navigate', value: URL.admin },
      { action: 'screenshot', screenshot: 'admin-login-page' },
      { action: 'fill', selector: 'input[type="text"],input[type="email"]', value: 'admin@cabbooking.com' },
      { action: 'fill', selector: 'input[type="password"]', value: 'Password@1' },
      { action: 'click', selector: 'button[type="submit"]' },
      { action: 'wait', value: '2000' },
      { action: 'screenshot', screenshot: 'admin-dashboard' },
      { action: 'assert-text', value: 'Dashboard', expect: 'Tiêu đề Dashboard hiển thị' },
    ],
    expectedResult: 'Admin đăng nhập thành công, hiển thị dashboard với số liệu tổng quan',
    tags: ['auth', 'admin', 'P0'],
  },

  {
    id: 'TC-AUTH-04',
    suite: '1. Authentication',
    title: 'Login sai mật khẩu — phải báo lỗi',
    app: 'customer',
    url: URL.customer + '/login',
    accounts: ['0901234561 / WrongPass123'],
    priority: 'P1',
    steps: [
      { action: 'navigate', value: URL.customer + '/login' },
      { action: 'fill', selector: 'input[type="tel"]', value: '0901234561' },
      { action: 'fill', selector: 'input[type="password"]', value: 'WrongPass123' },
      { action: 'click', selector: 'button[type="submit"]' },
      { action: 'wait', value: '1500' },
      { action: 'screenshot', screenshot: 'login-error' },
      { action: 'assert-visible', selector: '[role="alert"]', expect: 'Thông báo lỗi xuất hiện' },
    ],
    expectedResult: 'Hiển thị thông báo lỗi, không redirect',
    tags: ['auth', 'negative', 'P1'],
  },
];

// ---------------------------------------------------------------------------
// SUITE 2 — CUSTOMER BOOKING FLOWS
// ---------------------------------------------------------------------------
const SUITE_BOOKING: TestCase[] = [
  {
    id: 'TC-BOOK-01',
    suite: '2. Booking',
    title: 'Đặt xe máy — thanh toán tiền mặt (Bến Thành → Quận 3)',
    app: 'customer',
    url: URL.customer + '/home',
    accounts: ['0901234561 / Password@1'],
    priority: 'P0',
    steps: [
      { action: 'navigate', value: URL.customer + '/home' },
      { action: 'screenshot', screenshot: 'home-map' },
      { action: 'click', selector: '[placeholder*="điểm đón"], [placeholder*="pickup"], input:first-of-type', expect: 'Click ô nhập điểm đón' },
      { action: 'fill', selector: '[placeholder*="điểm đón"], [placeholder*="pickup"], input:first-of-type', value: 'Chợ Bến Thành' },
      { action: 'wait', value: '1500' },
      { action: 'click', selector: '[role="option"]:first-child, .suggestion:first-child', expect: 'Chọn gợi ý đầu tiên' },
      { action: 'click', selector: '[placeholder*="điểm đến"], [placeholder*="dropoff"]', expect: 'Click ô nhập điểm đến' },
      { action: 'fill', selector: '[placeholder*="điểm đến"], [placeholder*="dropoff"]', value: 'Nhà thờ Đức Bà' },
      { action: 'wait', value: '1500' },
      { action: 'click', selector: '[role="option"]:first-child, .suggestion:first-child' },
      { action: 'wait', value: '2000' },
      { action: 'screenshot', screenshot: 'route-selected' },
      { action: 'click', selector: '[data-vehicle="MOTORBIKE"], button:has-text("Xe máy"), [class*="motorbike"]', expect: 'Chọn loại xe: Xe máy' },
      { action: 'assert-visible', selector: '[class*="price"], [class*="fare"]', expect: 'Giá ước tính hiển thị' },
      { action: 'screenshot', screenshot: 'vehicle-selected-motorbike' },
      { action: 'click', selector: '[value="CASH"], button:has-text("Tiền mặt"), [class*="cash"]', expect: 'Chọn thanh toán: Tiền mặt' },
      { action: 'click', selector: 'button:has-text("Đặt xe"), button[type="submit"]:last-of-type', expect: 'Nhấn đặt xe' },
      { action: 'wait', value: '3000' },
      { action: 'screenshot', screenshot: 'ride-requested-motorbike-cash' },
      { action: 'assert-text', value: 'Đang tìm tài xế', expect: 'Màn hình chờ tài xế' },
    ],
    expectedResult: 'Hiển thị "Đang tìm tài xế", hệ thống dispatch tới tài xế gần nhất trong vòng bán kính 2km',
    tags: ['booking', 'cash', 'motorbike', 'P0'],
  },

  {
    id: 'TC-BOOK-02',
    suite: '2. Booking',
    title: 'Đặt ô tô 4 chỗ — thanh toán tiền mặt',
    app: 'customer',
    url: URL.customer + '/home',
    accounts: ['0901234562 / Password@1'],
    priority: 'P0',
    steps: [
      { action: 'navigate', value: URL.customer + '/home' },
      { action: 'note', note: 'Nhập điểm đón/đến giống TC-BOOK-01' },
      { action: 'click', selector: '[data-vehicle="CAR_4"], button:has-text("Ô tô 4"), [class*="car4"], [class*="car-4"]', expect: 'Chọn ô tô 4 chỗ' },
      { action: 'screenshot', screenshot: 'vehicle-car4' },
      { action: 'assert-text', value: '8.000đ/km', expect: 'Hiển thị giá/km ô tô 4 chỗ' },
      { action: 'click', selector: 'button:has-text("Đặt xe")' },
      { action: 'wait', value: '3000' },
      { action: 'screenshot', screenshot: 'ride-car4-dispatching' },
    ],
    expectedResult: 'Giá khởi điểm 15.000đ + 8.000đ/km, dispatch thành công',
    tags: ['booking', 'cash', 'car4', 'pricing', 'P0'],
  },

  {
    id: 'TC-BOOK-03',
    suite: '2. Booking',
    title: 'Kiểm tra giá — Ô tô 7 chỗ phải rẻ hơn CAR_4 về commission nhưng giá/km cao hơn',
    app: 'customer',
    url: URL.customer + '/home',
    accounts: ['0901234563 / Password@1'],
    priority: 'P1',
    steps: [
      { action: 'navigate', value: URL.customer + '/home' },
      { action: 'note', note: 'Nhập điểm đón/đến' },
      { action: 'click', selector: '[data-vehicle="CAR_7"], button:has-text("Ô tô 7"), [class*="car7"]', expect: 'Chọn ô tô 7 chỗ' },
      { action: 'screenshot', screenshot: 'vehicle-car7-price' },
      { action: 'assert-text', value: '10.000đ/km', expect: 'Giá/km ô tô 7 chỗ: 10.000đ' },
    ],
    expectedResult: 'Hiển thị giá khởi điểm 20.000đ + 10.000đ/km',
    tags: ['booking', 'pricing', 'car7', 'P1'],
  },

  {
    id: 'TC-BOOK-04',
    suite: '2. Booking',
    title: 'Đặt xe với Voucher',
    app: 'customer',
    url: URL.customer + '/home',
    accounts: ['0901234561 / Password@1'],
    priority: 'P1',
    steps: [
      { action: 'navigate', value: URL.customer + '/vouchers' },
      { action: 'screenshot', screenshot: 'voucher-list' },
      { action: 'assert-visible', selector: '[class*="voucher"]', expect: 'Danh sách voucher hiển thị' },
      { action: 'note', note: 'Ghi lại mã voucher đầu tiên' },
      { action: 'navigate', value: URL.customer + '/home' },
      { action: 'note', note: 'Nhập điểm đón/đến, chọn xe' },
      { action: 'click', selector: 'input[placeholder*="voucher"], [placeholder*="mã giảm"]', expect: 'Click ô nhập voucher' },
      { action: 'fill', selector: 'input[placeholder*="voucher"]', value: 'WELCOME10' },
      { action: 'click', selector: 'button:has-text("Áp dụng")' },
      { action: 'wait', value: '1500' },
      { action: 'screenshot', screenshot: 'voucher-applied' },
      { action: 'assert-text', value: 'Giảm', expect: 'Số tiền giảm hiển thị' },
    ],
    expectedResult: 'Voucher áp dụng thành công, giá hiển thị sau giảm giá',
    tags: ['booking', 'voucher', 'P1'],
  },

  {
    id: 'TC-BOOK-05',
    suite: '2. Booking',
    title: 'Customer hủy chuyến sau khi đặt',
    app: 'customer',
    url: URL.customer + '/home',
    accounts: ['0901234564 / Password@1'],
    priority: 'P1',
    steps: [
      { action: 'navigate', value: URL.customer + '/home' },
      { action: 'note', note: 'Đặt xe, sau đó hủy' },
      { action: 'click', selector: 'button:has-text("Hủy"), button:has-text("Hủy chuyến")', expect: 'Nhấn hủy chuyến' },
      { action: 'wait', value: '1000' },
      { action: 'click', selector: 'button:has-text("Xác nhận"), button:has-text("Đồng ý")', expect: 'Xác nhận hủy' },
      { action: 'wait', value: '2000' },
      { action: 'screenshot', screenshot: 'ride-cancelled' },
    ],
    expectedResult: 'Chuyến bị hủy, trả về màn hình đặt xe',
    tags: ['booking', 'cancel', 'P1'],
  },
];

// ---------------------------------------------------------------------------
// SUITE 3 — PAYMENT METHODS
// ---------------------------------------------------------------------------
const SUITE_PAYMENT: TestCase[] = [
  {
    id: 'TC-PAY-01',
    suite: '3. Payment',
    title: 'Thanh toán bằng Ví CabBooking',
    app: 'customer',
    url: URL.customer + '/home',
    accounts: ['0901234561 / Password@1'],
    priority: 'P0',
    steps: [
      { action: 'navigate', value: URL.customer + '/home' },
      { action: 'note', note: 'Nhập điểm đón/đến, chọn xe' },
      { action: 'click', selector: '[value="WALLET"], button:has-text("Ví"), [class*="wallet"]', expect: 'Chọn thanh toán: Ví' },
      { action: 'assert-visible', selector: '[class*="balance"], [class*="ví"]', expect: 'Số dư ví hiển thị' },
      { action: 'screenshot', screenshot: 'wallet-payment-selected' },
      { action: 'click', selector: 'button:has-text("Đặt xe")' },
      { action: 'wait', value: '2000' },
      { action: 'screenshot', screenshot: 'wallet-payment-dispatching' },
    ],
    expectedResult: 'Đặt xe thành công với ví, số dư ví sẽ bị trừ sau khi hoàn thành chuyến',
    tags: ['payment', 'wallet', 'P0'],
  },

  {
    id: 'TC-PAY-02',
    suite: '3. Payment',
    title: 'Thanh toán MoMo — kiểm tra sandbox gateway',
    app: 'customer',
    url: URL.customer + '/home',
    accounts: ['0901234562 / Password@1'],
    priority: 'P0',
    steps: [
      { action: 'navigate', value: URL.customer + '/home' },
      { action: 'note', note: 'Nhập điểm đón/đến, chọn xe' },
      { action: 'click', selector: '[value="MOMO"], button:has-text("MoMo"), [class*="momo"]', expect: 'Chọn thanh toán: MoMo' },
      { action: 'screenshot', screenshot: 'momo-payment-selected' },
      { action: 'click', selector: 'button:has-text("Đặt xe")' },
      { action: 'wait', value: '2000' },
      { action: 'note', note: 'Sau khi tài xế hoàn thành chuyến, app chuyển sang trang thanh toán MoMo' },
      { action: 'screenshot', screenshot: 'momo-payment-page' },
      { action: 'assert-visible', selector: 'button:has-text("MoMo"), [class*="momo"]', expect: 'Nút thanh toán MoMo' },
      { action: 'click', selector: 'button:has-text("MoMo")' },
      { action: 'wait', value: '2000' },
      { action: 'screenshot', screenshot: 'momo-sandbox-result' },
      { action: 'assert-text', value: 'sandbox', expect: 'Thông báo sandbox' },
    ],
    expectedResult: 'Hiển thị cổng thanh toán MoMo sandbox, thông báo "sandbox: Đang dùng cổng thử nghiệm"',
    tags: ['payment', 'momo', 'sandbox', 'P0'],
  },

  {
    id: 'TC-PAY-03',
    suite: '3. Payment',
    title: 'Thanh toán VNPay — kiểm tra sandbox gateway',
    app: 'customer',
    url: URL.customer + '/home',
    accounts: ['0901234563 / Password@1'],
    priority: 'P0',
    steps: [
      { action: 'navigate', value: URL.customer + '/home' },
      { action: 'note', note: 'Nhập điểm đón/đến, chọn xe' },
      { action: 'click', selector: '[value="VNPAY"], button:has-text("VNPay"), [class*="vnpay"]', expect: 'Chọn thanh toán: VNPay' },
      { action: 'screenshot', screenshot: 'vnpay-payment-selected' },
      { action: 'click', selector: 'button:has-text("Đặt xe")' },
      { action: 'note', note: 'Sau khi hoàn thành chuyến → trang thanh toán VNPay' },
      { action: 'screenshot', screenshot: 'vnpay-payment-page' },
      { action: 'click', selector: 'button:has-text("VNPay")' },
      { action: 'wait', value: '2000' },
      { action: 'screenshot', screenshot: 'vnpay-sandbox-result' },
    ],
    expectedResult: 'Hiển thị cổng thanh toán VNPay sandbox',
    tags: ['payment', 'vnpay', 'sandbox', 'P0'],
  },
];

// ---------------------------------------------------------------------------
// SUITE 4 — WALLET (Customer)
// ---------------------------------------------------------------------------
const SUITE_WALLET: TestCase[] = [
  {
    id: 'TC-WALLET-01',
    suite: '4. Wallet',
    title: 'Xem số dư ví khách hàng',
    app: 'customer',
    url: URL.customer + '/profile',
    accounts: ['0901234561 / Password@1'],
    priority: 'P0',
    steps: [
      { action: 'navigate', value: URL.customer + '/profile' },
      { action: 'screenshot', screenshot: 'customer-profile' },
      { action: 'assert-visible', selector: '[class*="wallet"], [class*="balance"], [class*="ví"]', expect: 'Số dư ví hiển thị' },
      { action: 'screenshot', screenshot: 'wallet-balance' },
    ],
    expectedResult: 'Số dư ví khách hàng hiển thị chính xác (khớp với seed data)',
    tags: ['wallet', 'customer', 'P0'],
  },

  {
    id: 'TC-WALLET-02',
    suite: '4. Wallet',
    title: 'Nạp tiền ví bằng MoMo',
    app: 'customer',
    url: URL.customer + '/profile',
    accounts: ['0901234561 / Password@1'],
    priority: 'P0',
    steps: [
      { action: 'navigate', value: URL.customer + '/profile' },
      { action: 'click', selector: 'button:has-text("Nạp tiền"), button:has-text("Nạp"), [class*="topup"]', expect: 'Click nút nạp tiền' },
      { action: 'screenshot', screenshot: 'topup-options' },
      { action: 'fill', selector: 'input[type="number"], input[placeholder*="số tiền"]', value: '100000' },
      { action: 'click', selector: '[value="MOMO"], button:has-text("MoMo")' },
      { action: 'screenshot', screenshot: 'topup-momo-selected' },
      { action: 'click', selector: 'button:has-text("Nạp tiền"), button:has-text("Xác nhận"), button[type="submit"]' },
      { action: 'wait', value: '2000' },
      { action: 'screenshot', screenshot: 'topup-momo-result' },
      { action: 'assert-visible', selector: '[class*="sandbox"], [class*="mock"], button:has-text("Thanh toán thành công")', expect: 'Sandbox gateway hiển thị' },
      { action: 'click', selector: 'button:has-text("Thanh toán thành công")' },
      { action: 'wait', value: '2000' },
      { action: 'screenshot', screenshot: 'topup-success' },
    ],
    expectedResult: 'Nạp tiền ví thành công, số dư tăng thêm 100.000đ',
    tags: ['wallet', 'topup', 'momo', 'P0'],
  },

  {
    id: 'TC-WALLET-03',
    suite: '4. Wallet',
    title: 'Nạp tiền ví bằng VNPay',
    app: 'customer',
    url: URL.customer + '/profile',
    accounts: ['0901234562 / Password@1'],
    priority: 'P1',
    steps: [
      { action: 'navigate', value: URL.customer + '/profile' },
      { action: 'click', selector: 'button:has-text("Nạp tiền"), button:has-text("Nạp")' },
      { action: 'fill', selector: 'input[type="number"], input[placeholder*="số tiền"]', value: '200000' },
      { action: 'click', selector: '[value="VNPAY"], button:has-text("VNPay")' },
      { action: 'click', selector: 'button:has-text("Nạp tiền"), button:has-text("Xác nhận")' },
      { action: 'wait', value: '2000' },
      { action: 'screenshot', screenshot: 'topup-vnpay-result' },
      { action: 'click', selector: 'button:has-text("Thanh toán thành công")' },
      { action: 'wait', value: '2000' },
      { action: 'screenshot', screenshot: 'topup-vnpay-success' },
    ],
    expectedResult: 'Nạp tiền ví VNPay thành công, số dư tăng thêm 200.000đ',
    tags: ['wallet', 'topup', 'vnpay', 'P1'],
  },

  {
    id: 'TC-WALLET-04',
    suite: '4. Wallet',
    title: 'Xem ví tài xế — số dư và lịch sử thu nhập',
    app: 'driver',
    url: URL.driver,
    accounts: ['0911234561 / Password@1'],
    priority: 'P0',
    steps: [
      { action: 'navigate', value: URL.driver },
      { action: 'note', note: 'Đăng nhập tài xế D1' },
      { action: 'click', selector: '[href*="wallet"], button:has-text("Ví"), [class*="wallet"]', expect: 'Click menu Ví' },
      { action: 'screenshot', screenshot: 'driver-wallet' },
      { action: 'assert-visible', selector: '[class*="balance"]', expect: 'Số dư ví tài xế hiển thị' },
      { action: 'assert-visible', selector: '[class*="transaction"], [class*="history"], [class*="ledger"]', expect: 'Lịch sử giao dịch hiển thị' },
    ],
    expectedResult: 'Hiển thị số dư ví tài xế và lịch sử giao dịch (net earnings sau commission)',
    tags: ['wallet', 'driver', 'earnings', 'P0'],
  },
];

// ---------------------------------------------------------------------------
// SUITE 5 — DRIVER FLOW
// ---------------------------------------------------------------------------
const SUITE_DRIVER: TestCase[] = [
  {
    id: 'TC-DRV-01',
    suite: '5. Driver Flow',
    title: 'Driver bật/tắt trạng thái Online',
    app: 'driver',
    url: URL.driver,
    accounts: ['0911234561 / Password@1'],
    priority: 'P0',
    steps: [
      { action: 'navigate', value: URL.driver },
      { action: 'note', note: 'Đăng nhập tài xế' },
      { action: 'screenshot', screenshot: 'driver-dashboard-initial' },
      { action: 'click', selector: '[class*="toggle"], [role="switch"], button:has-text("Offline"), button:has-text("Trực tuyến")', expect: 'Toggle trạng thái Online' },
      { action: 'wait', value: '1500' },
      { action: 'screenshot', screenshot: 'driver-status-online' },
      { action: 'assert-text', value: 'Online', expect: 'Trạng thái hiển thị Online' },
      { action: 'click', selector: '[class*="toggle"], [role="switch"]', expect: 'Toggle lại sang Offline' },
      { action: 'wait', value: '1500' },
      { action: 'screenshot', screenshot: 'driver-status-offline' },
    ],
    expectedResult: 'Toggle hoạt động đúng, trạng thái cập nhật lên server real-time',
    tags: ['driver', 'status', 'P0'],
  },

  {
    id: 'TC-DRV-02',
    suite: '5. Driver Flow',
    title: 'Driver nhận chuyến từ popup notification',
    app: 'driver',
    url: URL.driver,
    accounts: ['0911234561 / Password@1'],
    priority: 'P0',
    steps: [
      { action: 'navigate', value: URL.driver },
      { action: 'note', note: 'Đảm bảo driver ONLINE và customer đã đặt xe' },
      { action: 'wait', value: '5000', note: 'Chờ popup chuyến đến' },
      { action: 'screenshot', screenshot: 'driver-ride-popup' },
      { action: 'assert-visible', selector: '[class*="popup"], [class*="ride-request"], [class*="notification"]', expect: 'Popup yêu cầu chuyến xuất hiện' },
      { action: 'assert-visible', selector: '[class*="distance"], [class*="fare"]', expect: 'Hiển thị khoảng cách và giá' },
      { action: 'click', selector: 'button:has-text("Nhận chuyến"), button:has-text("Chấp nhận"), button:has-text("Accept")', expect: 'Nhấn nhận chuyến' },
      { action: 'wait', value: '2000' },
      { action: 'screenshot', screenshot: 'driver-accepted-ride' },
      { action: 'assert-text', value: 'Đang đến', expect: 'Trạng thái "Đang đến" điểm đón' },
    ],
    expectedResult: 'Driver nhận chuyến thành công, trạng thái → ACCEPTED, map hiển thị route đến khách',
    tags: ['driver', 'accept', 'dispatch', 'P0'],
  },

  {
    id: 'TC-DRV-03',
    suite: '5. Driver Flow',
    title: 'Driver hoàn thành chuyến — kiểm tra thu nhập',
    app: 'driver',
    url: URL.driver,
    accounts: ['0911234562 / Password@1'],
    priority: 'P0',
    steps: [
      { action: 'note', note: 'Chạy sau TC-DRV-02, khi chuyến đang ở trạng thái IN_PROGRESS' },
      { action: 'click', selector: 'button:has-text("Hoàn thành"), button:has-text("Complete"), button:has-text("Đã đến")', expect: 'Nhấn hoàn thành chuyến' },
      { action: 'wait', value: '3000' },
      { action: 'screenshot', screenshot: 'driver-ride-completed' },
      { action: 'assert-text', value: 'Hoàn thành', expect: 'Trạng thái COMPLETED' },
      { action: 'navigate', value: URL.driver + '/wallet' },
      { action: 'screenshot', screenshot: 'driver-earnings-after-ride' },
      { action: 'assert-visible', selector: '[class*="earnings"], [class*="income"]', expect: 'Thu nhập hiển thị' },
    ],
    expectedResult: 'Thu nhập ròng = grossFare × (1 - commissionRate). CAR_4: 18% commission. Ví tăng đúng số tiền net.',
    tags: ['driver', 'complete', 'earnings', 'commission', 'P0'],
  },

  {
    id: 'TC-DRV-04',
    suite: '5. Driver Flow',
    title: 'Driver từ chối chuyến — hệ thống re-dispatch tài xế khác',
    app: 'driver',
    url: URL.driver,
    accounts: ['0911234561 / Password@1'],
    priority: 'P1',
    steps: [
      { action: 'note', note: 'Customer đặt xe, driver 1 nhận popup' },
      { action: 'wait', value: '5000' },
      { action: 'screenshot', screenshot: 'driver-reject-popup' },
      { action: 'click', selector: 'button:has-text("Từ chối"), button:has-text("Bỏ qua"), button:has-text("Reject")', expect: 'Nhấn từ chối' },
      { action: 'wait', value: '8000', note: 'Hệ thống re-dispatch sang driver 2' },
      { action: 'screenshot', screenshot: 'driver2-receives-ride' },
    ],
    expectedResult: 'Sau khi D1 từ chối, hệ thống dispatch sang D2 trong cùng cluster Bến Thành',
    tags: ['driver', 'reject', 'dispatch', 'P1'],
  },

  {
    id: 'TC-DRV-05',
    suite: '5. Driver Flow',
    title: 'Xem lịch sử chuyến của tài xế',
    app: 'driver',
    url: URL.driver,
    accounts: ['0911234561 / Password@1'],
    priority: 'P1',
    steps: [
      { action: 'navigate', value: URL.driver },
      { action: 'click', selector: '[href*="history"], button:has-text("Lịch sử"), [class*="history"]' },
      { action: 'screenshot', screenshot: 'driver-history' },
      { action: 'assert-visible', selector: '[class*="ride-item"], [class*="trip"]', expect: 'Danh sách chuyến hiển thị' },
    ],
    expectedResult: 'Lịch sử chuyến hiển thị đúng, có trạng thái, giá tiền, thời gian',
    tags: ['driver', 'history', 'P1'],
  },
];

// ---------------------------------------------------------------------------
// SUITE 6 — MULTI-USER SCENARIOS
// ---------------------------------------------------------------------------
const SUITE_MULTIUSER: TestCase[] = [
  {
    id: 'TC-MULTI-01',
    suite: '6. Multi-user',
    title: '2 Customer cùng đặt xe trong cụm Bến Thành (2 tab)',
    app: 'customer',
    url: URL.customer,
    accounts: ['0901234561 / Password@1', '0901234562 / Password@1'],
    priority: 'P1',
    steps: [
      { action: 'note', note: 'Mở 2 tab browser: Tab 1 = Customer 1, Tab 2 = Customer 2' },
      { action: 'note', note: 'Cả 2 cùng đặt xe Ô tô 4 chỗ trong vòng 30 giây' },
      { action: 'note', note: 'Hệ thống phải dispatch 2 tài xế khác nhau' },
      { action: 'screenshot', screenshot: 'multiuser-c1-dispatching' },
      { action: 'screenshot', screenshot: 'multiuser-c2-dispatching' },
      { action: 'assert-text', value: 'Đang tìm tài xế', expect: 'Cả 2 customer đều ở màn chờ' },
    ],
    expectedResult: 'Mỗi customer được gán 1 driver khác nhau. Driver D1 → C1 hoặc C2, Driver D2 → người còn lại.',
    tags: ['multi-user', 'dispatch', 'P1'],
  },

  {
    id: 'TC-MULTI-02',
    suite: '6. Multi-user',
    title: '3 Driver cùng online — chỉ 1 nhận chuyến của 1 customer',
    app: 'driver',
    url: URL.driver,
    accounts: ['0911234561 / Password@1', '0911234562 / Password@1', '0911234568 / Password@1'],
    priority: 'P1',
    steps: [
      { action: 'note', note: 'Mở 3 tab: D1, D2, D3 cùng online trong cụm Bến Thành' },
      { action: 'note', note: 'Customer đặt 1 chuyến CAR_4' },
      { action: 'note', note: 'Hệ thống scoring: distance 40% + rating 25% + idle 15% + acceptance 15% - cancel 5%' },
      { action: 'note', note: 'D3 (rating 3.0) phải được dispatch trước D1 (rating 1.0) và D2 (rating 2.0)' },
      { action: 'wait', value: '5000' },
      { action: 'screenshot', screenshot: 'multi-driver-dispatch-winner' },
    ],
    expectedResult: 'Chỉ 1 driver nhận popup chuyến mỗi lần. Scoring đúng theo thuật toán.',
    tags: ['multi-user', 'driver', 'dispatch', 'scoring', 'P1'],
  },
];

// ---------------------------------------------------------------------------
// SUITE 7 — TRIP CHAT
// ---------------------------------------------------------------------------
const SUITE_CHAT: TestCase[] = [
  {
    id: 'TC-CHAT-01',
    suite: '7. Trip Chat',
    title: 'Customer nhắn tin cho tài xế trong chuyến',
    app: 'customer',
    url: URL.customer,
    accounts: ['0901234561 / Password@1'],
    priority: 'P1',
    steps: [
      { action: 'note', note: 'Đang trong chuyến (trạng thái ACCEPTED hoặc IN_PROGRESS)' },
      { action: 'click', selector: '[class*="chat"], [href*="chat"], button:has-text("Chat"), [class*="message"]', expect: 'Mở chat' },
      { action: 'screenshot', screenshot: 'customer-chat-open' },
      { action: 'fill', selector: 'input[type="text"], textarea', value: 'Bạn đang ở đâu vậy?' },
      { action: 'click', selector: 'button:has-text("Gửi"), button[type="submit"], [class*="send"]' },
      { action: 'wait', value: '1000' },
      { action: 'screenshot', screenshot: 'customer-chat-sent' },
      { action: 'assert-text', value: 'Bạn đang ở đâu vậy?', expect: 'Tin nhắn hiển thị trong chat' },
    ],
    expectedResult: 'Tin nhắn gửi thành công qua Socket.IO, hiển thị ngay cho cả 2 bên',
    tags: ['chat', 'trip', 'customer', 'P1'],
  },

  {
    id: 'TC-CHAT-02',
    suite: '7. Trip Chat',
    title: 'Driver reply — Customer nhận tin nhắn real-time',
    app: 'driver',
    url: URL.driver,
    accounts: ['0911234561 / Password@1'],
    priority: 'P1',
    steps: [
      { action: 'note', note: 'Driver app đang trong chuyến, nhận tin nhắn từ customer' },
      { action: 'screenshot', screenshot: 'driver-chat-notification' },
      { action: 'click', selector: '[class*="chat"], [href*="chat"], button:has-text("Chat")' },
      { action: 'assert-text', value: 'Bạn đang ở đâu vậy?', expect: 'Driver thấy tin nhắn của customer' },
      { action: 'fill', selector: 'input[type="text"], textarea', value: 'Mình đến ngay! 2 phút nữa nhé.' },
      { action: 'click', selector: 'button:has-text("Gửi"), [class*="send"]' },
      { action: 'wait', value: '1000' },
      { action: 'screenshot', screenshot: 'driver-chat-sent' },
    ],
    expectedResult: 'Driver reply thành công, customer nhận ngay (không cần refresh)',
    tags: ['chat', 'trip', 'driver', 'realtime', 'P1'],
  },
];

// ---------------------------------------------------------------------------
// SUITE 8 — AI CHATBOT (RAG)
// ---------------------------------------------------------------------------
const SUITE_AI_CHAT: TestCase[] = [
  {
    id: 'TC-AI-01',
    suite: '8. AI Chatbot',
    title: 'Hỏi giá xe — RAG trả về bảng giá chính xác',
    app: 'customer',
    url: URL.customer + '/home',
    accounts: ['0901234561 / Password@1'],
    priority: 'P0',
    steps: [
      { action: 'navigate', value: URL.customer + '/home' },
      { action: 'click', selector: '[aria-label*="Trợ lý"], button[class*="fab"], [class*="chat-widget"]', expect: 'Mở AI chatbot FAB' },
      { action: 'screenshot', screenshot: 'ai-chat-open' },
      { action: 'assert-text', value: 'Trợ lý CabBooking', expect: 'Header chatbot hiển thị' },
      { action: 'fill', selector: 'textarea, input[placeholder*="câu hỏi"]', value: 'Giá xe ô tô 4 chỗ là bao nhiêu?' },
      { action: 'click', selector: 'button[aria-label*="Gửi"], button:has-text("Gửi"), [class*="send"]' },
      { action: 'wait', value: '3000' },
      { action: 'screenshot', screenshot: 'ai-pricing-answer' },
      { action: 'assert-text', value: '15.000', expect: 'Giá khởi điểm CAR_4: 15.000đ' },
      { action: 'assert-text', value: '8.000', expect: 'Giá/km CAR_4: 8.000đ' },
      { action: 'assert-visible', selector: '[class*="source"], [class*="chip"]', expect: 'Sources hiển thị' },
    ],
    expectedResult: 'RAG trả về giá khởi điểm 15.000đ + 8.000đ/km, sources = "Bảng giá và cách tính cước"',
    tags: ['ai', 'chatbot', 'rag', 'pricing', 'P0'],
  },

  {
    id: 'TC-AI-02',
    suite: '8. AI Chatbot',
    title: 'Hỏi cách đặt xe',
    app: 'customer',
    url: URL.customer + '/home',
    accounts: ['0901234561 / Password@1'],
    priority: 'P0',
    steps: [
      { action: 'click', selector: '[aria-label*="Trợ lý"], [class*="fab"]', expect: 'Mở chatbot' },
      { action: 'fill', selector: 'textarea, input[placeholder*="câu hỏi"]', value: 'Làm sao để đặt xe?' },
      { action: 'click', selector: '[class*="send"], button:has-text("Gửi")' },
      { action: 'wait', value: '3000' },
      { action: 'screenshot', screenshot: 'ai-booking-answer' },
      { action: 'assert-text', value: 'Đặt xe', expect: 'Câu trả lời về đặt xe' },
    ],
    expectedResult: 'Hướng dẫn đặt xe đầy đủ: mở app, nhập điểm đón/đến, chọn xe, chọn thanh toán, xác nhận',
    tags: ['ai', 'chatbot', 'rag', 'booking', 'P0'],
  },

  {
    id: 'TC-AI-03',
    suite: '8. AI Chatbot',
    title: 'Hỏi về thanh toán MoMo',
    app: 'customer',
    url: URL.customer + '/home',
    accounts: ['0901234561 / Password@1'],
    priority: 'P1',
    steps: [
      { action: 'fill', selector: 'textarea, input[placeholder*="câu hỏi"]', value: 'Thanh toán bằng MoMo như thế nào?' },
      { action: 'click', selector: '[class*="send"], button:has-text("Gửi")' },
      { action: 'wait', value: '3000' },
      { action: 'screenshot', screenshot: 'ai-momo-answer' },
      { action: 'assert-text', value: 'MoMo', expect: 'Câu trả lời về MoMo' },
    ],
    expectedResult: 'Giải thích cách thanh toán MoMo, có mention cổng thanh toán và refund policy',
    tags: ['ai', 'chatbot', 'momo', 'P1'],
  },

  {
    id: 'TC-AI-04',
    suite: '8. AI Chatbot',
    title: 'Hỏi về đăng ký tài xế',
    app: 'customer',
    url: URL.customer + '/home',
    accounts: ['0901234561 / Password@1'],
    priority: 'P1',
    steps: [
      { action: 'fill', selector: 'textarea, input[placeholder*="câu hỏi"]', value: 'Tôi muốn đăng ký làm tài xế, cần những gì?' },
      { action: 'click', selector: '[class*="send"], button:has-text("Gửi")' },
      { action: 'wait', value: '3000' },
      { action: 'screenshot', screenshot: 'ai-driver-reg-answer' },
      { action: 'assert-text', value: 'GPLX', expect: 'Đề cập GPLX trong yêu cầu' },
    ],
    expectedResult: 'Liệt kê yêu cầu: tuổi 21+, GPLX, CMND, đăng kiểm xe, commission rates',
    tags: ['ai', 'chatbot', 'driver-registration', 'P1'],
  },

  {
    id: 'TC-AI-05',
    suite: '8. AI Chatbot',
    title: 'Hỏi hủy chuyến + refund',
    app: 'customer',
    url: URL.customer + '/home',
    accounts: ['0901234561 / Password@1'],
    priority: 'P1',
    steps: [
      { action: 'fill', selector: 'textarea, input[placeholder*="câu hỏi"]', value: 'Nếu tôi hủy chuyến thì có được hoàn tiền không?' },
      { action: 'click', selector: '[class*="send"], button:has-text("Gửi")' },
      { action: 'wait', value: '3000' },
      { action: 'screenshot', screenshot: 'ai-cancel-refund-answer' },
      { action: 'assert-text', value: 'hủy', expect: 'Đề cập chính sách hủy' },
    ],
    expectedResult: 'Giải thích chính sách hủy chuyến và refund theo phương thức thanh toán',
    tags: ['ai', 'chatbot', 'cancel', 'refund', 'P1'],
  },

  {
    id: 'TC-AI-06',
    suite: '8. AI Chatbot',
    title: 'Kiểm tra /api/ai/chat/status — RAG ready',
    app: 'api',
    url: URL.api + '/api/ai/chat/status',
    accounts: [],
    priority: 'P0',
    steps: [
      { action: 'navigate', value: URL.api + '/api/ai/chat/status' },
      { action: 'screenshot', screenshot: 'ai-chat-status-api' },
      { action: 'assert-text', value: '"ready":true', expect: 'RAG service đã sẵn sàng' },
      { action: 'assert-text', value: '"chunks_indexed"', expect: 'Có chunks được index (mong đợi 38)' },
    ],
    expectedResult: '{ "ready": true, "chunks_indexed": 38, ... }',
    tags: ['ai', 'rag', 'api', 'P0'],
  },
];

// ---------------------------------------------------------------------------
// SUITE 9 — REVIEWS
// ---------------------------------------------------------------------------
const SUITE_REVIEW: TestCase[] = [
  {
    id: 'TC-REV-01',
    suite: '9. Reviews',
    title: 'Customer đánh giá tài xế sau chuyến',
    app: 'customer',
    url: URL.customer,
    accounts: ['0901234561 / Password@1'],
    priority: 'P1',
    steps: [
      { action: 'note', note: 'Sau khi chuyến COMPLETED, màn hình đánh giá xuất hiện' },
      { action: 'screenshot', screenshot: 'review-dialog' },
      { action: 'click', selector: '[class*="star"]:nth-child(5), [aria-label="5 sao"]', expect: 'Chọn 5 sao' },
      { action: 'fill', selector: 'textarea, input[placeholder*="nhận xét"]', value: 'Tài xế lái xe tốt, đúng giờ!' },
      { action: 'click', selector: 'button:has-text("Gửi đánh giá"), button:has-text("Xác nhận")' },
      { action: 'wait', value: '2000' },
      { action: 'screenshot', screenshot: 'review-submitted' },
    ],
    expectedResult: 'Đánh giá lưu thành công, rating tài xế cập nhật (async qua RabbitMQ → driver-service)',
    tags: ['review', 'rating', 'P1'],
  },

  {
    id: 'TC-REV-02',
    suite: '9. Reviews',
    title: 'Xem lịch sử đánh giá trong Admin',
    app: 'admin',
    url: URL.admin,
    accounts: ['0900000001 / Password@1'],
    priority: 'P2',
    steps: [
      { action: 'navigate', value: URL.admin },
      { action: 'click', selector: '[href*="driver"], [href*="review"], [class*="driver"]' },
      { action: 'screenshot', screenshot: 'admin-driver-reviews' },
      { action: 'assert-visible', selector: '[class*="rating"], [class*="star"]', expect: 'Rating tài xế hiển thị' },
    ],
    expectedResult: 'Admin thấy rating tài xế cập nhật sau khi customer đánh giá',
    tags: ['review', 'admin', 'P2'],
  },
];

// ---------------------------------------------------------------------------
// SUITE 10 — ADMIN DASHBOARD
// ---------------------------------------------------------------------------
const SUITE_ADMIN: TestCase[] = [
  {
    id: 'TC-ADMIN-01',
    suite: '10. Admin Dashboard',
    title: 'Admin xem dashboard tổng quan',
    app: 'admin',
    url: URL.admin,
    accounts: ['0900000001 / Password@1 (admin@cabbooking.com)'],
    priority: 'P0',
    steps: [
      { action: 'navigate', value: URL.admin },
      { action: 'note', note: 'Đăng nhập admin' },
      { action: 'screenshot', screenshot: 'admin-overview-dashboard' },
      { action: 'assert-visible', selector: '[class*="stat"], [class*="card"], [class*="metric"]', expect: 'Số liệu thống kê hiển thị' },
      { action: 'assert-text', value: 'Tài xế', expect: 'Số tài xế hiển thị' },
      { action: 'assert-text', value: 'Chuyến', expect: 'Số chuyến hiển thị' },
    ],
    expectedResult: 'Dashboard hiển thị: tổng tài xế, tổng khách, tổng chuyến, doanh thu',
    tags: ['admin', 'dashboard', 'P0'],
  },

  {
    id: 'TC-ADMIN-02',
    suite: '10. Admin Dashboard',
    title: 'Admin duyệt tài xế PENDING',
    app: 'admin',
    url: URL.admin,
    accounts: ['0900000001 / Password@1'],
    priority: 'P0',
    steps: [
      { action: 'navigate', value: URL.admin },
      { action: 'click', selector: '[href*="driver"], [href*="tài xế"], [class*="driver"]', expect: 'Vào menu Tài xế' },
      { action: 'screenshot', screenshot: 'admin-driver-list' },
      { action: 'click', selector: 'button:has-text("Chờ duyệt"), [class*="pending"], [value="PENDING"]', expect: 'Lọc theo PENDING' },
      { action: 'screenshot', screenshot: 'admin-pending-drivers' },
      { action: 'assert-visible', selector: '[class*="driver-row"], tr', expect: 'Danh sách tài xế PENDING' },
      { action: 'note', note: 'Seed38 (0919100027), Seed39 (0919100028), Seed40 (0919100029) đều ở PENDING' },
      { action: 'click', selector: 'button:has-text("Duyệt"), button:has-text("Approve"), button:has-text("Chấp nhận")', expect: 'Duyệt tài xế đầu tiên' },
      { action: 'wait', value: '2000' },
      { action: 'screenshot', screenshot: 'admin-driver-approved' },
      { action: 'assert-text', value: 'APPROVED', expect: 'Tài xế đã được duyệt' },
    ],
    expectedResult: 'Tài xế PENDING chuyển sang APPROVED, badge số lượng pending giảm',
    tags: ['admin', 'driver', 'approve', 'P0'],
  },

  {
    id: 'TC-ADMIN-03',
    suite: '10. Admin Dashboard',
    title: 'Admin xem danh sách tài xế + badge pending',
    app: 'admin',
    url: URL.admin,
    accounts: ['0900000001 / Password@1'],
    priority: 'P0',
    steps: [
      { action: 'navigate', value: URL.admin },
      { action: 'screenshot', screenshot: 'admin-sidebar-badges' },
      { action: 'assert-visible', selector: '[class*="badge"], [class*="chip"]', expect: 'Badge số lượng pending hiển thị' },
      { action: 'note', note: 'Badge phải = số tài xế PENDING (seed có 3: seed38, 39, 40)' },
    ],
    expectedResult: 'Badge trong sidebar menu "Tài xế" hiển thị đúng số lượng PENDING',
    tags: ['admin', 'driver', 'badge', 'P0'],
  },

  {
    id: 'TC-ADMIN-04',
    suite: '10. Admin Dashboard',
    title: 'Admin xem lịch sử chuyến',
    app: 'admin',
    url: URL.admin,
    accounts: ['0900000001 / Password@1'],
    priority: 'P1',
    steps: [
      { action: 'navigate', value: URL.admin },
      { action: 'click', selector: '[href*="ride"], [href*="chuyến"], [class*="ride"]' },
      { action: 'screenshot', screenshot: 'admin-ride-list' },
      { action: 'assert-visible', selector: '[class*="ride-row"], tr, [class*="item"]', expect: 'Danh sách chuyến' },
      { action: 'click', selector: '[class*="ride-row"]:first-child, tr:first-child', expect: 'Click xem chi tiết chuyến đầu tiên' },
      { action: 'screenshot', screenshot: 'admin-ride-detail' },
    ],
    expectedResult: 'Danh sách chuyến với đầy đủ: customer, driver, điểm đón/đến, giá, trạng thái, thời gian',
    tags: ['admin', 'rides', 'P1'],
  },

  {
    id: 'TC-ADMIN-05',
    suite: '10. Admin Dashboard',
    title: 'Admin xem giao dịch thanh toán',
    app: 'admin',
    url: URL.admin,
    accounts: ['0900000001 / Password@1'],
    priority: 'P1',
    steps: [
      { action: 'navigate', value: URL.admin },
      { action: 'click', selector: '[href*="payment"], [href*="thanh toán"], [href*="transaction"]' },
      { action: 'screenshot', screenshot: 'admin-payment-list' },
      { action: 'assert-visible', selector: '[class*="payment-row"], [class*="transaction"]', expect: 'Danh sách giao dịch' },
      { action: 'assert-text', value: 'CASH', expect: 'Phương thức thanh toán hiển thị' },
    ],
    expectedResult: 'Danh sách giao dịch đầy đủ theo từng phương thức (CASH, MOMO, VNPAY, WALLET)',
    tags: ['admin', 'payment', 'P1'],
  },

  {
    id: 'TC-ADMIN-06',
    suite: '10. Admin Dashboard',
    title: 'Admin xem số dư Merchant Wallet',
    app: 'admin',
    url: URL.admin,
    accounts: ['0900000001 / Password@1'],
    priority: 'P1',
    steps: [
      { action: 'navigate', value: URL.admin },
      { action: 'click', selector: '[href*="wallet"], [href*="ví"], [class*="wallet"]' },
      { action: 'screenshot', screenshot: 'admin-merchant-wallet' },
      { action: 'assert-visible', selector: '[class*="balance"], [class*="merchant"]', expect: 'Số dư merchant wallet' },
      { action: 'assert-visible', selector: '[class*="ledger"], [class*="transaction"]', expect: 'Double-entry ledger' },
    ],
    expectedResult: 'Hiển thị tổng số dư platform (tổng commission từ tất cả chuyến)',
    tags: ['admin', 'wallet', 'merchant', 'commission', 'P1'],
  },

  {
    id: 'TC-ADMIN-07',
    suite: '10. Admin Dashboard',
    title: 'Admin xem danh sách khách hàng',
    app: 'admin',
    url: URL.admin,
    accounts: ['0900000001 / Password@1'],
    priority: 'P2',
    steps: [
      { action: 'navigate', value: URL.admin },
      { action: 'click', selector: '[href*="customer"], [href*="khách"], [href*="user"]' },
      { action: 'screenshot', screenshot: 'admin-customer-list' },
      { action: 'assert-visible', selector: '[class*="customer-row"], tr', expect: 'Danh sách khách hàng' },
    ],
    expectedResult: '20 khách hàng seed hiển thị đầy đủ, có số điện thoại, email, trạng thái',
    tags: ['admin', 'customer', 'P2'],
  },

  {
    id: 'TC-ADMIN-08',
    suite: '10. Admin Dashboard',
    title: 'Admin xem lịch sử chuyến của 1 tài xế cụ thể',
    app: 'admin',
    url: URL.admin,
    accounts: ['0900000001 / Password@1'],
    priority: 'P2',
    steps: [
      { action: 'navigate', value: URL.admin },
      { action: 'click', selector: '[href*="driver"]' },
      { action: 'click', selector: '[class*="driver-row"]:first-child, tr:nth-child(2)' },
      { action: 'screenshot', screenshot: 'admin-driver-detail' },
      { action: 'assert-visible', selector: '[class*="rating"]', expect: 'Rating tài xế hiển thị' },
      { action: 'assert-visible', selector: '[class*="ride"], [class*="trip"]', expect: 'Lịch sử chuyến của tài xế' },
    ],
    expectedResult: 'Chi tiết tài xế: thông tin cá nhân, xe, rating, lịch sử chuyến, thu nhập',
    tags: ['admin', 'driver', 'detail', 'P2'],
  },
];

// ---------------------------------------------------------------------------
// SUITE 11 — PRICING VERIFICATION
// ---------------------------------------------------------------------------
const SUITE_PRICING: TestCase[] = [
  {
    id: 'TC-PRICE-01',
    suite: '11. Pricing',
    title: 'Kiểm tra giá cước chuẩn (API pricing-service)',
    app: 'api',
    url: URL.api + '/api/pricing/estimate',
    accounts: [],
    priority: 'P0',
    steps: [
      {
        action: 'note',
        note: `POST ${URL.api}/api/pricing/estimate với body:
{
  "pickup": {"lat": 10.77255, "lng": 106.69815},
  "dropoff": {"lat": 10.78000, "lng": 106.70000},
  "vehicleType": "CAR_4"
}`,
      },
      { action: 'screenshot', screenshot: 'pricing-api-response' },
      { action: 'assert-text', value: '"baseFare"', expect: 'baseFare có trong response' },
      { action: 'assert-text', value: '"priceMultiplier"', expect: 'surge multiplier' },
    ],
    expectedResult: `CAR_4: baseFare=15000, pricePerKm=8000, surge≥1.0. 
Giá = 15000 + (distance × 8000) × priceMultiplier`,
    tags: ['pricing', 'api', 'P0'],
  },

  {
    id: 'TC-PRICE-02',
    suite: '11. Pricing',
    title: 'Commission sau chuyến — MOTORBIKE 20%, CAR_4 18%, CAR_7 15%',
    app: 'api',
    url: URL.api,
    accounts: [],
    priority: 'P0',
    steps: [
      { action: 'note', note: 'Check DB hoặc driver wallet sau khi hoàn thành chuyến' },
      { action: 'note', note: 'Driver net = grossFare × (1 - 0.18) với CAR_4' },
      { action: 'note', note: 'Platform fee = grossFare × 0.18 ghi vào MerchantLedger' },
    ],
    expectedResult: 'MOTORBIKE: 20% commission, CAR_4: 18%, CAR_7: 15%. Driver nhận đúng net earnings.',
    tags: ['pricing', 'commission', 'wallet', 'P0'],
  },
];

// ---------------------------------------------------------------------------
// EXPORT ALL TEST CASES
// ---------------------------------------------------------------------------
export const ALL_TEST_CASES: TestCase[] = [
  ...SUITE_AUTH,
  ...SUITE_BOOKING,
  ...SUITE_PAYMENT,
  ...SUITE_WALLET,
  ...SUITE_DRIVER,
  ...SUITE_MULTIUSER,
  ...SUITE_CHAT,
  ...SUITE_AI_CHAT,
  ...SUITE_REVIEW,
  ...SUITE_ADMIN,
  ...SUITE_PRICING,
];

export const SUITES = {
  auth: SUITE_AUTH,
  booking: SUITE_BOOKING,
  payment: SUITE_PAYMENT,
  wallet: SUITE_WALLET,
  driver: SUITE_DRIVER,
  multiUser: SUITE_MULTIUSER,
  chat: SUITE_CHAT,
  aiChat: SUITE_AI_CHAT,
  review: SUITE_REVIEW,
  admin: SUITE_ADMIN,
  pricing: SUITE_PRICING,
};

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
/*
 Total test cases: 37
 ├── Suite 1  (Auth)         : 4  cases  [P0: 3, P1: 1]
 ├── Suite 2  (Booking)      : 5  cases  [P0: 2, P1: 3]
 ├── Suite 3  (Payment)      : 3  cases  [P0: 3]
 ├── Suite 4  (Wallet)       : 4  cases  [P0: 2, P1: 2]
 ├── Suite 5  (Driver)       : 5  cases  [P0: 3, P1: 2]
 ├── Suite 6  (Multi-user)   : 2  cases  [P1: 2]
 ├── Suite 7  (Trip Chat)    : 2  cases  [P1: 2]
 ├── Suite 8  (AI Chatbot)   : 6  cases  [P0: 2, P1: 4]
 ├── Suite 9  (Reviews)      : 2  cases  [P1: 1, P2: 1]
 ├── Suite 10 (Admin)        : 8  cases  [P0: 3, P1: 3, P2: 2]
 └── Suite 11 (Pricing)      : 2  cases  [P0: 2]
*/
