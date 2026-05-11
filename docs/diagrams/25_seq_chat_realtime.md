# Sequence — In-Ride Chat (Socket.IO Realtime)

Khách & tài xế nhắn tin trong chuyến đang chạy. Sử dụng Socket.IO room `ride:{rideId}`, persist tin nhắn vào ride-service, delivery ack.

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    actor D as Driver
    participant GW as api-gateway<br/>(Socket.IO Hub)
    participant Redis as Redis Adapter
    participant Ride as ride-service<br/>(REST persist)
    participant DB as ride_db

    Note over C,D: Cả 2 đã subscribe room ride:{rideId} sau khi accept
    C->>GW: socket.emit "join:ride" {rideId}
    GW->>Redis: subscribe ride:abc-123 (instance-aware)
    GW-->>C: ack joined
    D->>GW: socket.emit "join:ride" {rideId}
    GW-->>D: ack joined

    Note over C,DB: Customer gửi tin
    C->>GW: socket.emit "chat:send"<br/>{rideId, text: "đứng cổng B nhé"}
    GW->>Ride: POST /internal/rides/:id/chat<br/>(senderId=C, text)
    Ride->>DB: INSERT ChatMessage<br/>(rideId, senderId, senderRole=CUSTOMER, text, createdAt)
    Ride-->>GW: { messageId, createdAt }

    GW->>Redis: publish ride:abc-123 message
    Redis->>GW: fan-out to all subscribers<br/>(across gateway instances)
    GW-->>D: socket.emit "chat:new" {messageId, senderId, text, createdAt}
    GW-->>C: socket.emit "chat:ack" {messageId}<br/>(echo back to sender)

    Note over D,DB: Driver phản hồi
    D->>GW: socket.emit "chat:send"<br/>{rideId, text: "Dạ em sắp tới"}
    GW->>Ride: POST persist
    Ride->>DB: INSERT ChatMessage
    GW->>Redis: publish
    Redis->>GW: fan-out
    GW-->>C: socket.emit "chat:new" {...}
    GW-->>D: socket.emit "chat:ack"

    Note over C,DB: Reload page → load history
    C->>GW: GET /rides/:id/chat?limit=50
    GW->>Ride: forward
    Ride->>DB: SELECT ChatMessage<br/>ORDER BY createdAt DESC LIMIT 50
    Ride-->>C: messages[] (chronological)

    Note over C,D: Ride completed → close room
    Ride-->>GW: emit "ride:completed" rideId
    GW->>Redis: unsubscribe ride:abc-123<br/>(after 30s grace for late ack)
    GW-->>C: socket.emit "ride:closed"
    GW-->>D: socket.emit "ride:closed"
```

## Đặc điểm

- **Room model**: `ride:{rideId}` chứa cả 2 phía. Server tạo room khi `ride.accepted`, xoá sau `ride.completed`.
- **Redis adapter**: Cho phép horizontal scale gateway — message từ instance A vẫn fan-out sang client connect instance B.
- **Persist**: REST POST sang ride-service trước khi emit, đảm bảo message không mất khi reload.
- **Rate limit**: Per-socket 1 msg/500ms, max 200 msg/ride (anti-spam).
- **Ordering**: `createdAt` server-side timestamp; client sort khi load history.
