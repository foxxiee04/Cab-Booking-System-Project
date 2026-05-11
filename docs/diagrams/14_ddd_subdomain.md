# DDD — Phân loại Subdomain & Bounded Context

```mermaid
graph TB
    subgraph core["Core Domain — Lợi thế cạnh tranh chính"]
        direction LR
        C1["Ride Lifecycle\n(ride-service)\nQuản lý vòng đời chuyến đi\nvà state machine"]
        C2["Driver Matching Supply\n(api-gateway matcher)\nThuật toán ghép xe đa vòng\nbán kính + tính điểm AI"]
        C3["Surge Pricing\n(pricing-service)\nTính giá động theo\ncung cầu thời gian thực"]
    end

    subgraph supporting["Supporting Domain — Hỗ trợ Core"]
        direction LR
        S1["Booking Quote\n(booking-service)\nTạo draft, xác nhận\nước tính giá"]
        S2["Payment Settlement\n(payment-service)\nMoMo/VNPay IPN\nIdempotency saga"]
        S3["Driver Wallet\n(wallet-service)\nT+24h settlement\nhuê hồng, rút tiền"]
    end

    subgraph generic["Generic Subdomain — Dùng giải pháp có sẵn"]
        direction LR
        G1["Identity & Access\n(auth-service)\nOTP, JWT, refresh token"]
        G2["Notification\n(notification-service)\nPush, in-app (Firebase/APNS)"]
        G3["Review & Rating\n(review-service)\nĐánh giá sau chuyến"]
        G4["User Profile\n(user-service)\nThông tin cá nhân, avatar"]
    end

    subgraph optional["Optional / Experimental"]
        AI["AI Layer\n(ai-service — Python)\nSurge prediction (scikit-learn)\nRAG chat (FAISS + LLaMA)\nRoute tips, accept probability"]
    end

    core -->|"triggers"| supporting
    generic -->|"enables"| core
    core -.->|"AI score input"| optional
    supporting -.->|"earn data → ML"| optional
```

## Mapping Service → Domain Type

| Service | Domain Type | Justification |
|---------|-------------|---------------|
| ride-service | **Core** | State machine chuyến đi là business logic độc quyền |
| api-gateway (matcher) | **Core** | Thuật toán ghép xe là differentiator chính |
| pricing-service | **Core** | Surge pricing tạo doanh thu |
| booking-service | **Supporting** | Orchestrate quote + confirm |
| payment-service | **Supporting** | Payment gateway integration |
| wallet-service | **Supporting** | Commission + settlement fintech |
| auth-service | **Generic** | OTP auth — có thể dùng service có sẵn |
| notification-service | **Generic** | Push notification — Firebase SDK |
| review-service | **Generic** | Rating — standard CRUD |
| user-service | **Generic** | Profile management |
| ai-service | **Experimental** | Optional, 150ms timeout + fallback |
