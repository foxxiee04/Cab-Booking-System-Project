# Diagrams V2 — FoxGo Cab Booking System

Bộ diagram cho luận văn, viết bằng Mermaid + render PNG (light theme).

## Render PNG

```bash
node docs/diagrams-v2/render.mjs           # render tất cả 32 diagram
node docs/diagrams-v2/render.mjs 15        # chỉ render file bắt đầu bằng "15"
```

Output: `docs/diagrams-v2/png/<basename>.png` (light bg, scale 2x, width 1800px).

Cấu hình theme: `mermaid.config.json` (đã setup nền trắng + màu pastel + chữ đen, dễ in báo cáo).

## Danh sách diagram (32 ảnh)

### Architecture & Domain (4)

| File | Loại | Mô tả |
|------|------|-------|
| [01_system_overview.md](./01_system_overview.md) | Architecture | Tổng quan kiến trúc toàn hệ thống |
| [02_service_domains.md](./02_service_domains.md) | Architecture | Phân nhóm 11 service theo domain |
| [03_communication_patterns.md](./03_communication_patterns.md) | Architecture | HTTP proxy / gRPC / RabbitMQ / internal HTTP |
| [14_ddd_subdomain.md](./14_ddd_subdomain.md) | DDD | Phân loại subdomain theo DDD |

### Service Internal Architecture (4) ★ mới

| File | Loại | Mô tả |
|------|------|-------|
| [15_svc_api_gateway.md](./15_svc_api_gateway.md) | Component | Gateway internals: middleware · routers · gRPC bridge · matcher · socket hub |
| [16_svc_auth.md](./16_svc_auth.md) | Component | auth-service: OTP store · JWT · refresh family · session |
| [17_svc_payment.md](./17_svc_payment.md) | Component | payment-service: idempotency · IPN handlers · voucher engine · commission |
| [18_svc_wallet.md](./18_svc_wallet.md) | Component | wallet-service: ledger · MerchantLedger · PendingEarning · DebtRecord · cron |

### Use Cases (1)

| File | Loại | Mô tả |
|------|------|-------|
| [04_use_cases.md](./04_use_cases.md) | Use Case | Hành trình 3 vai: Khách hàng / Tài xế / Admin |

### Sequences (10) — ★ thêm 7 cái mới

| File | Loại | Mô tả |
|------|------|-------|
| [05_seq_booking_dispatch.md](./05_seq_booking_dispatch.md) | Sequence | Đặt xe → giao chuyến → tài xế nhận |
| [06_seq_auth_otp.md](./06_seq_auth_otp.md) | Sequence | Đăng ký / đăng nhập bằng OTP |
| [07_seq_payment_complete.md](./07_seq_payment_complete.md) | Sequence | Thanh toán sau khi hoàn thành chuyến |
| [19_seq_driver_registration.md](./19_seq_driver_registration.md) | Sequence ★ | Đăng ký driver → admin duyệt → kích hoạt ví → goOnline |
| [20_seq_wallet_topup.md](./20_seq_wallet_topup.md) | Sequence ★ | Nạp ví MoMo → IPN → sync 2 DB |
| [21_seq_ride_cancel.md](./21_seq_ride_cancel.md) | Sequence ★ | 3 luồng huỷ: customer free / customer penalty / driver penalty |
| [22_seq_withdrawal.md](./22_seq_withdrawal.md) | Sequence ★ | Driver rút tiền → admin approve → BankTransaction |
| [23_seq_settlement_t24h.md](./23_seq_settlement_t24h.md) | Sequence ★ | Cron T+24h move PendingEarning → availableBalance |
| [24_seq_voucher_redeem.md](./24_seq_voucher_redeem.md) | Sequence ★ | Apply voucher → discount → Voucher.usedCount + MerchantLedger VOUCHER |
| [25_seq_chat_realtime.md](./25_seq_chat_realtime.md) | Sequence ★ | In-ride chat: Socket.IO room ride:{id} + persist + ack |

### State Machines (4) — ★ thêm 2 cái mới

| File | Loại | Mô tả |
|------|------|-------|
| [08_stm_ride.md](./08_stm_ride.md) | State Machine | Ride: CREATED → ... → COMPLETED |
| [09_stm_wallet.md](./09_stm_wallet.md) | State Machine | Wallet: INACTIVE → ACTIVE → BLOCKED |
| [26_stm_payment.md](./26_stm_payment.md) | State Machine ★ | Payment: INITIATED → PENDING → COMPLETED/FAILED/REFUNDED |
| [27_stm_driver_availability.md](./27_stm_driver_availability.md) | State Machine ★ | Driver: OFFLINE → ONLINE → BUSY |

### Data & Events (2)

| File | Loại | Mô tả |
|------|------|-------|
| [10_erd_core.md](./10_erd_core.md) | ERD | Entity cốt lõi giữa các bounded context |
| [11_rabbitmq_events.md](./11_rabbitmq_events.md) | Event Flow | Producer → Exchange → Consumer |

### Algorithm (1)

| File | Loại | Mô tả |
|------|------|-------|
| [12_driver_dispatch_flow.md](./12_driver_dispatch_flow.md) | Flowchart | Thuật toán ghép xe đa vòng bán kính 2km×1, 3km×3, 5km×5 |

### Deployment (3) — ★ thêm 2 cái mới

| File | Loại | Mô tả |
|------|------|-------|
| [13_deployment.md](./13_deployment.md) | Deployment | Triển khai Docker Swarm trên EC2 |
| [28_deploy_compose_dev.md](./28_deploy_compose_dev.md) | Deployment ★ | Docker Compose dev environment + Vite dev servers |
| [29_deploy_cicd.md](./29_deploy_cicd.md) | Deployment ★ | Build pipeline & rolling deploy với rollback |

