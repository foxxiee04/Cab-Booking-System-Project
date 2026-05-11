# Sequence — Wallet Top-up (MoMo Sandbox)

Tài xế nạp tiền vào ví: init → MoMo sandbox → IPN callback → wallet credit (kép trên 2 DB).

```mermaid
sequenceDiagram
    autonumber
    actor D as Tài xế
    participant GW as api-gateway
    participant Pay as payment-service
    participant Wal as wallet-service
    participant Momo as MoMo Sandbox
    participant PayDB as payment_db
    participant WalDB as wallet_db

    D->>GW: POST /wallet/top-up/init<br/>(amount=200000, provider=MOMO)
    GW->>Pay: forward
    Pay->>PayDB: INSERT WalletTopUpOrder<br/>(status=PENDING, idempotencyKey)
    Pay->>Momo: POST /v2/gateway/api/create<br/>(orderId, amount, returnUrl, signature)
    Momo-->>Pay: { payUrl, deeplink }
    Pay-->>D: { topUpId, payUrl }

    D->>Momo: redirect / scan QR
    Momo-->>D: User confirms in MoMo app

    Note over Momo,Pay: IPN callback (signed HMAC)
    Momo->>GW: POST /payments/ipn/momo<br/>(orderId, resultCode=0, signature)
    GW->>Pay: forward (no auth needed)
    Pay->>Pay: verify HMAC signature
    Pay->>PayDB: idempotencyKey check<br/>(skip if duplicate)
    Pay->>PayDB: UPDATE WalletTopUpOrder<br/>status=COMPLETED
    Pay->>PayDB: UPDATE DriverWallet (payment_db)<br/>balance += amount

    Note over Pay,Wal: Sync to source-of-truth wallet
    Pay->>Wal: POST /internal/topup-completed<br/>(x-internal-token, driverId, amount, idempotencyKey)
    Wal->>WalDB: INSERT WalletTransaction<br/>(type=TOP_UP, direction=CREDIT)
    Wal->>WalDB: UPDATE driver_wallets<br/>balance += amount<br/>availableBalance += amount<br/>status = ACTIVE if INACTIVE
    Wal-->>Pay: ack

    Pay-->>Momo: 200 OK<br/>(IPN must succeed)

    Note over D: Frontend tự poll /wallet/balance
    D->>GW: GET /wallet/balance
    GW->>Wal: forward
    Wal-->>D: { balance: 500000, availableBalance: 500000, status: ACTIVE }
```

## Lưu ý kỹ thuật

- **Idempotency**: IPN MoMo có thể fire lại nhiều lần — check `idempotencyKey` trên Payment row để skip duplicate.
- **2-DB sync**: payment_db.DriverWallet là internal tracker, wallet_db.driver_wallets mới là source of truth cho driver balance UI.
- **Sandbox confirm**: Trong dev, có thêm endpoint `POST /wallet/top-up/sandbox-confirm` để skip MoMo redirect.
- **Initial activation**: Lần top-up đầu tiên ≥ 300K → status INACTIVE → ACTIVE → driver có thể goOnline.
