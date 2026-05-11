# Auth Service — Internal Architecture

Bên trong `auth-service:3001` — quản lý OTP, JWT, refresh token.

```mermaid
graph TB
    GW["api-gateway"]

    subgraph AUTH["auth-service :3001"]
        direction TB

        subgraph CTRL["Controllers"]
            AC["AuthController"]
            UC["UserController"]
        end

        subgraph SVC["Domain Services"]
            OTP_SVC["OtpService<br/>generate · verify · rate-limit"]
            TOKEN_SVC["TokenService<br/>signAccess · signRefresh · rotate"]
            USER_SVC["UserService<br/>register · login · profile"]
            SESSION_SVC["SessionService<br/>track refresh families"]
        end

        subgraph CRYPTO["Crypto"]
            BCRYPT["bcrypt<br/>(password hash, 10 rounds)"]
            JWT_LIB["jsonwebtoken<br/>HS256 access · HS256 refresh"]
        end

        subgraph SMS["SMS Provider"]
            MOCK["mock mode<br/>OTP → stdout"]
            TWILIO["Twilio<br/>(production)"]
        end

        GRPC_SRV["gRPC Server :50051<br/>ValidateToken<br/>GetUserById"]
        DEV_EP["/dev/otp endpoint<br/>(test mode only)"]
    end

    PG[("auth_db<br/>users · refresh_tokens · otp_codes")]
    REDIS[("Redis<br/>otp:rate:{ip}<br/>otp:cache:{phone}")]
    MQ[("RabbitMQ<br/>user.registered")]

    GW -->|HTTP /api/auth/*| AC
    GW -.->|gRPC| GRPC_SRV

    AC --> OTP_SVC
    AC --> TOKEN_SVC
    AC --> USER_SVC
    UC --> USER_SVC

    OTP_SVC --> SMS
    OTP_SVC --- REDIS
    TOKEN_SVC --> JWT_LIB
    USER_SVC --> BCRYPT
    USER_SVC --> SESSION_SVC

    OTP_SVC --- PG
    TOKEN_SVC --- PG
    USER_SVC --- PG
    SESSION_SVC --- PG

    USER_SVC -.->|publish| MQ

    GRPC_SRV --> TOKEN_SVC
    GRPC_SRV --> USER_SVC
```

## Endpoints chính

| Endpoint | Mục đích |
|----------|---------|
| `POST /register-phone/start` | Sinh OTP + lưu Redis (rate-limited 10/60s/IP) |
| `POST /register-phone/verify` | Đối chiếu OTP, đánh dấu pre-registered |
| `POST /register-phone/complete` | Tạo user + bcrypt password + cấp tokens |
| `POST /login` | Verify password, cấp access (15m) + refresh (7d) |
| `POST /refresh` | Rotate refresh token (single-use family) |
| `gRPC ValidateToken` | Verify JWT cho service nội bộ |
