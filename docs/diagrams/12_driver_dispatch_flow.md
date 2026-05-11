# Driver Dispatch Algorithm — Multi-Radius Matching

Thuật toán ghép xe 3 vòng bán kính mở rộng, với tính điểm đa tiêu chí.

```mermaid
flowchart TD
    START([ride.created consumed\nride → PENDING]) --> V1

    subgraph Round1["Vòng 1 — Bán kính 2km × tối đa 1 driver"]
        V1["Redis GEORADIUS 2km\n→ danh sách driver candidates"]
        V1 --> F1{"Có candidates?"}
        F1 -->|Không| V2_LABEL["→ Vòng 2"]
        F1 -->|Có| S1["Lọc: isOnline=true\n+ vehicleType khớp\n+ canAcceptRide (balance > DEBT_LIMIT)"]
        S1 --> SC1{"Candidates\nsau lọc?"}
        SC1 -->|Không| V2_LABEL
        SC1 -->|Có| AI1["Tính điểm từng driver\n40% khoảng cách\n25% rating\n15% idle time\n15% acceptance rate\n-5% cancel rate\n+AI p_accept (optional, 150ms timeout)"]
        AI1 --> PICK1["Chọn driver điểm cao nhất"]
        PICK1 --> OFFER1["Socket.IO: NEW_RIDE_AVAILABLE\n{rideId, pickup, fare, ETA}"]
        OFFER1 --> WAIT1{"Driver phản hồi\ntrong 30s?"}
        WAIT1 -->|"Chấp nhận"| ACCEPT
        WAIT1 -->|"Từ chối / timeout"| NEXT1{"Còn driver\nkhác trong vòng?"}
        NEXT1 -->|Có| PICK1
        NEXT1 -->|Không| V2_LABEL
    end

    subgraph Round2["Vòng 2 — Bán kính 3km × tối đa 3 drivers"]
        V2_LABEL --> V2["Redis GEORADIUS 3km"]
        V2 --> F2{"Có candidates\nmới?"}
        F2 -->|Không| V3_LABEL
        F2 -->|Có| SC2["Lọc + tính điểm\n(cùng công thức)"]
        SC2 --> OFFER2["Socket.IO offer → top 3 drivers\n(sequential, 30s mỗi driver)"]
        OFFER2 --> WAIT2{"Nhận được\nchấp nhận?"}
        WAIT2 -->|Có| ACCEPT
        WAIT2 -->|Không| V3_LABEL
    end

    subgraph Round3["Vòng 3 — Bán kính 5km × tối đa 5 drivers"]
        V3_LABEL --> V3["Redis GEORADIUS 5km"]
        V3 --> F3{"Có candidates\nmới?"}
        F3 -->|Không| FAIL
        F3 -->|Có| SC3["Lọc + tính điểm"]
        SC3 --> OFFER3["Socket.IO offer → top 5 drivers\n(sequential, 30s mỗi driver)"]
        OFFER3 --> WAIT3{"Nhận được\nchấp nhận?"}
        WAIT3 -->|Có| ACCEPT
        WAIT3 -->|Không| FAIL
    end

    ACCEPT(["Ride → ASSIGNED\nNotify khách hàng\nDispatch hoàn tất ✓"])
    FAIL(["Ride → CANCELLED\nNotify: không tìm được tài xế"])
```

## Công thức tính điểm

```
score = (1 - distRatio) × 0.40
      + rating / 5.0    × 0.25
      + idleRatio        × 0.15
      + acceptanceRate   × 0.15
      - cancelRate       × 0.05
      + AI_adjustment    (nếu MATCHING_AI_ADJUSTMENT_ENABLED=true)
```

> **Wallet Gate**: Trước khi offer, driver-service gọi payment-service `canAcceptRide` — từ chối tài xế có nợ quá `DEBT_LIMIT`.
