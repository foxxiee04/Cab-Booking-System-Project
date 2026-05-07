# Shared library — Cab Booking System

Thư viện dùng chung cho **frontend** và một số **backend services** trong monorepo.

## Mục đích

Folder `shared/` chứa:
- **API Client**: HTTP client đã được cấu hình sẵn với authentication
- **TypeScript Types**: Các interface/type dùng chung (events, API responses, entities)
- **Utility Functions**: Các hàm tiện ích tái sử dụng (geo, format, validation, async)
- **Shared Logic**: Business logic dùng chung giữa frontend và backend

## Cấu trúc

```
shared/
├── api-client/         # HTTP client cho frontend apps
│   └── index.ts        # Axios client với auth interceptors
├── types/              # TypeScript types/interfaces
│   ├── index.ts        # Common types (ApiResponse, Pagination, BaseEntity)
│   └── events.ts       # Event types cho RabbitMQ
├── utils/              # Utility functions
│   ├── geo.utils.ts           # Tính khoảng cách, validate coordinates
│   ├── format.utils.ts        # Format số, tiền, ngày tháng
│   ├── async.utils.ts         # Retry, timeout, debounce
│   ├── validation.utils.ts    # Validate email, phone, etc.
│   └── __tests__/             # Unit tests
├── package.json
├── tsconfig.json
└── README.md
```

## Thành phần

### API Client (`api-client/`)

HTTP client đã config sẵn cho frontend applications với các tính năng:

**Tính năng:**

- Auto-attach JWT token vào headers
- Auto-refresh token khi 401 Unauthorized
- Redirect to login khi refresh token hết hạn
- Timeout mặc định: 10s
- Error handling thống nhất
- Request/Response interceptors

**Sử dụng:**
```typescript
import { createApiClient } from '@cab-booking/shared/api-client';

// Token store (localStorage, AsyncStorage, etc.)
const tokenStore = {
  getTokens: () => {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    return accessToken && refreshToken ? { accessToken, refreshToken } : null;
  },
  setTokens: ({ accessToken, refreshToken }) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  },
  removeTokens: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },
};

// Khởi tạo client
const apiClient = createApiClient(tokenStore);

// Sử dụng
const response = await apiClient.get('/api/users/me');
const user = response.data.data;
```

**APIs có sẵn:**
- `auth.*` - Login, register, refresh, logout
- `users.*` - Get/update profile
- `rides.*` - Create, track, complete ride
- `bookings.*` - Create, confirm, cancel booking
- `drivers.*` - Driver operations
- `pricing.*` - Get fare estimate, surge
- `payments.*` - Payment operations
- `reviews.*` - Submit/get reviews
- `notifications.*` - Get notifications

### Types (`types/`)

**Common Types:**
```typescript
// API Response structure
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: any };
  meta?: { page?: number; limit?: number; total?: number };
}

// Pagination
interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Base entity
interface BaseEntity {
  createdAt: Date;
  updatedAt: Date;
}

// JWT Payload
interface JwtPayload {
  sub: string;      // userId
  role: string;     // CUSTOMER | DRIVER | ADMIN
  email?: string;
  iat: number;
  exp: number;
}
```

**Event Types (`events.ts`):**
Các event types cho message queue (RabbitMQ):
```typescript
// User events
UserCreatedEvent
UserUpdatedEvent
UserDeletedEvent

// Booking events
BookingCreatedEvent
BookingConfirmedEvent
BookingCancelledEvent

// Ride events
RideCreatedEvent
RideAcceptedEvent
RideStartedEvent
RideCompletedEvent
RideCancelledEvent

// Payment events
PaymentCompletedEvent
PaymentFailedEvent
PaymentRefundedEvent

// Driver events
DriverLocationUpdatedEvent
DriverStatusChangedEvent
```

### Utils (`utils/`)

