# State Machine: Ride Lifecycle

Mọi thay đổi trạng thái Ride phải đi qua `ride-state-machine.ts` — không cập nhật `Ride.status` trực tiếp.

```mermaid
stateDiagram-v2
    [*] --> PENDING : booking.confirmed consumed\n→ ride-service tạo Ride mới

    PENDING --> ACCEPTED : Tài xế nhận offer\n(POST /rides/:id/accept)
    PENDING --> CANCELLED : Timeout / không tìm được tài xế\n(driver-matcher abort)

    ACCEPTED --> IN_PROGRESS : Tài xế bắt đầu chuyến\n(POST /rides/:id/start)
    ACCEPTED --> CANCELLED : Huỷ trước khi đón khách\n(customer hoặc driver cancel)

    IN_PROGRESS --> COMPLETED : Tài xế kết thúc chuyến\n(POST /rides/:id/complete)
    IN_PROGRESS --> CANCELLED : Huỷ khẩn cấp khi đang đi\n(hiếm, cần admin confirm)

    COMPLETED --> [*] : publish ride.completed\n→ trigger payment flow
    CANCELLED --> [*] : publish ride.cancelled\n→ trigger refund nếu đã thanh toán
```

## Các transition hợp lệ (VALID_TRANSITIONS)

| Từ trạng thái | Sang trạng thái | Điều kiện |
|---|---|---|
| PENDING | ACCEPTED | Driver accept offer |
| PENDING | CANCELLED | No driver / timeout |
| ACCEPTED | IN_PROGRESS | Driver starts trip |
| ACCEPTED | CANCELLED | Cancel before pickup |
| IN_PROGRESS | COMPLETED | Driver ends route |
| IN_PROGRESS | CANCELLED | Emergency cancel |
