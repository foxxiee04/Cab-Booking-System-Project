# ERD: Core Bounded Contexts

Quan hệ giữa các aggregate root chính — mỗi service sở hữu dữ liệu riêng, không chia sẻ database.

```mermaid
erDiagram
    BOOKING {
        string  id            PK
        string  customerId
        string  vehicleType   "MOTORBIKE | CAR_4 | CAR_7"
        json    pickupAddress
        json    destinationAddress
        decimal estimatedFare
        string  status        "DRAFT | CONFIRMED | EXPIRED"
        timestamp createdAt
    }

    RIDE {
        string    id          PK
        string    bookingId   FK
        string    driverId
        string    customerId
        string    status      "PENDING | ACCEPTED | IN_PROGRESS | COMPLETED | CANCELLED"
        decimal   fare
        string    paymentMethod "CASH | MOMO | VNPAY"
        timestamp acceptedAt
        timestamp completedAt
    }

    PAYMENT {
        string    id              PK
        string    rideId          FK
        string    customerId
        decimal   amount
        string    method          "CASH | MOMO | VNPAY"
        string    status          "PENDING | COMPLETED | FAILED | REFUNDED"
        string    idempotencyKey  "unique — IPN idempotency"
        timestamp createdAt
    }

    WALLET_ACCOUNT {
        string    id               PK
        string    driverId
        decimal   availableBalance "có thể rút ngay"
        decimal   pendingBalance   "giữ T+24h"
        string    status           "ACTIVE | LOCKED | INACTIVE"
    }

    PENDING_EARNING {
        string    id         PK
        string    walletId   FK
        string    rideId
        decimal   amount
        timestamp settleAt   "createdAt + 24h"
        boolean   settled
    }

    WALLET_TRANSACTION {
        string    id        PK
        string    walletId  FK
        decimal   amount
        string    type      "EARN | WITHDRAW | TOPUP | FEE"
        string    rideId
        timestamp createdAt
    }

    DRIVER {
        string  id          PK
        string  userId      FK
        string  status      "PENDING | APPROVED | REJECTED | SUSPENDED"
        string  vehicleType
        string  plateNumber "unique"
        decimal rating
        boolean isOnline
        point   location    "Redis GEO — not in PG"
    }

    BOOKING     ||--||  RIDE             : "spawns"
    RIDE        ||--o|  PAYMENT          : "settles"
    RIDE        }o--||  DRIVER           : "assigned to"
    DRIVER      ||--||  WALLET_ACCOUNT   : "owns"
    WALLET_ACCOUNT ||--o{ PENDING_EARNING  : "holds"
    WALLET_ACCOUNT ||--o{ WALLET_TRANSACTION : "records"
```

> **Lưu ý kiến trúc**: Mỗi service có Prisma client riêng trong `src/generated/prisma-client/`. Các bảng trên thuộc các database khác nhau và chỉ liên kết qua ID — không có foreign key cross-database.