#### **Geo Utils** (`geo.utils.ts`)
```typescript
// Tính khoảng cách giữa 2 điểm (Haversine formula)
calculateDistance(lat1, lon1, lat2, lon2): number  // km

// Validate coordinates
isValidCoordinate(lat, lon): boolean

// Convert degrees to radians
degreesToRadians(degrees): number

// Parse location string
parseLocation(location: string): { lat: number; lng: number } | null
```

#### **Format Utils** (`format.utils.ts`)
```typescript
// Format tiền tệ
formatCurrency(amount: number, currency = 'VND'): string
// 25000 → "25,000 ₫"

// Format khoảng cách
formatDistance(meters: number): string
// 1500 → "1.5 km"
// 800 → "800 m"

// Format thời gian
formatDuration(seconds: number): string
// 3665 → "1h 1m"
// 90 → "1m 30s"

// Format ngày giờ
formatDateTime(date: Date | string): string
// Date → "05/02/2026 14:30"

// Format phone
formatPhone(phone: string): string
// "0123456789" → "012 345 6789"
```

#### **Async Utils** (`async.utils.ts`)
```typescript
// Retry với exponential backoff
retry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T>

// Sleep/delay
sleep(ms: number): Promise<void>

// Timeout wrapper
withTimeout<T>(promise: Promise<T>, ms: number): Promise<T>

// Debounce
debounce<T>(fn: Function, delay: number): Function
```

#### **Validation Utils** (`validation.utils.ts`)
```typescript
// Email validation
isValidEmail(email: string): boolean

// Phone validation (VN format)
isValidPhone(phone: string): boolean

// Password strength
isStrongPassword(password: string): boolean
// Min 8 chars, 1 uppercase, 1 lowercase, 1 number

// Validate coordinates
validateCoordinates(lat: number, lng: number): boolean
```

## Cài đặt và sử dụng

### Build shared library

```bash
cd shared/
npm install
npm run build
```

### Sử dụng trong Frontend Apps

```json
// apps/customer-app/package.json
{
  "dependencies": {
    "@cab-booking/shared": "file:../../shared"
  }
}
```

```bash
npm install
```

```typescript
// Import trong code
import { ApiClient } from '@cab-booking/shared/api-client';
import { formatCurrency, calculateDistance } from '@cab-booking/shared/utils';
import type { ApiResponse, RideCreatedEvent } from '@cab-booking/shared/types';
```

### Sử dụng trong Backend Services

```typescript
// services/ride-service/src/events/publisher.ts
import { RideCreatedEvent } from '@cab-booking/shared/types';

const event: RideCreatedEvent = {
  type: 'ride.created',
  data: { rideId, customerId, driverId },
  timestamp: new Date(),
};
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm test -- --coverage
```

## Cập nhật thư viện

Khi thay đổi code trong `shared/`:

```bash
# 1. Build lại
cd shared/
npm run build

# 2. Update các apps đang dùng
cd ../apps/customer-app
npm install

cd ../apps/driver-app
npm install
```

## Best practices

1. **Chỉ chứa code DRY (Don't Repeat Yourself)**
   - Nếu code xuất hiện ở 2+ nơi → đưa vào shared

2. **Keep it lightweight**
   - Không thêm dependencies nặng vào shared
   - Mỗi function nên độc lập, tree-shakeable

3. **Type everything**
   - Tất cả functions phải có TypeScript types đầy đủ
   - Export types để apps có thể import

4. **Test thoroughly**
   - Mỗi util function phải có unit test
   - Coverage >= 80%

5. **Document well**
   - JSDoc cho tất cả public functions
   - Examples trong comments

## Định hướng mở rộng

- [ ] WebSocket client wrapper
- [ ] Form validation schemas (Zod/Yup)
- [ ] React hooks (useAuth, useRide, useLocation)
- [ ] Common UI components
- [ ] Error tracking utilities
- [ ] Analytics helpers

## License

Part of the Cab Booking System project.
