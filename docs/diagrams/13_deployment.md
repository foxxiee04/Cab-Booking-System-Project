# Deployment Topology — Docker Swarm trên EC2

```mermaid
graph TB
    subgraph Internet["Internet"]
        USERS["Users / Drivers / Admins\n(Browser, Mobile)"]
        HUB["Docker Hub\ncab-api-gateway\ncab-auth-service\ncab-ride-service\n..."]
    end

    subgraph EC2["AWS EC2 — Ubuntu 22.04 — Docker Swarm Manager"]
        subgraph Host["Host Layer"]
            NGINX["nginx :443\nTLS termination (Let's Encrypt)\nReverse proxy + static SPA serve\n(customer / driver / admin bundles)"]
        end

        subgraph Stack["Overlay Network — docker stack deploy"]
            subgraph GW_REPLICA["Gateway (× 2 replicas)"]
                GW1["cab-api-gateway\n:3000"]
                GW2["cab-api-gateway\n:3000"]
            end

            subgraph Services["Business Services (× 1 replica each)"]
                S1["cab-auth-service :3001"]
                S2["cab-ride-service :3002"]
                S3["cab-driver-service :3003"]
                S4["cab-payment-service :3004"]
                S5["cab-notification-service :3005"]
                S6["cab-wallet-service :3006"]
                S7["cab-user-service :3007"]
                S8["cab-booking-service :3008"]
                S9["cab-pricing-service :3009"]
                S10["cab-review-service :3010"]
            end

            subgraph Data["Data Layer (persistent volumes)"]
                PG[("PostgreSQL :5433\n7 databases\n(auth_db, ride_db, driver_db\npayment_db, wallet_db\nuser_db, booking_db)")]
                MG[("MongoDB :27017\nnotification_db\nreview_db")]
                RD[("Redis :6379\nGEO index\nSocket.IO adapter\nOTP cache")]
                MQ[("RabbitMQ :5672\ndomain-events exchange\nManagement UI :15672")]
            end
        end
    end

    USERS -->|"HTTPS :443"| NGINX
    NGINX -->|"reverse proxy"| GW_REPLICA
    HUB -.->|"docker pull on deploy"| GW_REPLICA
    HUB -.->|"docker pull on deploy"| Services

    GW_REPLICA <--> Services
    Services <--> Data
```

## DNS & Subdomain (foxgo.io.vn)

| Subdomain | Trỏ tới | Mục đích |
|-----------|---------|----------|
| `api.foxgo.io.vn` | EC2 IP :443 | REST API + Socket.IO |
| `foxgo.io.vn` | EC2 IP :443 | Customer SPA |
| `driver.foxgo.io.vn` | EC2 IP :443 | Driver SPA |
| `admin.foxgo.io.vn` | EC2 IP :443 | Admin Dashboard |
