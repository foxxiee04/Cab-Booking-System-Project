# Sequence — Driver Withdrawal

Tài xế rút tiền từ ví: request → admin approve → BankTransaction → `WalletTransaction(WITHDRAW)`.

```mermaid
sequenceDiagram
    autonumber
    actor D as Tài xế
    actor A as Admin
    participant GW as api-gateway
    participant Wal as wallet-service
    participant Bank as Bank Stub<br/>(SystemBankAccount)
    participant DB as wallet_db
    participant MQ as RabbitMQ
    participant Notif as notification-service

    D->>GW: POST /wallet/withdraw<br/>(amount, bankAccount)
    GW->>Wal: forward
    Wal->>DB: SELECT DriverWallet<br/>availableBalance >= amount?
    alt Insufficient
        Wal-->>D: 400 INSUFFICIENT_BALANCE
    end
    Wal->>DB: INSERT WithdrawalRequest<br/>(status=PENDING, idempotencyKey)
    Wal->>DB: UPDATE driver_wallets<br/>availableBalance -= amount<br/>(reserve)
    Wal->>DB: INSERT WalletTransaction<br/>(type=WITHDRAW, DEBIT, amount, RESERVED)
    Wal-->>D: { withdrawalId, status: PENDING }

    Note over A,DB: Admin review
    A->>GW: GET /admin/wallet/withdrawals?status=PENDING
    GW->>Wal: forward
    Wal-->>A: list pending requests

    A->>GW: POST /admin/wallet/withdrawals/:id/approve
    GW->>Wal: forward
    Wal->>DB: UPDATE WithdrawalRequest<br/>status=PROCESSING
    Wal->>Bank: BankTransaction<br/>(PAYOUT_ACCOUNT → driver bank)
    Bank-->>Wal: txId · status SUCCESS<br/>fire-and-forget — failure không rollback ledger
    Wal->>DB: UPDATE WithdrawalRequest<br/>status=COMPLETED, processedAt=NOW
    Wal->>DB: INSERT MerchantLedger<br/>(type=OUT, category=WITHDRAW, amount)
    Wal-->>MQ: publish withdrawal.completed
    MQ-->>Notif: push thông báo "Đã chuyển X đ"
    Notif-->>D: notification

    rect rgb(254, 226, 226)
    Note over A,DB: Reject path
    A->>GW: POST /admin/wallet/withdrawals/:id/reject (reason)
    GW->>Wal: forward
    Wal->>DB: UPDATE WithdrawalRequest<br/>status=FAILED
    Wal->>DB: UPDATE driver_wallets<br/>availableBalance += amount<br/>(refund reserve)
    Wal->>DB: INSERT WalletTransaction<br/>(type=REFUND, CREDIT)
    Wal-->>MQ: publish withdrawal.rejected
    MQ-->>Notif: notify driver
    end
```

## Lưu ý

- **Reserve trước khi approve**: `availableBalance` giảm ngay khi request, tránh double-spend nếu driver liên tục request.
- **Bank fire-and-forget**: `BankTransaction` lỗi không rollback ledger — `BANK_SIMULATION_ENABLED=true` cho dev/thesis.
- **Idempotency**: `WithdrawalRequest.idempotencyKey` unique → admin click approve 2 lần không double-pay.
