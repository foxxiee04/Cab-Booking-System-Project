# Sequence — T+24h Settlement (Cron)

Cron trong wallet-service quét `PendingEarning` quá `settleAt` → move sang `availableBalance`. Anti-fraud: tài xế phải hoàn thành 24h mới rút được tiền online ride.

```mermaid
sequenceDiagram
    autonumber
    participant Cron as Wallet Cron<br/>(every 5 min)
    participant Wal as wallet-service
    participant DB as wallet_db
    participant MQ as RabbitMQ
    participant Notif as notification-service
    actor D as Tài xế

    Note over Cron,Wal: Trigger định kỳ
    Cron->>Wal: tick (interval 5 min)
    Wal->>DB: SELECT PendingEarning<br/>WHERE settleAt < NOW()<br/>AND settledAt IS NULL<br/>FOR UPDATE
    DB-->>Wal: rows[] (group by driverId)

    loop Mỗi driver có pending quá hạn
        Wal->>DB: BEGIN TX
        Wal->>DB: SUM(amount) trong rows[driverId]<br/>= toSettle
        Wal->>DB: UPDATE driver_wallets<br/>SET pendingBalance -= toSettle,<br/>availableBalance += toSettle
        Wal->>DB: UPDATE PendingEarning<br/>SET settledAt = NOW()<br/>WHERE id IN (rows.ids)
        Wal->>DB: INSERT WalletTransaction<br/>(type=EARN, CREDIT, RELEASED)<br/>per row
        Wal->>DB: INSERT MerchantLedger<br/>(type=OUT, category=PAYOUT, amount=toSettle)
        Wal->>DB: UPDATE merchant_balance<br/>totalOut += toSettle
        Wal->>DB: COMMIT
        Wal-->>MQ: publish wallet.settlement.completed<br/>{driverId, amount}
    end

    MQ-->>Notif: forward sự kiện
    Notif->>Notif: tổng hợp theo driver<br/>(daily digest)
    Notif-->>D: push "Tiền chờ xử lý đã được giải ngân: +X.XXX đ"

    Note over D: Frontend reload
    D->>Wal: GET /wallet/balance
    Wal-->>D: { availableBalance: ↑, pendingBalance: 0 }

    rect rgb(255, 243, 224)
    Note over Cron,DB: Edge case — debt detection
    Wal->>DB: SELECT DebtRecord<br/>WHERE dueDate < NOW()<br/>AND status = ACTIVE
    DB-->>Wal: overdue debts
    Wal->>DB: UPDATE DebtRecord SET status=OVERDUE
    Note over Wal: Driver app sẽ block goOnline<br/>nếu DriverWallet.balance < DEBT_LIMIT (-200K)
    end
```

## Logic chi tiết

| Trạng thái | Ý nghĩa | Action |
|----------|--------|--------|
| `PendingEarning.settledAt = NULL` | Chưa giải ngân | Cron đang check |
| `settleAt > NOW()` | Trong window 24h | Skip |
| `settleAt < NOW()`, `settledAt = NULL` | Quá hạn, chưa settle | Settle ngay |
| `settledAt != NULL` | Đã settle | Skip |

## Tăng tốc demo

```bash
# Force settle tất cả pending (giả lập 25h trôi qua)
docker exec cab-postgres psql -U postgres -d wallet_db \
  -c "UPDATE pending_earnings SET \"settleAt\" = NOW() - INTERVAL '25 hours' WHERE \"settledAt\" IS NULL;"
# Cron sẽ pick up trong vòng 5 phút, hoặc gọi trigger manually qua admin endpoint.
```
