# Wallet Service — Internal Architecture

Bên trong `wallet-service:3006` — source of truth cho ví tài xế (driver-facing balance), MerchantLedger và T+24h settlement.

```mermaid
graph TB
    GW["api-gateway"]

    subgraph WAL["wallet-service :3006"]
        direction TB

        subgraph CTRL["Controllers"]
            WC["WalletController"]
            MC["MerchantController<br/>(admin only)"]
        end

        subgraph SVC["Domain Services"]
            BAL_SVC["BalanceService<br/>credit · debit · transfer<br/>(double-entry)"]
            EARN_HANDLER["EarningsHandler<br/>(consumes driver.earnings.settled)"]
            COMM_HANDLER["CommissionHandler<br/>(cash ride → wallet debit)"]
            WD_SVC["WithdrawalService<br/>request · approve · process"]
            BANK["BankIntegrationStub<br/>(BankTransaction fire-and-forget)"]
        end

        subgraph SCHED["Schedulers (cron)"]
            T24H["PendingEarnings cron<br/>settle pending → available<br/>(every 5 min)"]
            DEBT_DUE["DebtRecord cron<br/>flag OVERDUE after dueDate<br/>(daily)"]
        end

        subgraph LEDGER["Ledger Sources of Truth"]
            DW[("DriverWallet<br/>(balance · pending · locked · debt)")]
            WT[("WalletTransaction<br/>immutable journal")]
            ML[("MerchantLedger<br/>+ MerchantBalance singleton")]
            PE[("PendingEarning<br/>(T+24h hold)")]
            DR[("DebtRecord<br/>(per cash ride)")]
        end

        GATE["canAcceptRide gate<br/>balance > DEBT_LIMIT (-200K)"]
    end

    PG[("wallet_db")]
    MQ[("RabbitMQ<br/>consume:<br/>driver.earnings.settled<br/>refund.completed<br/>wallet.topup.completed<br/>publish:<br/>wallet.balance.updated")]
    DRV["driver-service<br/>(canAcceptRide check)"]

    GW --> WC
    GW --> MC
    GW --> INC

    WC --> BAL_SVC
    WC --> WD_SVC
    MC --> ML
    INC --> SCHED

    BAL_SVC --- DW
    BAL_SVC --- WT
    BAL_SVC --- ML

    EARN_HANDLER --> PE
    EARN_HANDLER --> DW
    COMM_HANDLER --> DR
    COMM_HANDLER --> DW

    T24H --> PE
    T24H --> DW
    DEBT_DUE --> DR
    INCENT --> DW

    WD_SVC --> BANK
    WD_SVC --> DW

    GATE --- DW
    DRV -->|/internal/can-accept| GATE

    EARN_HANDLER -.-|consume| MQ
    COMM_HANDLER -.-|consume| MQ
    BAL_SVC -.->|publish| MQ

    DW --- PG
    WT --- PG
    ML --- PG
    PE --- PG
    DR --- PG
```

## 4 nguồn tiền song song

| Bảng | Vai trò |
|------|---------|
| `DriverWallet.balance` | Số dư tổng (có thể âm khi nợ) |
| `DriverWallet.pendingBalance` | Thu nhập online hold T+24h, chưa khả dụng |
| `DriverWallet.lockedBalance` | Ký quỹ ban đầu (khoá đến khi dừng HĐ) |
| `DriverWallet.debt` | Tuyệt đối hoá phần balance < 0 |
| `WalletTransaction` | Ledger bất biến — mọi giao dịch ghi 1 dòng |
| `MerchantLedger` | Sổ cái platform: PAYMENT(IN), COMMISSION(IN), PAYOUT(OUT), VOUCHER(OUT)... |
| `MerchantBalance` (singleton) | Snapshot O(1) cho admin dashboard |
| `PendingEarning` | Mỗi online ride → 1 row, cron move sang available sau 24h |
| `DebtRecord` | Mỗi cash ride → 1 row debt, dueDate = +2 ngày |