### Monitoring (3) — ★ tất cả mới

| File | Loại | Mô tả |
|------|------|-------|
| [30_mon_logs_flow.md](./30_mon_logs_flow.md) | Monitoring ★ | Log pipeline: stdout → Docker → tooling, structured JSON |
| [31_mon_health_checks.md](./31_mon_health_checks.md) | Monitoring ★ | Health endpoint map per service · Docker healthcheck · admin aggregator |
| [32_mon_metrics_stack.md](./32_mon_metrics_stack.md) | Monitoring ★ | Prometheus + Grafana stack (proposed) — metrics + alert rules đề xuất |

---

## Ảnh cũ trong `docs/diagram/` — đánh giá lọc

### Giữ lại (17 ảnh chất lượng tốt)

| File | Lý do giữ |
|------|-----------|
| system_architecture_overview.png | Tổng quan đầy đủ nhất |
| arch_ms_comm_flow.png | Mô tả rõ luồng giao tiếp |
| arch_ms_port_map.png | Bảng port HTTP + gRPC chính xác |
| arch_component_domain_group.png | Phân nhóm service rõ ràng |
| seq_booking_confirm_dispatch.png | Sequence booking hoàn chỉnh |
| seq_auth_otp_register_reset.png | Sequence OTP tốt |
| seq_payment_after_ride_complete.png | Sequence thanh toán rất chi tiết |
| seq_dispatch_matching_offer.png | Chi tiết luồng dispatch |
| seq_driver_registration_approval.png | Luồng duyệt tài xế |
| stm_ride_transitions.png | State machine ride sạch đẹp |
| stm_wallet_fintech.png | State machine wallet |
| erd_core_bounded_contexts.png | ERD tổng quan các context |
| evt_rabbitmq_consumers.png | Event flow RabbitMQ rõ |
| flow_dispatch_multi_radius_rounds.png | Flowchart thuật toán ghép xe |
| deploy_docker_swarm_topology.png | Topology triển khai thực tế |
| ddd_subdomain_map.png | DDD subdomain sạch |
| uc_journey_roles_en.png | Use case theo vai |

### Bỏ (40 ảnh — trùng lặp, xấu, hoặc không liên quan)

| File | Lý do bỏ |
|------|----------|
| xacsuatnhancuoc.png | AI/ML pipeline nội bộ, không cần trong docs |
| ai_agent_rag_retrieval.png | Chi tiết kỹ thuật AI nội bộ |
| ai_ml_sklearn_train_infer_pipeline.png | Chi tiết kỹ thuật AI nội bộ |
| bpmn_booking_swimlanes.png | Layout BPMN lạ, thay bằng sequence |
| dp_pattern_catalog.png | Quá thưa, thiếu thông tin |
| act_booking_end_to_end.png | Trùng với seq_booking (ít chi tiết hơn) |
| act_payment_by_method.png | Trùng với seq_payment |
| act_payment_cash_vs_online.png | Trùng với seq_payment |
| act_payment_online_saga.png | Trùng với seq_payment |
| arch_integration_pattern_map.png | Trùng với arch_ms_comm_flow |
| arch_layers_services_infra.png | Trùng với system_overview |
| arch_realtime_socket_webrtc.png | WebRTC không được dùng thực tế |
| arch_scalability_approach.png | Trùng lặp nội dung |
| class_driver_aggregate.png | Trùng ERD driver_service_db |
| class_payment_aggregate.png | Trùng ERD payment_service_db |
| class_ride_aggregate.png | Trùng ERD ride_service_db |
| class_wallet_aggregate.png | Trùng ERD wallet_service_db |
| data_ownership_per_service.png | Thông tin có trong CLAUDE.md |
| ddd_aggregate_root_map.png | Trùng ddd_bc_service_map |
| ddd_bc_service_map.png | Trùng ddd_subdomain_map (ít chuẩn DDD hơn) |
| ddd_context_pub_sub.png | Trùng evt_rabbitmq_consumers |
| deploy_aws_reference_ecs.png | Không dùng AWS ECS thực tế |
| deploy_aws_topology_target.png | Không dùng AWS thực tế |
| deploy_swarm_aws_asbuilt.png | Trùng deploy_docker_swarm_topology |
| erd_driver_service_db.png | Chi tiết quá, trùng erd_core |
| erd_payment_service_db.png | Chi tiết quá, trùng erd_core |
| erd_ride_chat_schema.png | Schema chat không liên quan chức năng chính |
| erd_ride_service_db.png | Chi tiết quá, trùng erd_core |
| erd_wallet_service_db.png | Chi tiết quá, trùng erd_core |
| eta.png | Tên không rõ nghĩa, nội dung mơ hồ |
| flow_driver_matching_radius.png | Trùng flow_dispatch_multi_radius_rounds |
| flow_wallet_pending_tplus24.png | Covered trong seq_payment_after_ride |
| graph_wallet_layered_services.png | Trùng arch_ms_port_map |
| gw_component_internal_stack.png | Chi tiết nội bộ gateway không cần thiết |
| gw_graph_internal_components.png | Trùng gw_component_internal_stack |
| mon_prometheus_grafana_stack.png | Monitoring stack, không cần trong thesis chính |
| sec_trust_boundary_multitier.png | Security diagram mờ, thiếu chi tiết |
| seq_payment_ipn_idempotent.png | Covered trong seq_payment_after_ride |
| seq_webrtc_signaling_gateway.png | WebRTC không được dùng thực tế |
| stm_ride_statemachine_code.png | Trùng stm_ride_transitions (phiên bản code) |
| cicd_github_actions_docker.png | CI/CD chưa implement đầy đủ |
