# THIẾT KẾ VÀ XÂY DỰNG HỆ THỐNG ĐẶT XE TRỰC TUYẾN

> **Bản báo cáo Markdown đầy đủ (single source)** — tổng hợp phân tích, thiết kế DDD, kiến trúc, giải pháp công nghệ, hiện thực, đánh giá và phụ lục, **đồng bộ với mã nguồn** kho `Cab-Booking-System-Project` (microservices Node.js/TypeScript, frontend React, AI FastAPI, Docker Compose / Docker Swarm AWS).  
> Điền `[...]` = thông tin cá nhân sinh viên, giảng viên, ngày bảo vệ.

---

## HƯỚNG DẪN DÙNG FILE NÀY ĐỂ DÀN TRANG WORD

File này được viết theo hướng có thể sao chép sang Microsoft Word và định dạng lại theo mẫu khóa luận. Khi đưa sang Word, nên giữ cấu trúc chương/mục hiện có, sau đó chèn hình từ thư mục **`img/`** (gốc repo, cùng cấp với `docs/`) theo bảng gợi ý dưới đây — **không tạo thêm thư mục ảnh mới**; nếu cần hình bổ sung, xuất PNG và đặt tên theo quy ước **`{loại}_{chức_năng}_….png`** (xem **Danh mục hình** phía dưới), rồi cập nhật bảng gợi ý. Các đoạn `![Hình ...](../img/...)` trong file là vị trí gợi ý chèn ảnh; nếu Word không tự nhận Markdown image, dùng **Insert > Pictures** và chọn đúng file trong `img/`.

**Gói Markdown + ảnh chỉ trong `docs/`:** chạy `npm run docs:bao-cao-bundle` — tạo thư mục `docs/bao-cao-bundle/` gồm `bao-cao-kltn.md` (đường dẫn hình dạng `img/...`) và `img/*.png` tương ứng; có thể nén riêng `bao-cao-bundle` để nộp.

### Danh mục hình (`img/`) — quy ước tên: `{loại}_{chức_năng}_…`

**Tiền tố loại (sắp nhóm):** `arch_` kiến trúc tổng thể/lớp/realtime; `uc_` use case / hành trình người dùng; `act_` activity; `bpmn_` swimlane; `seq_` sequence; `flow_` luồng nghiệp vụ; `stm_` state machine; `evt_` sự kiện / event flow; `erd_` CSDL; `class_` class diagram; `ddd_` DDD subdomain/context; `gw_` API Gateway; `data_` kiến trúc dữ liệu; `graph_` đồ thị thành phần; `deploy_` triển khai; `cicd_` CI/CD; `sec_` bảo mật; `ai_` mô hình ML / agent RAG.

| Tên file | Loại | Chức năng / khi dùng | Tham chiếu trong file này |
|---|---|---|---|
| `arch_system_overview.png` | Kiến trúc | Tổng quan hệ thống các service | **Hình 4.2**, bảng HƯỚNG DẪN Ch.4 |
| `arch_realtime_socket_webrtc.png` | Kiến trúc | Socket.IO, WebRTC, realtime | **Hình 3.10**, bảng Ch.5 realtime |
| `arch_layers_services_infra.png` | Kiến trúc | Lớp presentation / gateway / service / data | Ảnh Mermaid sau **§4.6** |
| `data_db_per_service_overview.png` | Dữ liệu | DB-per-service, Redis, MQ | **Hình 4.6**, §4.10 |
| `deploy_aws_reference_ecs.png` | Triển khai | AWS tham chiếu (ECS/RDS/…) | **Hình 6.2**, bảng HƯỚNG DẪN |
| `deploy_swarm_aws_asbuilt.png` | Triển khai | Swarm thực tế, DNS, CI/CD | Bảng HƯỚNG DẪN; §6.9 |
| `deploy_aws_topology_target.png` | Triển khai | Topology mục tiêu | Bảng HƯỚNG DẪN |
| `cicd_github_actions_docker.png` | CI/CD | GitHub Actions → Docker Hub → deploy | Bảng HƯỚNG DẪN; Phần 10 đề cương |
| `sec_trust_boundary_multitier.png` | Bảo mật | Trust boundary đa tầng | **Hình 6.1** |
| `uc_journey_roles_en.png` | Use case | Hành trình EN + core platform | **Hình 3.1** |
| `uc_system_usecases_vn.png` | Use case | UC tiếng Việt trong hệ thống đặt xe | Ảnh Mermaid **§3.2** |
| `seq_auth_otp_register_reset.png` | Sequence | OTP đăng ký / reset mật khẩu | **Hình 3.2** |
| `act_booking_end_to_end.png` | Activity | Luồng đặt xe end-to-end | **Hình 3.3** |
| `bpmn_booking_swimlanes.png` | BPMN | Swimlane khách / tài xế / hệ thống | **Hình 3.4** |
| `flow_driver_matching_radius.png` | Flowchart | Điều phối bán kính, scoring | **Hình 3.5**, **Hình 4.5** (lặp lại cùng file) |
| `stm_ride_lifecycle_simple.png` | State machine | Vòng đời ride dạng rút gọn | **Hình 3.6**, **Hình 4.3** (lặp) |
| `seq_booking_payment_overview.png` | Sequence | Booking và thanh toán tổng quan | **Hình 3.7**, **Hình 4.4** (lặp) |
| `act_payment_by_method.png` | Activity | Nhánh thanh toán CASH/MoMo/VNPay | **Hình 3.8** |
| `stm_wallet_fintech.png` | State machine | Trạng thái ví, pending, settlement | **Hình 3.9** |
| `evt_rabbitmq_domain_flow.png` | Event | Domain events qua RabbitMQ | **Hình 4.1** |
| `erd_core_bounded_contexts.png` | ERD | Quan hệ lõi giữa các BC | **Hình 4.7** |
| `gw_routing_map.png` | Gateway | Bảng định tuyến | **Hình 4.8** |
| `gw_component_internal_stack.png` | Gateway | Component nội bộ gateway | **Hình 4.9** |
| `ai_ml_sklearn_train_infer_pipeline.png` | AI / ML | **INPUT** train / **MODEL** sklearn+joblib / **OUTPUT** artifact; **INPUT** API / **OUTPUT** JSON suy luận | **Hình 3.11**, **§5.8**, **§4.11.12** |
| `ai_agent_rag_retrieval.png` | AI Agent | **INPUT** query + KB / RAG / **OUTPUT** câu trả lời | **Hình 3.12**, **§5.8** |
| `ddd_subdomain_classification.png` | DDD | Phân loại subdomain | **§4.1** |
| `ddd_context_map.png` | DDD | Context map | **§4.3** |
| `class_ride_aggregate.png` | Class | Ride context | **§4.4.1** |
| `class_driver_aggregate.png` | Class | Driver context | **§4.4.2** |
| `class_wallet_aggregate.png` | Class | Wallet context | **§4.4.3** |
| `class_payment_aggregate.png` | Class | Payment context | **§4.4.4** |
| `evt_domain_catalog_graph.png` | Event | Danh mục domain events | Sau **§4.5** |
| `stm_ride_statemachine_code.png` | State machine | Ride khớp mã (CREATED/FINDING_DRIVER/…) | **§4.3** (sau Hình 4.3 đơn giản) |
| `seq_payment_after_ride_complete.png` | Sequence | Thanh toán sau `ride.completed` | **§4.7** |
| `seq_dispatch_matching_offer.png` | Sequence | Dispatch offer tài xế | **§4.x** kèm **Hình 4.5** |
| `erd_ride_service_db.png` | ERD | `ride_db` | **§4.10** |
| `erd_wallet_service_db.png` | ERD | `wallet_db` | **§4.10** |
| `erd_payment_service_db.png` | ERD | `payment_db` | **§4.10** |
| `erd_driver_service_db.png` | ERD | `driver_db` | **§4.10** |
| `flow_dispatch_multi_radius_rounds.png` | Flowchart | Nhiều vòng bán kính | **§5.x** dispatch |
| `seq_payment_ipn_idempotent.png` | Sequence | IPN idempotent | **§5.2** |
| `flow_wallet_pending_tplus24.png` | Flowchart | Pending T+24h | **§5.3** |
| `seq_webrtc_signaling_gateway.png` | Sequence | WebRTC signaling | **§5.x** realtime |
| `gw_graph_internal_components.png` | Graph | Nội bộ gateway | **Ch. 6** |
| `graph_wallet_layered_services.png` | Graph | Lớp wallet service | **Ch. 6** / ví |
| `seq_driver_registration_approval.png` | Sequence | Đăng ký / duyệt tài xế | **Ch. 6** |

Đồng bộ tên file sau khi đổi: `node scripts/apply-img-taxonomy.mjs` (chỉ chạy khi sửa map trong script). Đổi nhóm Mermaid xuất từ báo cáo: `scripts/export-bao-cao-mermaid.mjs`. **Đối chiếu ảnh / mapping:** `node scripts/verify-bao-cao-img-refs.mjs` (mọi `../img/*.png` trong file này phải có trong `img/`; 23 PNG từ khối Mermaid trong báo cáo phải khớp `docs/diagrams/mermaid/report-mermaid-png-mapping.json`).

| Vị trí trong báo cáo | Hình nên chèn | Mục đích sử dụng |
|---|---|---|
| Chương 3, sau mục 3.2 | `img/uc_journey_roles_en.png` | Tổng quan tác nhân và use case chính của khách hàng, tài xế, quản trị viên |
| Chương 3, luồng đặt xe | `img/act_booking_end_to_end.png` | Mô tả activity flow khách đặt xe, hệ thống tính giá, tìm tài xế và hoàn thành chuyến |
| Chương 3, luồng nghiệp vụ đa vai trò | `img/bpmn_booking_swimlanes.png` | Thể hiện swimlane khách hàng, tài xế và hệ thống trong một chuyến đi |
| Chương 4, kiến trúc tổng thể | `img/arch_system_overview.png` | Hình kiến trúc hệ thống tổng quan, phù hợp đặt ở đầu chương thiết kế |
| Chương 4, kiến trúc dữ liệu | `img/data_db_per_service_overview.png` | Thể hiện database-per-service, Redis, RabbitMQ, MongoDB |
| Chương 4, context/event flow | `img/evt_rabbitmq_domain_flow.png` | Minh họa luồng domain event qua RabbitMQ |
| Chương 4, state machine chuyến đi | `img/stm_ride_lifecycle_simple.png` | Minh họa vòng đời Ride và các trạng thái hợp lệ |
| Chương 4, state machine ví | `img/stm_wallet_fintech.png` | Minh họa trạng thái ví, pending balance, settlement |
| Chương 4, ERD lõi | `img/erd_core_bounded_contexts.png` | Sơ đồ quan hệ dữ liệu lõi giữa user, driver, booking, ride, payment, wallet |
| Chương 5, thuật toán matching | `img/flow_driver_matching_radius.png` | Luồng tìm tài xế theo bán kính, scoring và offer |
| Chương 5, thanh toán | `img/seq_booking_payment_overview.png`, `img/act_payment_by_method.png` | Trình bày luồng booking-payment và nhánh CASH/MoMo/VNPay |
| Chương 5, realtime | `img/arch_realtime_socket_webrtc.png` | Chat, Socket.IO, WebRTC signaling và broadcast trạng thái |
| Chương 5, AI/RAG | `img/ai_ml_sklearn_train_infer_pipeline.png`, `img/ai_agent_rag_retrieval.png` | Train sklearn/joblib + suy luận API; Agent RAG INPUT/KB → OUTPUT trả lời (Mermaid nguồn: `docs/diagrams/mermaid/source/`) |
| Chương 6, API Gateway | `img/gw_routing_map.png`, `img/gw_component_internal_stack.png` | Bảng định tuyến và component nội bộ Gateway |
| Chương 6, xác thực OTP | `img/seq_auth_otp_register_reset.png` | Sequence đăng ký và reset mật khẩu bằng OTP |
| Chương 6, bảo mật | `img/sec_trust_boundary_multitier.png` | Vùng tin cậy bảo mật giữa client, gateway, service và data layer |
| Chương 6 hoặc Hướng phát triển | `img/deploy_aws_reference_ecs.png` | Kiến trúc triển khai cloud đề xuất (tham chiếu) |
| Chương 6, triển khai Swarm thực tế | `img/deploy_swarm_aws_asbuilt.png` | Luồng DNS → Docker Swarm AWS, CI/CD SSH (theo `deploy/SWARM-SETUP.md`) |
| Chương 6 hoặc 7, topology mục tiêu | `img/deploy_aws_topology_target.png` | Topology/hạ tầng tham chiếu (nếu dùng trong báo cáo) |
| Chương 6, CI/CD | `img/cicd_github_actions_docker.png` | Pipeline GitHub Actions → Docker Hub → deploy |
| Các mục **Ch. 3–6** (xuất Mermaid) | Xem **§ Danh mục hình** và `report-mermaid-png-mapping.json` (23 file: `uc_system_usecases_vn.png` … `seq_driver_registration_approval.png`) | PNG nền trắng; script `scripts/export-bao-cao-mermaid.mjs`; `--keep-mmd` → `docs/diagrams/mermaid/mermaid-export-staging/` |

### Ánh xạ 12 phần nội dung (theo đề cương giảng viên) → chương/mục trong file này

Cấu trúc **Chương 1–8** của báo cáo giữ nguyên. Mười hai phần dưới đây **lồng ghép** bằng cách: (i) mỗi phần trỏ tới **đúng mục đã có**; (ii) các mục **4.0, 4.12–4.13, 5.6–5.8, 6.8–6.9, 7.4** bổ sung cho đủ checklist phân tích/triển khai (§**7.3** là thảo luận, §**7.4** là khả năng mở rộng). Khi dàn Word, có thể đặt tiêu đề «Phần 1… Phần 12» trong mục lục hoặc chỉ dùng bảng này làm «mục lục song song».

| Phần (đề cương) | Nội dung | Vị trí trong `bao-cao-kltn.md` |
|---|---|---|
| **1** Đặt vấn đề, phạm vi | Bối cảnh, lý do đề tài, mục tiêu, phạm vi | **Chương 1** (§1.1–1.3) |
| **2** Thu thập yêu cầu, khảo sát nghiệp vụ | Actors, use case, bảng chức năng, quy trình nghiệp vụ (end-to-end) | **Chương 3** (§3.1–3.6; khảo sát chi tiết §3.6) |
| **3** Phân tích DDD (12 bước con) | Xem **§4.0** bảng lộ trình: tác nhân/use case (lặp lại từ Ch.3), subdomain §4.1, BC §4.4+§4.11, context map §4.3, domain model §4.4, aggregate §4.12, microservice §4.11, giao tiếp/tích hợp §4.13 (+ Ch.2 lý thuyết), data ownership §4.10, refine/validate **Chương 7** | **Chương 4** là xương sống; **Chương 2** là nền lý thuyết; **Chương 7** là đánh giá |
| **4** Thiết kế kiến trúc hệ thống (SAD) | Kiến trúc lớp, gateway, luồng chính, sequence | **§4.6** và các sequence §4.7–4.9; hiện thực **Chương 6** |
| **5** Các mẫu thiết kế phần mềm | Pattern đã áp dụng trong code | **§5.6 Chương 5** |
| **6** Tối ưu giao dịch / thanh toán (MSA) | Idempotency, outbox, pending, eventual consistency | **§5.7** tổng hợp; chi tiết **§5.2–5.3** |
| **7** Ứng dụng AI / pipeline | Surge, matching hỗ trợ, RAG chatbot | **§5.8**; chi tiết **§4.11.12**, **§3.6.9**; `img/ai_ml_sklearn_train_infer_pipeline.png`, `img/ai_agent_rag_retrieval.png` |
| **8** Giám sát hệ thống | Prometheus, Grafana, node metrics | **§6.8 Chương 6** |
| **9** Bảo mật thông tin, dữ liệu | Trust boundary, JWT, IPN, nội bộ | **§6.7.1**; `img/sec_trust_boundary_multitier.png` |
| **10** Cài đặt và triển khai (CI/CD) | GitHub Actions, Docker, Swarm | **§6.9**; `img/cicd_github_actions_docker.png`, `img/deploy_swarm_aws_asbuilt.png` |
| **11** Tối ưu mở rộng (scalability) | Stateless, scale service, Swarm | **Chương 7 §7.4** |
| **12** Kết luận | Tổng kết, hạn chế, hướng phát triển | **Chương 8** |

---

## ABSTRACT

**DESIGN AND DEVELOPMENT OF AN ONLINE CAB BOOKING SYSTEM**

**Context and aim.** Applications for on-demand mobility rely on low-latency matching, reliable payments across distributed components, and explicit domain boundaries. This graduation thesis presents the analysis, architectural design, and implementation of an online cab booking system that emulates industry-grade flows at a scale appropriate for final-year assessment.

**Approach.** Requirements and business processes are structured using Domain-Driven Design (DDD): bounded contexts drive service decomposition. The implemented system adopts a microservice style on the Node.js/TypeScript stack (eleven services), a complementary Python/FastAPI component for optional analytics and retrieval-augmented user assistance, and three React single-page front ends. Persistent state is split per service (PostgreSQL and MongoDB); Redis supports geospatial driver search, caching, and Socket.IO scaling; RabbitMQ carries asynchronous domain events. Synchronous calls use HTTP and gRPC as needed through a single API Gateway responsible for security, routing, WebSockets, and dispatch logic.

**Scope of the report.** The document covers context mapping, core domain models (ride lifecycle with a validating state machine, driver, wallet, payment), integration patterns (transactional outbox, idempotent handling of MoMo and VNPay notifications), multi-round radius-based dispatch with weighted scoring, wallet policies (deposit, T+24h pending earnings, dated cash-ride obligations, FIFO settlement), and in-trip messaging with WebRTC signaling. Engineering practices for observability, continuous integration and delivery, and an illustrative Docker Swarm deployment on cloud infrastructure are also described.

**Findings.** Tests on the delivered software indicate that matching terminates within the designed search rounds under simulated load, repeated payment callbacks do not create duplicate monetary effects, and wallet rules respect the intended order between debt clearance and release to withdrawable funds.

**Keywords:** ride-hailing, Domain-Driven Design, microservices, geospatial dispatch, idempotent payment, driver wallet, WebRTC, Node.js, React, Docker

---

## TÓM TẮT

**THIẾT KẾ VÀ XÂY DỰNG HỆ THỐNG ĐẶT XE TRỰC TUYẾN**

**Bối cảnh và mục tiêu.** Ứng dụng đặt xe theo nhu cầu đặt ra yêu cầu ghép cặp đáp ứng nhanh, xử lý thanh toán tin cậy trên nhiều thành phần phân tán và ranh giới miền nghiệp vụ rõ ràng. Khóa luận trình bày quá trình phân tích, thiết kế kiến trúc và cài đặt một hệ thống đặt xe trực tuyến trên nền web, phục vụ mục đích đào tạo và đánh giá cuối khóa.

**Phương pháp.** Các yêu cầu và quy trình được hệ thống hóa theo Thiết kế hướng lĩnh vực (DDD): bounded context là cơ sở phân rã dịch vụ. Hệ thống hiện thực theo kiến trúc vi dịch vụ gồm mười một dịch vụ Node.js/TypeScript, một thành phần Python/FastAPI cho các chức năng dự đoán và hỗ trợ người dùng kiểu RAG (tùy cấu hình), cùng ba ứng dụng đơn trang React cho khách hàng, tài xế và quản trị. Dữ liệu được tách theo dịch vụ (PostgreSQL, MongoDB); Redis phục vụ truy vấn địa lý, bộ nhớ đệm và mở rộng Socket.IO; RabbitMQ vận chuyển sự kiện miền bất đồng bộ. Giao tiếp đồng bộ kết hợp HTTP và gRPC; một API Gateway thống nhất xử lý bảo mật, định tuyến, WebSocket và logic điều phối.

**Phạm vi nội dung báo cáo.** Văn bản trình bày đặc tả yêu cầu, bản đồ ngữ cảnh, mô hình miền cho các context trọng tâm (vòng đời chuyến đi với máy trạng thái, tài xế, ví, thanh toán), nguyên tắc mỗi dịch vụ sở hữu một cơ sở dữ liệu riêng, các mẫu tích hợp như transactional outbox và xử lý thông báo thanh toán bất biến đối với MoMo và VNPay, chính sách điều phối đa vòng theo bán kính và hàm điểm, cơ chế ví tài xế (ký quỹ, giữ thu nhập T+24h, công nợ chuyến tiền mặt có thời hạn, tất toán FIFO), cùng trao đổi trong chuyến và báo hiệu thoại WebRTC. Phần công nghệ vận hành gồm giám sát (Prometheus, Grafana), CI/CD và minh họa triển khai Docker Swarm trên hạ tầng đám mây.

**Kết quả đạt được.** Kiểm thử chức năng và tích hợp trên bản hiện thực cho thấy bước ghép cặp kết thúc trong số vòng tìm kiếm đã cấu hình trong điều kiện thử nghiệm, gọi lặp callback thanh toán không tạo hiệu ứng ghi có trùng, và quy tắc quyết toán ví tuân thức trừ nợ trước khi chuyển phần khả dụng để rút.

**Từ khóa:** đặt xe trực tuyến, thiết kế hướng lĩnh vực, kiến trúc vi dịch vụ, điều phối địa lý, thanh toán bất biến, ví tài xế, WebRTC, Node.js, React, Docker

---

## LỜI CẢM ƠN

Chúng em xin trân trọng cảm ơn **[Học hàm — Họ và tên Giảng viên hướng dẫn]**, người đã tận tình hướng dẫn chọn hướng đề tài, định hình phương pháp phân tích và thiết kế hệ thống theo hướng miền (DDD) cũng như kiến trúc vi dịch vụ; đồng thời thường xuyên góp ý chuyên môn, kiểm tra tiến độ và tạo điều kiện để chúng em hoàn thành khóa luận tốt nghiệp.

Xin cảm ơn quý **Thầy, Cô Khoa Công nghệ Thông tin**, **Trường Đại học Công nghiệp Thành phố Hồ Chí Minh**, đã trang bị kiến thức nền tảng và chuyên sâu trong suốt quá trình đào tạo, giúp chúng em đủ năng lực lý thuyết và thực hành để triển khai đồ án.

Chúng em kính ghi nhận sự quan tâm của **Ban Giám hiệu**, **Phòng Đào tạo** và các đơn vị liên quan đã tạo môi trường học tập, thí nghiệm và tra cứu tài liệu thuận lợi.

Xin được cảm ơn **gia đình** đã động viên về vật chất và tinh thần; **bạn bè và tập thể lớp** đã trao đổi, hỗ trợ trong học tập và hoàn thiện báo cáo.

Do thời gian và kinh nghiệm còn hạn chế, khóa luận không tránh khỏi thiếu sót. Chúng em kính mong nhận được ý kiến đóng góp của quý Thầy, Cô hội đồng và bạn đọc để đề tài được hoàn thiện hơn.

| | |
|---|---|
| **TP. Hồ Chí Minh,** | ngày … tháng … năm 2026 |
| **Sinh viên thực hiện** | *[Chữ ký]* |
| | **[Họ và tên]** |
| | MSSV: **[……]** |
| | *(Nếu nhóm 2 thành viên: lặp khối trên cho sinh viên thứ hai)* |

---

## DANH MỤC CÁC THUẬT NGỮ VIẾT TẮT

| Viết tắt | Đầy đủ | Nghĩa |
|---|---|---|
| DDD | Domain-Driven Design | Thiết kế hướng lĩnh vực |
| BC | Bounded Context | Ngữ cảnh giới hạn (trong DDD) |
| AR | Aggregate Root | Gốc tập hợp (trong DDD) |
| VO | Value Object | Đối tượng giá trị (trong DDD) |
| DE | Domain Event | Sự kiện miền |
| API | Application Programming Interface | Giao diện lập trình ứng dụng |
| SPA | Single Page Application | Ứng dụng đơn trang |
| JWT | JSON Web Token | Token xác thực |
| gRPC | Google Remote Procedure Call | Giao thức gọi hàm từ xa |
| ORM | Object-Relational Mapping | Ánh xạ đối tượng–CSDL |
| IPN | Instant Payment Notification | Thông báo thanh toán tức thời |
| GPS | Global Positioning System | Hệ thống định vị toàn cầu |
| WebRTC | Web Real-Time Communication | Giao tiếp thời gian thực web |
| CQRS | Command Query Responsibility Segregation | Phân tách lệnh–truy vấn |
| TTL | Time To Live | Thời gian tồn tại |
| FIFO | First In First Out | Vào trước ra trước |
| MSA | Microservices Architecture | Kiến trúc vi dịch vụ |
| SAD | System Architecture Design | Thiết kế kiến trúc hệ thống |
| CI/CD | Continuous Integration / Delivery | Tích hợp & triển khai liên tục |
| RAG | Retrieval-Augmented Generation | Sinh văn bản bổ trợ truy hồi (chatbot) |
| SLA | Service Level Agreement | Thỏa thuận mức dịch vụ |

---

## MỤC LỤC ĐẦY ĐỦ (bản Markdown — dùng làm mục lục Word)

| Chương | Nội dung chính |
|---|---|
| **Hướng dẫn + 12 phần đề cương** | Bảng hình `img/`, ánh xạ Phần 1–12 |
| **Abstract / Tóm tắt / Lời cảm ơn** | Khái quát đề tài, từ khóa |
| **Thuật ngữ** | Bảng viết tắt |
| **Chương 1** | Bối cảnh, mục tiêu, phạm vi, phương pháp, **luồng tổng thể** (§1.5) |
| **Chương 2** | DDD, microservices, Outbox, công nghệ, nghiên cứu liên quan |
| **Chương 3** | Actors, Use case, yêu cầu chức năng/phi chức năng, **khảo sát nghiệp vụ** §3.6 |
| **Chương 4** | §4.0 checklist DDD, subdomain, ngôn ngữ chung, context map, domain model, events, **SAD** §4.6, state machine, sequence, database-per-service, **chi tiết service** §4.11, aggregate §4.12, tích hợp §4.13 |
| **Chương 5** | Dispatch, thanh toán idempotent, ví T+24h, WebRTC, hoa hồng, **design pattern** §5.6, **giao dịch MSA** §5.7, **AI** §5.8 |
| **Chương 6** | Monorepo, Gateway, ví (mẫu), flow tài xế, UI, kiểm thử, **bảo mật + hạ tầng** §6.7, **monitoring** §6.8, **CI/CD** §6.9 |
| **Chương 7** | Đánh giá chức năng & ví, hiệu năng, **thảo luận** §7.3, **mở rộng** §7.4 |
| **Chương 8** | Kết luận, bài học, hướng phát triển |
| **Tài liệu tham khảo / Phụ lục / Nhật kí** | API, env, **cấu trúc repo** (Phụ lục E) |

---

# CHƯƠNG 1: GIỚI THIỆU

> **Phần 1 — Đặt vấn đề và phạm vi (theo đề cương):** Chương này trình bày bối cảnh và động lực đề tài (§1.1), **mục tiêu** (§1.2), **ranh giới trong/ngoài phạm vi** (§1.3) và phương pháp thực hiện (§1.4). Khi soạn Word theo mẫu KLTN, có thể ghép «Đặt vấn đề» = toàn bộ Chương 1 hoặc chỉ §1.1–1.3.

## 1.1. Bối cảnh và Lý do chọn đề tài

### 1.1.1. Thực trạng thị trường

Thị trường đặt xe công nghệ tại Việt Nam tăng trưởng mạnh mẽ trong giai đoạn 2018–2024. Theo báo cáo của Google và Temasek (2023), giá trị thị trường ride-hailing Đông Nam Á đạt 12,4 tỷ USD và dự kiến chạm mốc 19,7 tỷ USD vào năm 2027. Tại Việt Nam, Grab chiếm ưu thế với hơn 70% thị phần, tiếp theo là Be và Gojek [1].

Sự phổ biến của điện thoại thông minh (smartphone penetration > 73% tại Việt Nam năm 2023 theo Statista), băng thông rộng 4G/5G, và văn hóa sử dụng ví điện tử (MoMo, ZaloPay, VNPay) đã tạo điều kiện lý tưởng cho sự phát triển của các nền tảng giao thông số.

### 1.1.2. Thách thức kỹ thuật

Từ góc độ Hệ Thống Thông Tin, xây dựng một nền tảng đặt xe trực tuyến đặt ra những thách thức kỹ thuật đặc thù:

**Thách thức về quy mô và thời gian thực:**
- Hàng chục nghìn tài xế đồng thời cập nhật GPS mỗi vài giây
- Yêu cầu ghép cặp tài xế–khách hàng trong vòng < 5 giây
- Thông báo trạng thái chuyến đi phải đến đích ngay lập tức

**Thách thức về tính nhất quán tài chính:**
- Cổng thanh toán có thể gửi IPN callback nhiều lần → phải xử lý bất biến
- Ví tài xế cần phản ánh chính xác mọi giao dịch → phải có audit trail
- Công nợ chuyến tiền mặt phải được tất toán đúng thứ tự

**Thách thức về kiến trúc:**
- Yêu cầu mở rộng độc lập (scale independently) từng component
- Cần cô lập lỗi — lỗi một service không gây sập toàn bộ hệ thống
- Ranh giới nghiệp vụ rõ ràng để dễ bảo trì và mở rộng tính năng

### 1.1.3. Lý do chọn phương pháp DDD

Domain-Driven Design (DDD) là phương pháp thiết kế phần mềm tập trung vào mô hình hóa lĩnh vực nghiệp vụ, được Eric Evans giới thiệu năm 2003 [2]. DDD phù hợp đặc biệt với hệ thống đặt xe vì:

1. **Nghiệp vụ phức tạp**: ghép cặp tài xế, quản lý ví, thanh toán — mỗi lĩnh vực có ngôn ngữ, quy tắc và vòng đời riêng biệt.
2. **Nhiều nhóm phát triển**: DDD giúp các nhóm làm việc trên các Bounded Context khác nhau mà không can thiệp nhau.
3. **Ánh xạ tự nhiên sang microservices**: mỗi Bounded Context là cơ sở tự nhiên để xác định ranh giới microservice.

## 1.2. Mục tiêu đề tài

| # | Mục tiêu | Cách đo lường |
|---|---|---|
| 1 | Phân tích và đặc tả đầy đủ yêu cầu hệ thống theo DDD | Tài liệu Ubiquitous Language, Context Map, Domain Model |
| 2 | Thiết kế kiến trúc microservices với ranh giới BC rõ ràng | 11 service với Bounded Context riêng biệt |
| 3 | Hiện thực đầy đủ 3 ứng dụng frontend | Customer App, Driver App, Admin Dashboard hoạt động |
| 4 | Tích hợp thanh toán MoMo và VNPay với idempotency | Test pass với IPN trùng lặp |
| 5 | Xây dựng hệ thống ví tài xế theo mô hình fintech | pendingBalance, DebtRecord, settlement hoạt động đúng |
| 6 | Thuật toán ghép cặp tài xế theo địa lý | Dispatch < 5s trong điều kiện mô phỏng đô thị |
| 7 | Real-time communication (chat + voice call) | Socket.IO chat + WebRTC call hoạt động trong chuyến |

## 1.3. Phạm vi đề tài

**Trong phạm vi:**
- Đăng ký/reset mật khẩu qua OTP; đăng nhập bằng số điện thoại và mật khẩu
- Luồng đặt xe đầy đủ từ đặt → ghép cặp → theo dõi → hoàn thành
- Thanh toán: tiền mặt, MoMo, VNPay; hoàn tiền khi hủy
- Ví tài xế: ký quỹ, thu nhập, rút tiền, quản lý công nợ
- Quản trị: duyệt tài xế, theo dõi chuyến, đối soát tài chính
- Chat và gọi thoại trong chuyến
- AI surge pricing (dữ liệu mô phỏng)
- Pipeline **CI/CD** (GitHub Actions) và bản demo triển khai **Docker Swarm** trên AWS (tài liệu `deploy/SWARM-SETUP.md`)

**Ngoài phạm vi:**
- Maps trả phí (dùng OpenStreetMap/Nominatim)
- Ứng dụng native iOS/Android
- Hệ thống khuyến mãi phức tạp (chỉ voucher đơn giản)
- Vận hành thương mại 24/7 với SLA và chứng nhận thanh toán đầy đủ (trong phạm vi khóa luận: môi trường **Docker Compose** cục bộ cho phát triển; **triển khai thử nghiệm Docker Swarm trên AWS EC2** và pipeline CI/CD — Chi tiết **Chương 6 §6.7–6.9**)

## 1.4. Phương pháp thực hiện

1. **Nghiên cứu tài liệu**: DDD của Evans, kiến trúc microservices của Newman, thiết kế hệ thống phân tán của Kleppmann.
2. **Phân tích Domain**: Nhận diện core/supporting/generic subdomain, xây dựng Ubiquitous Language.
3. **Thiết kế Context Map**: Xác định ranh giới BC và mối quan hệ giữa chúng.
4. **Phát triển Agile**: Sprint 1 tuần, mỗi sprint deliver 1–2 service hoàn chỉnh.
5. **Test-Driven**: Unit test cho business logic, integration test cho luồng nghiệp vụ quan trọng.

## 1.5. Luồng nghiệp vụ tổng thể (end-to-end)

Đoạn mô tả ngắn gọn **một vòng đời chuẩn** trong hệ thống hiện thực — có thể đặt ngay sau «Đặt vấn đề» trong Word để người đọc nắm toàn cảnh trước khi vào chi tiết Chương 3–4:

1. **Định danh:** người dùng đăng ký/đăng nhập qua **auth-service** (OTP + JWT), Gateway inject header nội bộ.  
2. **Đặt xe (bước tiền chuyến):** **booking-service** lưu snapshot điểm đón/trả, gọi **pricing-service** ước tính cước; khách **xác nhận** → `booking.confirmed`.  
3. **Tạo chuyến & điều phối:** **ride-service** tạo **Ride**, phát `ride.created`; **API Gateway** dùng **Redis GEO** + điểm số (và tùy chọn AI) để gửi offer qua Socket.IO; tài xế **accept** → trạng thái tiến theo **state machine**.  
4. **Thực hiện:** tài xế cập nhật GPS (**driver-service**), khách theo dõi realtime; chat/WebRTC qua Gateway.  
5. **Hoàn thành & tài chính:** `COMPLETED` → `ride.completed` → **payment-service** (CASH / MoMo / VNPay, **idempotent IPN**) → sự kiện qua RabbitMQ → **wallet-service** (pending T+24h, nợ FIFO, ký quỹ).  
6. **Sau chuyến:** **review-service**, **notification-service**; admin có thể đối soát qua admin-dashboard.

Luồng này khớp **§3.6** và các sơ đồ **`img/act_booking_end_to_end.png`**, **`img/seq_booking_payment_overview.png`**, **`img/evt_rabbitmq_domain_flow.png`**.

---

# CHƯƠNG 2: CƠ SỞ LÝ THUYẾT

## 2.1. Domain-Driven Design (DDD)

### 2.1.1. Tổng quan

Domain-Driven Design là phương pháp phát triển phần mềm đặt mô hình lĩnh vực nghiệp vụ (domain model) làm trung tâm của thiết kế. DDD được Eric Evans hệ thống hóa năm 2003, gồm hai nhóm khái niệm chính: **Strategic Design** (thiết kế chiến lược — phạm vi toàn hệ thống) và **Tactical Design** (thiết kế chiến thuật — phạm vi một service).

### 2.1.2. Strategic Design

**Subdomain** — Một phần của toàn bộ lĩnh vực nghiệp vụ, phân loại thành:
- **Core Domain**: tạo ra lợi thế cạnh tranh, là trái tim của hệ thống (ví dụ: dispatch algorithm)
- **Supporting Subdomain**: hỗ trợ core domain, không đơn giản đủ để mua ngoài (ví dụ: wallet)
- **Generic Subdomain**: chức năng chung, có thể dùng giải pháp off-the-shelf (ví dụ: authentication)

**Bounded Context (BC)** — Ngữ cảnh giới hạn trong đó một mô hình domain cụ thể được định nghĩa và áp dụng nhất quán. Bên trong một BC, thuật ngữ "Ride" có nghĩa rõ ràng và cụ thể; bên ngoài BC đó, cùng từ "Ride" có thể mang nghĩa khác.

**Ubiquitous Language** — Ngôn ngữ chung được đồng thuận giữa developer và domain expert, được dùng trong code, tài liệu và cuộc trò chuyện.

**Context Map** — Sơ đồ mô tả các Bounded Context và mối quan hệ giữa chúng:
- **Partnership**: hai BC phát triển cùng nhau, phải phối hợp
- **Customer/Supplier**: BC upstream (supplier) cung cấp API cho BC downstream (customer)
- **Conformist**: downstream phải tuân theo model của upstream
- **Anti-Corruption Layer (ACL)**: downstream dùng lớp dịch để tách biệt khỏi upstream
- **Published Language**: BC định nghĩa schema chuẩn để chia sẻ

### 2.1.3. Tactical Design

**Entity** — Đối tượng có danh tính (identity) riêng biệt, tồn tại liên tục theo thời gian. Ví dụ: `Ride` được nhận diện bởi `rideId` dù các thuộc tính thay đổi.

**Value Object (VO)** — Đối tượng không có identity, bất biến, được nhận diện bởi giá trị các thuộc tính. Ví dụ: `Location(lat, lng, address)` — hai Location bằng nhau nếu cùng tọa độ và địa chỉ.

**Aggregate** — Nhóm các Entity và VO liên quan, có một Aggregate Root (AR) là điểm vào duy nhất. Bên ngoài không được truy cập trực tiếp vào các object bên trong aggregate — phải đi qua AR.

**Domain Event** — Sự kiện nghiệp vụ có ý nghĩa đã xảy ra trong quá khứ. Ví dụ: `RideCompleted`, `PaymentSettled`. Domain Events được dùng để giao tiếp giữa các Bounded Context.

**Repository** — Abstraction để persist và retrieve Aggregate, che giấu chi tiết lưu trữ.

**Domain Service** — Logic nghiệp vụ không thuộc về bất kỳ Entity hay VO nào. Ví dụ: `DriverMatchingService`.

**Application Service** — Điều phối các use case, gọi Domain Service và Repository, không chứa business logic.

### 2.1.4. Mapping DDD sang Microservices

```
Bounded Context  ←→  Microservice
Aggregate Root   ←→  Transaction boundary (1 DB transaction / AR)
Domain Event     ←→  RabbitMQ message
Repository       ←→  Prisma Client
```

## 2.2. Kiến trúc vi dịch vụ (Microservices)

### 2.2.1. Đặc điểm

Kiến trúc vi dịch vụ tổ chức ứng dụng như một tập hợp các service nhỏ, triển khai độc lập, giao tiếp qua network [3]. Mỗi service:
- Sở hữu database riêng (Database per Service pattern)
- Có thể deploy/scale độc lập
- Giao tiếp qua API hoặc message
- Được đặt ranh giới theo Bounded Context

### 2.2.2. Giao tiếp

**Đồng bộ (REST/gRPC):**
- REST/HTTP: phổ biến, tooling phong phú, nhưng coupling cao hơn
- gRPC: Protocol Buffers serialization, ~5x nhanh hơn JSON/REST, type-safe, hỗ trợ streaming

**Bất đồng bộ (Message Broker):**
- RabbitMQ Topic Exchange: routing theo pattern `domain.event`
- Đảm bảo eventual consistency giữa các service
- Giảm temporal coupling: producer và consumer không cần online cùng lúc

### 2.2.3. Outbox Pattern

Giải quyết vấn đề "dual write" (vừa update DB vừa publish event):

```
Begin Transaction:
  1. Update domain entity in DB
  2. Write event to OutboxEvent table (same DB, same tx)
Commit Transaction

Background worker:
  1. Read unsent events from OutboxEvent
  2. Publish to RabbitMQ
  3. Mark as published
```

Đảm bảo at-least-once delivery ngay cả khi service crash giữa chừng.

## 2.3. Công nghệ nền tảng

### 2.3.1. Node.js và TypeScript

Node.js sử dụng event loop và non-blocking I/O, phù hợp cho ứng dụng I/O-intensive như ride-hailing (nhiều kết nối đồng thời). TypeScript bổ sung kiểu tĩnh, giúp phát hiện lỗi tại compile-time và cải thiện developer experience trong codebase lớn.

### 2.3.2. Prisma ORM

Prisma tạo type-safe database client từ schema declarative. Sau mỗi schema change: `prisma migrate dev` tạo SQL migration, `prisma generate` tạo lại client. Generated client đảm bảo các query đúng kiểu tại compile-time.

### 2.3.3. Socket.IO với Redis Adapter

Socket.IO cung cấp WebSocket real-time với fallback HTTP long-polling. Redis Adapter cho phép nhiều Gateway instance chia sẻ cùng room/namespace — khi user kết nối vào Gateway-1 nhưng event được emit từ Gateway-2, Redis pub/sub đảm bảo delivery đúng.

### 2.3.4. Redis Geo Index

Redis GEOADD lưu tọa độ dưới dạng 52-bit geohash integer trong sorted set. GEORADIUS tìm tất cả member trong bán kính cho trước với độ phức tạp O(N+log M). Phù hợp cho spatial query thời gian thực trong hệ thống dispatch.

### 2.3.5. Cổng thanh toán MoMo và VNPay

Cả hai đều cung cấp sandbox environment. Luồng thanh toán:
1. Backend khởi tạo request → nhận `payUrl`
2. Frontend redirect sang trang thanh toán
3. Sau khi user thanh toán, gateway gọi IPN endpoint của backend
4. Backend xử lý IPN, cập nhật trạng thái, trigger domain events

**Đặc điểm IPN cần chú ý:** IPN có thể đến trễ, đến nhiều lần, hoặc không đến. Backend phải:
- Xác thực signature của IPN (MoMo: HMAC-SHA256, VNPay: SHA512)
- Xử lý idempotent (kiểm tra `idempotencyKey` trước khi xử lý)
- Trả response 200 nhanh (< 5s) để gateway không retry

## 2.4. Nghiên cứu liên quan

### 2.4.1. Uber Engineering

Uber công bố kiến trúc dispatch system dùng thuật toán tối ưu hóa tổ hợp (combinatorial optimization) cho bài toán ghép cặp toàn cục [4]. Đề tài đơn giản hóa thành greedy algorithm với hàm scoring — phù hợp với scope học thuật nhưng vẫn đảm bảo correctness.

### 2.4.2. Grab Engineering

Grab sử dụng Apache Kafka cho event streaming với throughput cao hơn RabbitMQ, và Golang thay vì Node.js cho các service critical [5]. Đề tài chọn RabbitMQ (đơn giản hơn, đủ tốt cho scale học thuật) và Node.js (đồng nhất tech stack).

**Chốt chương:** Chương 2 cung cấp **ngôn ngữ lý thuyết** (DDD, MSA, Outbox, broker) để hiểu các quyết định thiết kế ở Chương 4–5; trọng tâm **ứng dụng vào đề tài** được trình bày cụ thể từ **Chương 3** trở đi.

---

# CHƯƠNG 3: PHÂN TÍCH YÊU CẦU

> **Phần 2 — Thu thập yêu cầu và khảo sát nghiệp vụ:** Các mục §3.1 (Actors) và §3.2–3.3 (Use Case) đồng thời là **đầu vào cho Phần 3 (DDD)** khi xác định ngôn cảnh và luồng tương tác. **Khảo sát nghiệp vụ** được mô tả theo từng quy trình chức năng trong **§3.6** (đặt xe, điều phối, thanh toán, ví, quản trị, realtime, AI) — khớp với luồng chạy thực tế trong codebase.

## 3.1. Nhận diện các tác nhân (Actors)

| Tác nhân | Loại | Mô tả |
|---|---|---|
| **Khách hàng** | Primary | Người dùng đặt xe, thanh toán, đánh giá |
| **Tài xế** | Primary | Người nhận và thực hiện chuyến, quản lý ví |
| **Quản trị viên** | Primary | Nhân viên nền tảng: duyệt hồ sơ, giám sát, đối soát |
| **API Gateway** | System | Proxy, xác thực, dispatch |
| **MoMo/VNPay** | External | Cổng thanh toán bên ngoài |
| **AI Service** | External | Dự đoán surge pricing |
| **STUN Server** | External | NAT traversal cho WebRTC |

## 3.2. Biểu đồ Use Case tổng thể

**Hình gợi ý chèn vào Word:** `img/uc_journey_roles_en.png`

![Hình 3.1. Use case tổng thể hệ thống đặt xe](../img/uc_journey_roles_en.png)

**Ảnh (PNG nền trắng, xuất từ Mermaid — file `img/uc_system_usecases_vn.png`):** `uc_system_usecases_vn.png`

![use case overview](../img/uc_system_usecases_vn.png)


## 3.3. Đặc tả Use Case chi tiết

### 3.3.1. UC-02: Đặt xe

**Tên:** Đặt xe trực tuyến  
**Tác nhân chính:** Khách hàng  
**Tiền điều kiện:** Khách hàng đã đăng nhập, có kết nối internet  
**Hậu điều kiện:** Booking được xác nhận, **Ride** được tạo (`CREATED` → `FINDING_DRIVER`), hệ thống bắt đầu tìm tài xế (khớp **§3.6.2** và **§1.5**).

| # | Bước | Tác nhân | Hệ thống |
|---|---|---|---|
| 1 | Mở ứng dụng, nhập điểm đón trên bản đồ | Khách hàng | — |
| 2 | — | — | Gọi Nominatim/OSM gợi ý địa chỉ |
| 3 | Xác nhận điểm đón, nhập điểm đến | Khách hàng | — |
| 4 | — | — | **booking-service** + **pricing-service**: tạo booking, tính giá ước tính |
| 5 | Chọn loại xe, phương thức thanh toán, **xác nhận đặt** | Khách hàng | — |
| 6 | — | — | Booking → `CONFIRMED`, phát `booking.confirmed` |
| 7 | — | — | **ride-service** tạo Ride `CREATED` → `FINDING_DRIVER`, phát `ride.created` |
| 8 | — | — | **API Gateway**: dispatch (≤3 vòng bán kính), Ride → `OFFERED`, Socket offer tới tài xế |
| 9 | Tài xế chấp nhận | Tài xế | — |
| 10 | — | — | Ride → `ASSIGNED` (và các bước tiếp theo theo state machine), thông báo khách |
| 11 | Nhận thông báo tài xế đang đến | Khách hàng | — |

**Luồng thay thế A2:** Không có tài xế sau 3 vòng → thông báo thất bại, Ride hủy  
**Luồng thay thế A3:** Tài xế không phản hồi trong 30s → dispatch cho tài xế tiếp theo

### 3.3.2. UC-04: Thanh toán

**Tên:** Thanh toán cuối chuyến  
**Tiền điều kiện:** Chuyến đi ở trạng thái COMPLETED  
**Hậu điều kiện:** Payment COMPLETED, ví tài xế được cập nhật, hoàn tiền nếu cần

| Phương thức | Luồng |
|---|---|
| **CASH** | Khách trả tiền mặt → driver hoàn thành → debit commission → tạo DebtRecord |
| **MOMO** | Redirect sang MoMo → user thanh toán → MoMo gọi IPN → credit pendingBalance |
| **VNPAY** | Redirect sang VNPay → user thanh toán → VNPay gọi IPN → credit pendingBalance |

### 3.3.3. UC-10: Quản lý ví tài xế

**Tên:** Xem và quản lý ví tài xế  
**Tác nhân chính:** Tài xế  
**Tiền điều kiện:** Tài xế đã kích hoạt ví (nạp 300k ký quỹ)

Tác nhân có thể:
1. Xem 4 thành phần số dư: available, pending (T+24h), debt, deposit
2. Xem danh sách DebtRecord với due date và trạng thái
3. Rút tiền về ngân hàng (chỉ từ availableBalance)
4. Nạp tiền (tự động tất toán công nợ trước, phần dư vào available)
5. Xem lịch sử giao dịch với filter theo loại

## 3.4. Yêu cầu chức năng tổng hợp

### 3.4.1. Nhóm Khách hàng

| Mã | Tính năng | Ưu tiên | Microservice |
|---|---|---|---|
| F-C01 | Đăng ký OTP qua số điện thoại | Cao | auth-service |
| F-C02 | Đăng nhập, refresh token | Cao | auth-service |
| F-C03 | Đặt xe với bản đồ tương tác | Cao | ride-service |
| F-C04 | Chọn loại xe và ước tính giá | Cao | pricing-service |
| F-C05 | Theo dõi tài xế real-time | Cao | api-gateway |
| F-C06 | Thanh toán MoMo/VNPay/Tiền mặt | Cao | payment-service |
| F-C07 | Hủy chuyến và yêu cầu hoàn tiền | Trung | payment-service |
| F-C08 | Chat Socket.IO với tài xế | Cao | api-gateway |
| F-C09 | Gọi thoại WebRTC với tài xế | Cao | api-gateway |
| F-C10 | Đánh giá tài xế sau chuyến | Trung | review-service |
| F-C11 | Xem lịch sử chuyến đi | Trung | booking-service |
| F-C12 | Sử dụng voucher giảm giá | Thấp | booking-service |

### 3.4.2. Nhóm Tài xế

| Mã | Tính năng | Ưu tiên | Microservice |
|---|---|---|---|
| F-D01 | Đăng ký hồ sơ (xe, GPLX) | Cao | driver-service |
| F-D02 | Nạp 300k ký quỹ kích hoạt ví | Cao | wallet-service |
| F-D03 | Bật/tắt nhận cuốc | Cao | driver-service |
| F-D04 | Nhận thông báo cuốc và chấp nhận | Cao | api-gateway |
| F-D05 | Cập nhật trạng thái chuyến | Cao | ride-service |
| F-D06 | Xem ví: available/pending/debt/deposit | Cao | wallet-service |
| F-D07 | Rút tiền về ngân hàng | Cao | wallet-service |
| F-D08 | Xem công nợ với due date | Cao | wallet-service |
| F-D09 | Xem lịch sử thu nhập | Trung | wallet-service |
| F-D10 | Chat/gọi thoại với khách | Cao | api-gateway |

### 3.4.3. Nhóm Quản trị viên

| Mã | Tính năng | Ưu tiên | Microservice |
|---|---|---|---|
| F-A01 | Duyệt/từ chối hồ sơ tài xế | Cao | driver-service |
| F-A02 | Bản đồ tài xế online real-time | Cao | api-gateway |
| F-A03 | Danh sách và filter chuyến đi | Cao | ride-service |
| F-A04 | Dashboard tài chính nền tảng | Cao | wallet-service |
| F-A05 | Sổ cái giao dịch và đối soát | Cao | wallet-service |
| F-A06 | Quản lý ví tài xế | Trung | wallet-service |
| F-A07 | Cấu hình giá cước | Trung | pricing-service |
| F-A08 | Quản lý quy tắc thưởng tài xế | Trung | wallet-service |
| F-A09 | Xử lý hoàn tiền | Trung | payment-service |

## 3.5. Yêu cầu phi chức năng

| Loại | Yêu cầu cụ thể |
|---|---|
| **Hiệu năng** | Dispatch tài xế < 5s; API P95 < 300ms |
| **Bảo mật** | JWT 15 phút; OTP hash trong Redis; endpoint lấy OTP mock chỉ bật ở dev; Không expose internal IP |
| **Độ tin cậy** | IPN idempotent; Outbox pattern cho critical events |
| **Khả năng mở rộng** | Stateless services; Redis adapter Socket.IO; Database per service |
| **Khả dụng** | AI service fallback < 150ms; Graceful degradation |
| **Kiểm toán** | Wallet ledger append-only; Merchant ledger bất biến |
| **Tuân thủ** | OTP production không lưu plaintext; mock dev lưu plaintext TTL ngắn để test; Hash SHA-256 |

## 3.6. Phân tích nghiệp vụ chi tiết

Mục này trình bày các nghiệp vụ quan trọng của hệ thống theo dạng có thể sử dụng trực tiếp trong báo cáo Word. Mỗi nghiệp vụ gồm mục tiêu, tác nhân, dữ liệu đầu vào, xử lý chính, kết quả và ngoại lệ cần kiểm soát.

### 3.6.1. Nghiệp vụ đăng ký, đăng nhập mật khẩu và xác thực OTP

**Mục tiêu:** bảo đảm mỗi người dùng trong hệ thống được định danh bằng số điện thoại, có thể đăng nhập an toàn và nhận quyền tương ứng với vai trò khách hàng, tài xế hoặc quản trị viên.

**Tác nhân:** khách hàng, tài xế, quản trị viên, Auth Service, API Gateway.

**Dữ liệu đầu vào:** số điện thoại, mật khẩu, mã OTP, vai trò tài khoản, thông tin thiết bị và địa chỉ IP.

**Quy trình nghiệp vụ:**

| Bước | Mô tả xử lý | Service chịu trách nhiệm |
|---|---|---|
| 1 | Người dùng nhập số điện thoại và yêu cầu gửi OTP | Customer App / Driver App / Admin Dashboard |
| 2 | API Gateway chuyển request đến Auth Service | API Gateway |
| 3 | Auth Service sinh OTP, hash OTP, lưu vào Redis với TTL, đồng thời ghi audit log | Auth Service |
| 4 | Ở môi trường phát triển/mock, OTP có thể lấy qua endpoint debug TTL ngắn để test Postman; ở môi trường thật, OTP được gửi qua SMS provider | Auth Service, SMS Provider |
| 5 | Người dùng nhập OTP để xác minh | Frontend |
| 6 | Auth Service kiểm tra OTP, số lần thử và thời hạn hiệu lực | Auth Service |
| 7 | Khi đăng ký/đăng nhập thành công, Auth Service phát access token và refresh token | Auth Service |
| 8 | API Gateway dùng JWT để xác thực các request sau đó và inject `x-user-id`, `x-user-role`, `x-user-email` cho service phía sau | API Gateway |

**Kết quả:** người dùng có phiên đăng nhập hợp lệ; downstream service nhận được thông tin định danh qua header nội bộ.

**Ngoại lệ:** OTP sai quá số lần cho phép, OTP hết hạn, số điện thoại đã tồn tại, tài khoản bị khóa, refresh token bị thu hồi.

**Hình gợi ý chèn vào Word:** `img/seq_auth_otp_register_reset.png`.

![Hình 3.2. Sequence xác thực OTP](../img/seq_auth_otp_register_reset.png)

### 3.6.2. Nghiệp vụ khách hàng đặt xe

**Mục tiêu:** cho phép khách hàng nhập điểm đón, điểm đến, chọn loại xe, xem giá ước tính và xác nhận đặt xe.

**Tác nhân:** khách hàng, API Gateway, Booking Service, Pricing Service, Ride Service, Driver Service.

**Dữ liệu đầu vào:** tọa độ điểm đón/trả, địa chỉ dạng text, loại xe, phương thức thanh toán, voucher, ghi chú chuyến đi.

**Quy trình nghiệp vụ chính:**

| Bước | Mô tả xử lý | Service chịu trách nhiệm |
|---|---|---|
| 1 | Khách hàng chọn điểm đón và điểm đến trên bản đồ | Customer App |
| 2 | Hệ thống chuẩn hóa địa chỉ và lấy tuyến đường dự kiến | API Gateway, Map Adapter |
| 3 | Pricing Service tính khoảng cách, thời gian, surge multiplier và giá ước tính | Pricing Service |
| 4 | Booking Service tạo bản ghi Booking trạng thái `PENDING` để lưu snapshot giá | Booking Service |
| 5 | Khách hàng xác nhận đặt xe | Customer App |
| 6 | Booking chuyển sang `CONFIRMED`, phát event `booking.confirmed` | Booking Service |
| 7 | Ride Service tạo Ride trạng thái `CREATED` rồi chuyển sang `FINDING_DRIVER` | Ride Service |
| 8 | Ride Service phát event `ride.created` để API Gateway kích hoạt matching | Ride Service, API Gateway |

**Kết quả:** một chuyến đi được tạo và hệ thống bắt đầu tìm tài xế.

**Ngoại lệ:** địa chỉ không hợp lệ, không tính được tuyến đường, voucher không hợp lệ, khách hàng có chuyến đang hoạt động, không có tài xế trong phạm vi phục vụ.

**Hình gợi ý chèn vào Word:** `img/act_booking_end_to_end.png` và `img/bpmn_booking_swimlanes.png`.

![Hình 3.3. Activity flow nghiệp vụ đặt xe](../img/act_booking_end_to_end.png)

![Hình 3.4. BPMN-lite luồng đặt xe theo vai trò](../img/bpmn_booking_swimlanes.png)

### 3.6.3. Nghiệp vụ điều phối tài xế

**Mục tiêu:** tìm tài xế phù hợp trong thời gian ngắn, ưu tiên tài xế gần, có rating tốt, tỷ lệ nhận chuyến cao và ít hủy chuyến.

**Tác nhân:** API Gateway, Ride Service, Driver Service, tài xế.

**Dữ liệu đầu vào:** vị trí điểm đón, loại xe, danh sách tài xế online trong Redis GEO, thống kê tài xế, trạng thái ví tài xế.

**Quy trình nghiệp vụ:**

| Bước | Mô tả xử lý |
|---|---|
| 1 | API Gateway nhận event `ride.created` từ RabbitMQ |
| 2 | Gateway truy vấn Redis GEO để lấy tài xế trong bán kính vòng 1 là 2km |
| 3 | Hệ thống lọc tài xế theo loại xe, trạng thái online, không bận chuyến khác và đủ điều kiện ví |
| 4 | Các tài xế hợp lệ được tính điểm theo khoảng cách, rating, thời gian rảnh, accept rate và cancel rate |
| 5 | Nếu bật AI, Gateway gọi AI Service để dự đoán xác suất tài xế nhận chuyến; nếu AI lỗi, hệ thống dùng điểm gốc |
| 6 | Gateway gửi offer qua Socket.IO cho tài xế có điểm cao nhất |
| 7 | Nếu tài xế chấp nhận, Ride chuyển sang `ASSIGNED`; nếu từ chối hoặc timeout, hệ thống thử tài xế tiếp theo |
| 8 | Nếu vòng 1 thất bại, Gateway mở rộng sang vòng 2 bán kính 3km và vòng 3 bán kính 5km |
| 9 | Nếu tất cả vòng thất bại, Ride được hủy với lý do không tìm thấy tài xế |

**Kết quả:** chuyến đi được gán tài xế hoặc được hủy có kiểm soát.

**Ngoại lệ:** tài xế offline ngay sau khi nhận offer, tài xế hết điều kiện ví, Socket.IO mất kết nối, không có tài xế phù hợp.

**Hình gợi ý chèn vào Word:** `img/flow_driver_matching_radius.png`.

![Hình 3.5. Luồng điều phối tài xế](../img/flow_driver_matching_radius.png)

### 3.6.4. Nghiệp vụ tài xế thực hiện chuyến đi

**Mục tiêu:** quản lý toàn bộ quá trình sau khi tài xế nhận chuyến, từ lúc đến điểm đón đến khi hoàn thành.

**Tác nhân:** tài xế, khách hàng, Ride Service, API Gateway.

**Trạng thái chính:** `ASSIGNED`, `ACCEPTED`, `PICKING_UP`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.

| Bước | Hành động của tài xế | Xử lý của hệ thống |
|---|---|---|
| 1 | Tài xế chấp nhận offer | Ride chuyển sang `ASSIGNED`, khách hàng nhận thông báo |
| 2 | Tài xế bắt đầu đi đến điểm đón | Ride chuyển sang `ACCEPTED` hoặc `PICKING_UP` tùy hành động |
| 3 | Driver App cập nhật GPS định kỳ | Driver Service lưu vị trí; API Gateway broadcast đến khách hàng |
| 4 | Tài xế xác nhận đã đón khách | Ride chuyển sang `IN_PROGRESS` |
| 5 | Tài xế hoàn thành chuyến | Ride chuyển sang `COMPLETED`, phát event cho Payment Service |
| 6 | Khách hàng và tài xế đánh giá nhau | Review Service lưu đánh giá, cập nhật rating tài xế |

**Ràng buộc:** mọi chuyển trạng thái phải đi qua Ride State Machine; không service nào được cập nhật trực tiếp field `status` nếu transition không hợp lệ.

**Hình gợi ý chèn vào Word:** `img/stm_ride_lifecycle_simple.png`.

![Hình 3.6. State machine vòng đời chuyến đi](../img/stm_ride_lifecycle_simple.png)

### 3.6.5. Nghiệp vụ thanh toán chuyến đi

**Mục tiêu:** ghi nhận đầy đủ số tiền khách phải trả, khoản hoa hồng nền tảng, thu nhập tài xế và trạng thái thanh toán.

**Tác nhân:** khách hàng, tài xế, Payment Service, Wallet Service, MoMo, VNPay.

**Luồng thanh toán theo phương thức:**

| Phương thức | Cách xử lý | Ảnh hưởng ví tài xế |
|---|---|---|
| Tiền mặt | Khách trả trực tiếp cho tài xế; hệ thống ghi nhận tài xế đã thu toàn bộ gross fare | Tài xế phát sinh `DebtRecord` bằng phần hoa hồng nền tảng |
| MoMo | Khách thanh toán qua MoMo; MoMo gọi IPN về Payment Service | Nền tảng thu tiền, Wallet Service ghi nhận net earning vào pending balance |
| VNPay | Khách thanh toán qua VNPay; VNPay gọi IPN về Payment Service | Tương tự MoMo |
| Wallet | Khấu trừ từ ví nếu có triển khai số dư khách hàng | Ghi nhận ledger nội bộ |

**Quy tắc quan trọng:**

| Quy tắc | Diễn giải |
|---|---|
| Idempotency | IPN từ MoMo/VNPay có thể gửi nhiều lần; `idempotencyKey` bảo đảm không cộng tiền hai lần |
| Outbox Pattern | Payment cập nhật DB và tạo event trong cùng transaction, sau đó worker publish sang RabbitMQ |
| Commission | Nền tảng giữ 15-20% tùy loại xe |
| Voucher | Khoản giảm giá do nền tảng chịu, không làm giảm gross earning của tài xế |
| Refund | Nếu hủy chuyến sau khi đã thanh toán online, Payment Service phát event hoàn tiền |

**Hình gợi ý chèn vào Word:** `img/seq_booking_payment_overview.png` và `img/act_payment_by_method.png`.

![Hình 3.7. Sequence booking và payment](../img/seq_booking_payment_overview.png)

![Hình 3.8. Nhánh xử lý thanh toán theo phương thức](../img/act_payment_by_method.png)

### 3.6.6. Nghiệp vụ ví tài xế, ký quỹ và công nợ

**Mục tiêu:** quản lý chính xác tài chính tài xế, bảo đảm thu nhập, ký quỹ, số dư khả dụng, số dư pending và công nợ được tách bạch.

**Tác nhân:** tài xế, quản trị viên, Wallet Service, Payment Service.

**Các thành phần số dư:**

| Thành phần | Ý nghĩa |
|---|---|
| `balance` | Tổng số dư kế toán của ví |
| `availableBalance` | Số tiền tài xế có thể rút |
| `pendingBalance` | Thu nhập đang giữ T+24h |
| `lockedBalance` | Ký quỹ 300.000 VND để kích hoạt ví |
| `debt` | Tổng công nợ từ các chuyến tiền mặt chưa tất toán |

**Quy trình kích hoạt ví:**

| Bước | Mô tả |
|---|---|
| 1 | Admin duyệt hồ sơ tài xế |
| 2 | Driver Service phát event `driver.approved` |
| 3 | Wallet Service tạo ví trạng thái `INACTIVE` |
| 4 | Tài xế nạp tối thiểu 300.000 VND |
| 5 | Wallet Service chuyển 300.000 VND vào `lockedBalance` và kích hoạt ví |
| 6 | Tài xế được phép bật online nếu không vi phạm ngưỡng nợ |

**Quy trình settlement T+24h:**

| Bước | Mô tả |
|---|---|
| 1 | Payment Service phát event `driver.earnings.settled` sau chuyến hoàn thành |
| 2 | Wallet Service tạo `PendingEarning` với `settleAt = now + 24h` |
| 3 | Khi đến hạn, hệ thống giải phóng pending earning |
| 4 | Nếu tài xế còn nợ, hệ thống tất toán nợ theo FIFO trước |
| 5 | Phần còn lại mới cộng vào `availableBalance` |

**Hình gợi ý chèn vào Word:** `img/stm_wallet_fintech.png`.

![Hình 3.9. State machine ví tài xế](../img/stm_wallet_fintech.png)

### 3.6.7. Nghiệp vụ quản trị viên

**Mục tiêu:** giúp quản trị viên vận hành nền tảng, kiểm duyệt hồ sơ tài xế, giám sát chuyến đi và đối soát tài chính.

| Nhóm nghiệp vụ | Chức năng chính | Service |
|---|---|---|
| Quản lý tài xế | Xem hồ sơ, duyệt, từ chối, tạm ngưng tài xế | Driver Service |
| Quản lý chuyến đi | Xem danh sách chuyến, trạng thái, chi tiết hành trình | Ride Service |
| Quản lý khách hàng | Xem profile, trạng thái tài khoản | User Service, Auth Service |
| Đối soát thanh toán | Xem payment, voucher, refund, trạng thái gateway | Payment Service |
| Đối soát ví | Xem merchant balance, merchant ledger, ví từng tài xế | Wallet Service |
| Duyệt rút tiền | Xem yêu cầu rút tiền, duyệt hoặc từ chối | Wallet Service |
| Giám sát hệ thống | Health check, log, metrics, socket status | API Gateway, Monitoring stack |

**Kết quả:** quản trị viên có đủ công cụ để vận hành hệ thống trong bối cảnh học thuật và demo nghiệp vụ.

### 3.6.8. Nghiệp vụ thông báo, chat và gọi thoại

**Mục tiêu:** bảo đảm người dùng nhận được cập nhật kịp thời trong suốt chuyến đi và có kênh liên hệ trực tiếp khi cần.

| Kênh | Công nghệ | Mục đích |
|---|---|---|
| In-app realtime | Socket.IO | Offer cuốc, trạng thái chuyến, vị trí tài xế |
| Chat | Socket.IO + lưu lịch sử trong Ride Service | Khách và tài xế trao đổi tin nhắn trong chuyến |
| Gọi thoại | WebRTC P2P, Gateway làm signaling server | Gọi nhanh giữa khách và tài xế |
| Email/SMS/Push | Notification Service | Thông báo đăng ký, duyệt tài xế, thanh toán, hủy chuyến |

**Hình gợi ý chèn vào Word:** `img/arch_realtime_socket_webrtc.png`.

![Hình 3.10. Kiến trúc giao tiếp thời gian thực](../img/arch_realtime_socket_webrtc.png)

### 3.6.9. Nghiệp vụ AI hỗ trợ giá, matching và chăm sóc khách hàng

**Mục tiêu:** bổ sung năng lực dự đoán để cải thiện trải nghiệm đặt xe, nhưng không làm hệ thống phụ thuộc hoàn toàn vào AI.

| Chức năng AI | Đầu vào | Đầu ra | Service sử dụng |
|---|---|---|---|
| Dự đoán ETA và surge | Khoảng cách, khung giờ, loại ngày | ETA, price multiplier | Pricing Service |
| Dự đoán xác suất nhận chuyến | Thông tin chuyến, thống kê tài xế, demand | `p_accept` | API Gateway |
| Dự đoán thời gian chờ | Demand, số booking, số tài xế online | Wait time | Pricing Service |
| RAG chatbot | Câu hỏi người dùng và knowledge base | Câu trả lời hỗ trợ | Customer App, Driver App |

**Nguyên tắc thiết kế:** AI Service là thành phần tùy chọn. Mọi lời gọi AI có timeout ngắn và fallback về công thức/rule-based để hệ thống vẫn hoạt động khi AI lỗi.

**Khi nào dùng:** minh họa **§3.6.9** và **§4.11.12** — tách rõ huấn luyện offline (sklearn/joblib) và suy luận online; RAG_agent với INPUT / OUTPUT.

**File ảnh — Pipeline train + suy luận (sklearn, ETA/surge/p_accept):** `img/ai_ml_sklearn_train_infer_pipeline.png`  
Nguồn Mermaid: `docs/diagrams/mermaid/source/ai_ml_sklearn_train_infer_pipeline.mmd`. Xuất lại: `npx @mermaid-js/mermaid-cli -i "<file>.mmd" -o img/ai_ml_sklearn_train_infer_pipeline.png -b white -w 2400`.

![Hình 3.11. Mô hình train INPUT/OUTPUT và pipeline suy luận API](../img/ai_ml_sklearn_train_infer_pipeline.png)

**File ảnh — AI Agent RAG (retrieval-augmented):** `img/ai_agent_rag_retrieval.png`  
Nguồn Mermaid: `docs/diagrams/mermaid/source/ai_agent_rag_retrieval.mmd`.

![Hình 3.12. Agent RAG — INPUT câu hỏi + KB / OUTPUT trả lời](../img/ai_agent_rag_retrieval.png)

---

# CHƯƠNG 4: THIẾT KẾ HỆ THỐNG THEO DDD

## 4.0. Lộ trình phân tích DDD (Phần 3 — checklist 12 bước)

Bảng sau **ánh xạ** các bước phân tích DDD thường dùng trong đề cương báo cáo vào **mục cụ thể** của tài liệu này (tránh trùng lặp: Actors/Use Case đã trình bày tại **Chương 3**, lý thuyết nền tại **Chương 2**).

| Bước | Nội dung | Mục trong báo cáo |
|---|---|---|
| 3.1 | Xác định **Actors** | **Chương 3 §3.1** |
| 3.2 | Xác định **Use Cases** | **Chương 3 §3.2–3.3** (và bảng chức năng §3.4) |
| 3.3 | **Domain** và **Subdomain** (core/supporting/generic) | **§4.1** |
| 3.4 | **Bounded Context** (ranh giới ngữ cảnh) | **§4.3–4.4**, **§4.11** (danh mục service) |
| 3.5 | **Context mapping** (cách BC giao tiếp) | **§4.3** (sơ đồ + giải thích quan hệ Customer–Supplier, Conformist, ACL…) |
| 3.6 | **Domain model** (thực thể, VO, dịch vụ miền) | **§4.4** (class diagram theo từng BC) |
| 3.7 | **Aggregate boundaries** | **§4.12** (bảng tổng hợp AR và quy tắc transaction) |
| 3.8 | **Microservices** tương ứng BC | **§4.11** |
| 3.9 | Thiết kế **giao tiếp** giữa microservice | **§4.6**, **§4.13**; sự kiện **§4.5** |
| 3.10 | **Data ownership** (database per service) | **§4.10**; hình `img/data_db_per_service_overview.png` |
| 3.11 | **Integration patterns** (sync/async, outbox, anti-corruption) | **§4.13**; lý thuyết Outbox **Chương 2 §2.2.3** |
| 3.12 | **Refine & validate** (kiểm chứng mô hình) | **Chương 7** (kiểm thử, đánh giá, hiệu năng) |

**Phần 4 — Thiết kế kiến trúc hệ thống (SAD)** trong đề cương rộng: lấy **§4.6** làm sơ đồ kiến trúc tổng thể và các sequence §4.7–4.9; phần hiện thực chi tiết (Gateway, cấu trúc service) tại **Chương 6**.

## 4.1. Phân tích Subdomain

Áp dụng Event Storming và Domain Storytelling để nhận diện các subdomain:

**Ảnh (PNG nền trắng, xuất từ Mermaid — file `img/ddd_subdomain_classification.png`):** `ddd_subdomain_classification.png`

![subdomain classification](../img/ddd_subdomain_classification.png)


**Lý do phân loại:**
- **Core Domain** (đỏ): Tạo lợi thế cạnh tranh. Thuật toán dispatch quyết định trải nghiệm người dùng; Mô hình ví tài chính quyết định niềm tin của tài xế.
- **Supporting Subdomain** (xanh): Quan trọng nhưng có thể dùng pattern chuẩn.
- **Generic Subdomain** (xám): Có thể thay bằng giải pháp có sẵn.

## 4.2. Ubiquitous Language

Bảng từ vựng chính thức trong hệ thống:

| Thuật ngữ | Định nghĩa trong hệ thống |
|---|---|
| **Ride** | Một hành trình từ điểm đón đến điểm đến, gắn với một khách hàng và một tài xế |
| **Dispatch** | Hành động hệ thống chọn và giao cuốc cho tài xế phù hợp |
| **Cuốc** | Tiếng địa phương cho "chuyến xe" — đồng nghĩa với Ride trong ngữ cảnh tài xế |
| **Commission** | Phần trăm cước phí nền tảng giữ lại từ tài xế (15–20% tùy loại xe) |
| **cashDebt** | Khoản nợ tài xế phải trả nền tảng từ chuyến tiền mặt (= grossFare × commissionRate) |
| **pendingBalance** | Thu nhập online được giữ T+24h trước khi available |
| **availableBalance** | Số dư có thể rút về ngân hàng ngay |
| **lockedBalance** | Ký quỹ 300.000₫ bị khóa; hoàn trả khi tài xế ngừng hoạt động |
| **DebtRecord** | Bản ghi một khoản nợ cụ thể với due date và trạng thái |
| **Settlement** | Quá trình chuyển pendingBalance → availableBalance sau 24h |
| **IPN** | Instant Payment Notification — callback từ cổng thanh toán |
| **Driver status** | PENDING / APPROVED / REJECTED / SUSPENDED — trạng thái phê duyệt hồ sơ |
| **Availability** | ONLINE / OFFLINE / BUSY — trạng thái nhận cuốc |

## 4.3. Context Map

**Ảnh (PNG nền trắng, xuất từ Mermaid — file `img/ddd_context_map.png`):** `ddd_context_map.png`

![context map](../img/ddd_context_map.png)


**Quan hệ quan trọng:**
- **API Gateway → Services**: Conformist — Gateway tuân theo interface của từng service
- **Ride → Payment**: Customer/Supplier — Ride là upstream, khi RideCompleted được publish, Payment xử lý
- **Payment → Wallet**: Event-based Published Language — Payment publish event với schema chuẩn; Wallet là autonomous consumer
- **Gateway → AI**: Anti-Corruption Layer với timeout fallback — AI là optional enhancement

## 4.4. Domain Model từng Bounded Context

### 4.4.1. Ride Context — Domain Model

**Ảnh (PNG nền trắng, xuất từ Mermaid — file `img/class_ride_aggregate.png`):** `class_ride_aggregate.png`

![class diagram ride](../img/class_ride_aggregate.png)


### 4.4.2. Driver Context — Domain Model

**Ảnh (PNG nền trắng, xuất từ Mermaid — file `img/class_driver_aggregate.png`):** `class_driver_aggregate.png`

![class diagram driver](../img/class_driver_aggregate.png)


### 4.4.3. Wallet Context — Domain Model

**Ảnh (PNG nền trắng, xuất từ Mermaid — file `img/class_wallet_aggregate.png`):** `class_wallet_aggregate.png`

![class diagram wallet](../img/class_wallet_aggregate.png)


### 4.4.4. Payment Context — Domain Model

**Ảnh (PNG nền trắng, xuất từ Mermaid — file `img/class_payment_aggregate.png`):** `class_payment_aggregate.png`

![class diagram payment](../img/class_payment_aggregate.png)


## 4.5. Domain Events Catalog

**Hình gợi ý chèn vào Word:** `img/evt_rabbitmq_domain_flow.png`

![Hình 4.1. Luồng domain event qua RabbitMQ](../img/evt_rabbitmq_domain_flow.png)

**Ảnh (PNG nền trắng, xuất từ Mermaid — file `img/evt_domain_catalog_graph.png`):** `evt_domain_catalog_graph.png`

![domain events catalog graph](../img/evt_domain_catalog_graph.png)


**Bảng Domain Events:**

| Event | Publisher | Subscribers | Payload chính |
|---|---|---|---|
| `ride.completed` | ride-service | payment-service | rideId, customerId, driverId, paymentMethod, fare |
| `driver.earning.settled` | payment-service | wallet-service | rideId, driverId, paymentMethod, grossFare, netEarnings, cashDebt |
| `refund.completed` | payment-service | wallet-service | rideId, driverId, refundAmount |
| `wallet.topup.completed` | payment-service | wallet-service | orderId, driverId, amount, provider |
| `driver.approved` | driver-service | api-gateway | driverId, userId |
| `driver.rejected` | driver-service | api-gateway | driverId, userId, reason |
| `driver.wallet.blocked` | wallet-service | (notification) | driverId, balance |

## 4.6. Kiến trúc tổng thể

> **Phần 4 — Thiết kế kiến trúc hệ thống (SAD)** trong đề cương 12 phần: mục này mô tả **lớp kiến trúc** (presentation → gateway → service → hạ tầng dữ liệu/message), điểm vào duy nhất và luồng gọi chính. Phần **sequence / activity** bổ sung tại **§4.7–4.9**; cấu trúc triển khai thực tế **Chương 6**.

**Hình gợi ý chèn vào Word:** `img/arch_system_overview.png`

![Hình 4.2. Kiến trúc tổng thể hệ thống](../img/arch_system_overview.png)

**Ảnh (PNG nền trắng, xuất từ Mermaid — file `img/arch_layers_services_infra.png`):** `arch_layers_services_infra.png`

![architecture layers](../img/arch_layers_services_infra.png)


## 4.7. State Machine — Vòng đời Chuyến đi

**Hình gợi ý chèn vào Word:** `img/stm_ride_lifecycle_simple.png`

![Hình 4.3. State machine vòng đời chuyến đi](../img/stm_ride_lifecycle_simple.png)

**Ảnh (PNG nền trắng, xuất từ Mermaid — file `img/stm_ride_statemachine_code.png`):** `stm_ride_statemachine_code.png`

![state machine ride](../img/stm_ride_statemachine_code.png)


## 4.8. Luồng thanh toán — Sequence Diagram

**Hình gợi ý chèn vào Word:** `img/seq_booking_payment_overview.png`

![Hình 4.4. Luồng đặt xe và thanh toán](../img/seq_booking_payment_overview.png)

**Ảnh (PNG nền trắng, xuất từ Mermaid — file `img/seq_payment_after_ride_complete.png`):** `seq_payment_after_ride_complete.png`

![sequence payment ride complete](../img/seq_payment_after_ride_complete.png)


## 4.9. Luồng Dispatch Tài xế — Sequence Diagram

**Hình gợi ý chèn vào Word:** `img/flow_driver_matching_radius.png`

![Hình 4.5. Luồng dispatch tài xế](../img/flow_driver_matching_radius.png)

**Ảnh (PNG nền trắng, xuất từ Mermaid — file `img/seq_dispatch_matching_offer.png`):** `seq_dispatch_matching_offer.png`

![sequence dispatch matching](../img/seq_dispatch_matching_offer.png)


## 4.10. Thiết kế Database per Service

**Hình gợi ý chèn vào Word:** `img/data_db_per_service_overview.png` và `img/erd_core_bounded_contexts.png`

![Hình 4.6. Kiến trúc dữ liệu database per service](../img/data_db_per_service_overview.png)

![Hình 4.7. ERD các service lõi](../img/erd_core_bounded_contexts.png)

### 4.10.1. ride_db — ERD

**Ảnh (PNG nền trắng, xuất từ Mermaid — file `img/erd_ride_service_db.png`):** `erd_ride_service_db.png`

![erd ride db](../img/erd_ride_service_db.png)


### 4.10.2. wallet_db — ERD

**Ảnh (PNG nền trắng, xuất từ Mermaid — file `img/erd_wallet_service_db.png`):** `erd_wallet_service_db.png`

![erd wallet db](../img/erd_wallet_service_db.png)


### 4.10.3. payment_db — ERD

**Ảnh (PNG nền trắng, xuất từ Mermaid — file `img/erd_payment_service_db.png`):** `erd_payment_service_db.png`

![erd payment db](../img/erd_payment_service_db.png)


### 4.10.4. driver_db — ERD

**Ảnh (PNG nền trắng, xuất từ Mermaid — file `img/erd_driver_service_db.png`):** `erd_driver_service_db.png`

![erd driver db](../img/erd_driver_service_db.png)


## 4.11. Thiết kế chi tiết từng microservice

Phần này mô tả rõ trách nhiệm và chức năng của từng service. Cách trình bày đi theo nguyên tắc: mỗi service sở hữu một phạm vi nghiệp vụ riêng, có dữ liệu riêng, API riêng và chỉ phối hợp với service khác thông qua HTTP/gRPC hoặc domain event.

### 4.11.1. API Gateway

**Vai trò:** điểm vào duy nhất của toàn hệ thống, chịu trách nhiệm tiếp nhận request từ ba ứng dụng frontend, xác thực JWT, định tuyến đến service tương ứng, điều phối realtime và chạy matching engine.

**Thông tin kỹ thuật:**

| Thuộc tính | Giá trị |
|---|---|
| Cổng HTTP | `3000` |
| Database/cache | Redis |
| Công nghệ | Node.js, TypeScript, Express, Socket.IO, Redis Adapter |
| Hình nên chèn | `img/gw_routing_map.png`, `img/gw_component_internal_stack.png` |

![Hình 4.8. API Gateway routing map](../img/gw_routing_map.png)

![Hình 4.9. Component nội bộ API Gateway](../img/gw_component_internal_stack.png)

**Chức năng chính:**

| Nhóm chức năng | Mô tả chi tiết |
|---|---|
| Xác thực request | Kiểm tra `Authorization: Bearer <token>`, giải mã JWT và gắn `x-user-id`, `x-user-role`, `x-user-email` vào request nội bộ |
| Định tuyến HTTP | Forward `/api/auth`, `/api/users`, `/api/rides`, `/api/payment`, `/api/wallet`, `/api/reviews`, `/api/ai` đến service tương ứng |
| gRPC bridge | Với các API cần độ trễ thấp như pricing estimate hoặc tra cứu driver, Gateway có thể chuyển HTTP request thành gRPC call |
| Socket.IO hub | Quản lý kết nối realtime, room theo `userId` và `rideId`, phát event trạng thái chuyến, offer tài xế, chat và signaling WebRTC |
| Driver matching | Nhận event `ride.created`, truy vấn Redis GEO, tính điểm tài xế và gửi offer theo nhiều vòng |
| Chuẩn hóa địa chỉ | Chuẩn hóa payload địa chỉ Việt Nam trước khi chuyển đến service phía sau |
| Giám sát | Cung cấp health check, readiness check, metrics Prometheus và Swagger docs |

**Quy tắc thiết kế:** client không gọi trực tiếp vào service phía sau; mọi request đều đi qua Gateway để thống nhất xác thực, logging, rate limiting và realtime fan-out.

### 4.11.2. Auth Service

**Vai trò:** nguồn sự thật duy nhất về danh tính, tài khoản, mật khẩu, OTP, access token và refresh token.

| Thuộc tính | Giá trị |
|---|---|
| Cổng HTTP | `3001` |
| Cổng gRPC | `50051` |
| Database | PostgreSQL `auth_db`, Redis cho OTP |
| Công nghệ | Express, Prisma, bcryptjs, jsonwebtoken, RabbitMQ |
| Hình nên chèn | `img/seq_auth_otp_register_reset.png` |

**Chức năng chính:**

| Chức năng | Mô tả |
|---|---|
| Đăng ký tài khoản | Tạo user mới theo số điện thoại, mật khẩu và vai trò |
| Gửi OTP | Sinh OTP, hash, lưu TTL trong Redis, gửi qua SMS hoặc log trong mock mode |
| Xác thực OTP | So khớp OTP, kiểm soát số lần thử và thời gian hết hạn |
| Đăng nhập | Kiểm tra mật khẩu bằng bcrypt, phát access token và refresh token |
| Làm mới token | Kiểm tra refresh token trong DB, phát access token mới |
| Đăng xuất | Thu hồi refresh token |
| Audit log | Ghi nhận các hành động nhạy cảm như login, OTP sent, register |
| gRPC validate user | Cho service nội bộ kiểm tra userId hoặc lấy thông tin user cơ bản |

**Dữ liệu chính:** `User`, `RefreshToken`, `OtpRecord`, `AuditLog`.

**Domain event:** khi đăng ký thành công, service phát `user.registered` để User Service tạo profile mặc định.

### 4.11.3. User Service

**Vai trò:** quản lý thông tin hồ sơ người dùng, tách biệt khỏi thông tin xác thực trong Auth Service.

| Thuộc tính | Giá trị |
|---|---|
| Cổng HTTP | `3007` |
| Cổng gRPC | `50052` |
| Database | PostgreSQL `user_db` |
| Công nghệ | Express, Prisma, Joi, gRPC |

**Chức năng chính:**

| Chức năng | Mô tả |
|---|---|
| Tạo profile tự động | Lắng nghe `user.registered` và tạo `UserProfile` tương ứng |
| Xem hồ sơ | Người dùng xem thông tin cá nhân của mình |
| Cập nhật hồ sơ | Cập nhật họ tên, avatar, trạng thái profile |
| Quản trị người dùng | Admin xem danh sách, xem chi tiết và đổi trạng thái tài khoản |
| gRPC profile lookup | Service khác tra cứu tên hiển thị, số điện thoại hoặc avatar khi cần |

**Ràng buộc:** `userId` tham chiếu logic đến `auth_db.User.id` nhưng không dùng foreign key cross-service; tính nhất quán được bảo đảm qua domain event và application logic.

### 4.11.4. Driver Service

**Vai trò:** quản lý vòng đời tài xế, hồ sơ phương tiện, bằng lái, trạng thái nhận cuốc và vị trí địa lý realtime.

| Thuộc tính | Giá trị |
|---|---|
| Cổng HTTP | `3003` |
| Cổng gRPC | `50055` |
| Database | PostgreSQL `driver_db`, Redis GEO |
| Công nghệ | Express, Prisma, Redis, RabbitMQ, gRPC |

**Chức năng chính:**

| Nhóm chức năng | Mô tả |
|---|---|
| Đăng ký tài xế | Lưu thông tin xe, biển số, màu xe, loại xe, bằng lái và ảnh phương tiện |
| Duyệt hồ sơ | Admin duyệt/từ chối/tạm ngưng tài xế; khi duyệt phát `driver.approved` |
| Trạng thái nhận cuốc | Tài xế bật `ONLINE`, tắt `OFFLINE`, hoặc bị chuyển `BUSY` khi đang chạy chuyến |
| Cập nhật vị trí | Lưu vị trí cuối cùng trong DB và cập nhật Redis GEO để Gateway tìm kiếm |
| Kiểm tra khả năng nhận chuyến | gRPC `CheckCanAcceptRide` kiểm tra trạng thái tài xế và điều kiện ví |
| Rating tài xế | Cập nhật `ratingAverage`, `ratingCount` khi nhận event từ Review Service |

**Ràng buộc nghiệp vụ:**

| Quy tắc | Diễn giải |
|---|---|
| Chỉ tài xế `APPROVED` mới được online | Hồ sơ phải được admin duyệt |
| Tài xế `BUSY` không nhận offer mới | Tránh gán nhiều chuyến đồng thời |
| Vị trí online phải có tọa độ hợp lệ | Redis GEO yêu cầu `lat/lng` hợp lệ |
| Ví phải đạt điều kiện | Nếu tài xế có nợ quá hạn hoặc ví chưa kích hoạt, không được nhận chuyến |

### 4.11.5. Booking Service

**Vai trò:** xử lý giai đoạn tiền chuyến đi, khi khách hàng xem giá, tạo booking tạm và xác nhận đặt xe.

| Thuộc tính | Giá trị |
|---|---|
| Cổng HTTP | `3008` |
| Cổng gRPC | `50053` |
| Database | PostgreSQL `booking_db` |
| Công nghệ | Express, Prisma, RabbitMQ, gRPC |

**Chức năng chính:**

| Chức năng | Mô tả |
|---|---|
| Tạo booking | Lưu điểm đón, điểm trả, loại xe, payment method và snapshot giá ước tính |
| Xác nhận booking | Chuyển `PENDING` sang `CONFIRMED` và phát event `booking.confirmed` |
| Hủy booking | Cho phép khách hủy khi chưa chuyển thành chuyến đang chạy |
| Lịch sử booking | Truy vấn lịch sử đặt xe của khách hàng |
| Expiry | Booking có thể hết hạn nếu khách không xác nhận trong thời gian cấu hình |

**Lý do tách khỏi Ride Service:** khách hàng có thể xem giá nhiều lần mà chưa tạo chuyến; Booking Service giúp giảm nhiễu cho Ride Service và là nền tảng để mở rộng đặt xe theo lịch.

### 4.11.6. Ride Service

**Vai trò:** quản lý vòng đời chuyến đi, trạng thái Ride, audit trail và các event nghiệp vụ liên quan đến chuyến.

| Thuộc tính | Giá trị |
|---|---|
| Cổng HTTP | `3002` |
| Cổng gRPC | `50054` |
| Database | PostgreSQL `ride_db` |
| Công nghệ | Express, Prisma, RabbitMQ, gRPC |
| Hình nên chèn | `img/stm_ride_lifecycle_simple.png` |

**Chức năng chính:**

| Nhóm chức năng | Mô tả |
|---|---|
| Tạo chuyến | Tạo Ride từ request trực tiếp hoặc từ `booking.confirmed` |
| State machine | Kiểm soát transition từ `CREATED` đến `COMPLETED` hoặc `CANCELLED` |
| Điều phối offer | Ghi nhận driver được offer, driver từ chối, timeout và số lần reassign |
| API cho khách | Tạo chuyến, xem chi tiết, hủy chuyến, xem lịch sử, gửi chat |
| API cho tài xế | Nhận cuốc, từ chối, đến điểm đón, bắt đầu, hoàn thành |
| Audit trail | Ghi `RideStateTransition` cho mọi chuyển trạng thái |
| Chat storage | Lưu tin nhắn giữa tài xế và khách trong `RideChatMessage` |

**Domain events published:** `ride.created`, `ride.offered`, `ride.assigned`, `ride.picking_up`, `ride.started`, `ride.completed`, `ride.cancelled`, `ride.chat_message`.

**Ràng buộc:** trạng thái kết thúc `COMPLETED` và `CANCELLED` là terminal state; không được quay lại trạng thái trước.

### 4.11.7. Pricing Service

**Vai trò:** tính giá cước ước tính và giá thực tế dựa trên loại xe, khoảng cách, thời gian, surge và gợi ý AI.

| Thuộc tính | Giá trị |
|---|---|
| Cổng HTTP | `3009` |
| Cổng gRPC | `50057` |
| Database | Không có database quan hệ, dùng Redis cache |
| Công nghệ | Express, Redis, gRPC, OSRM, AI HTTP client |

**Chức năng chính:**

| Chức năng | Mô tả |
|---|---|
| Ước tính giá | Tính `baseFare`, phí dịch vụ, cước km, cước phút, short-trip fee và surge |
| Tính khoảng cách | Ưu tiên OSRM để lấy khoảng cách theo đường đi, fallback Haversine |
| Surge multiplier | Lấy surge từ Redis hoặc AI Service |
| Tích hợp AI | Gọi AI Service để lấy ETA, price multiplier và recommended radius |
| API admin | Cho phép admin xem hoặc cập nhật surge zone trong demo |

**Công thức tổng quát:** `totalFare = max(round(subtotal * surgeMultiplier), minimumFare)`.

**Nguyên tắc khả dụng:** nếu OSRM hoặc AI lỗi, service dùng fallback để vẫn trả được giá ước tính.

### 4.11.8. Payment Service

**Vai trò:** xử lý thanh toán, gateway callback, voucher, fare, hoa hồng, thu nhập tài xế và event tài chính.

| Thuộc tính | Giá trị |
|---|---|
| Cổng HTTP | `3004` |
| Cổng gRPC | `50056` |
| Database | PostgreSQL `payment_db` |
| Công nghệ | Express, Prisma, MoMo, VNPay, RabbitMQ Outbox |
| Hình nên chèn | `img/act_payment_by_method.png` |

**Chức năng chính:**

| Nhóm chức năng | Mô tả |
|---|---|
| Khởi tạo thanh toán | Tạo payment intent cho MoMo/VNPay hoặc hoàn tất ngay với CASH |
| Xử lý IPN | Nhận callback từ MoMo/VNPay, kiểm tra chữ ký, cập nhật trạng thái |
| Idempotency | Dùng `idempotencyKey` để chống xử lý trùng IPN |
| Tính fare | Lưu `Fare` gồm base fare, distance fare, time fare, surge, total fare |
| Voucher | Kiểm tra điều kiện mã giảm giá, số lần dùng, thời gian hiệu lực |
| Commission | Tính platform fee theo loại xe |
| Driver earnings | Tạo `DriverEarnings` gồm gross fare, platform fee, net earnings, cash debt |
| Refund | Xử lý hoàn tiền khi chuyến bị hủy sau thanh toán |
| Outbox | Ghi `OutboxEvent` trong cùng transaction với payment để không mất event |

**Event quan trọng:** `payment.completed`, `payment.failed`, `driver.earnings.settled`, `refund.completed`.

### 4.11.9. Wallet Service

**Vai trò:** nguồn sự thật của ví tài xế, quản lý ký quỹ, pending earning, công nợ, rút tiền, merchant ledger và merchant balance.

| Thuộc tính | Giá trị |
|---|---|
| Cổng HTTP | `3006` |
| Database | PostgreSQL `wallet_db` |
| Công nghệ | Express, Prisma, RabbitMQ |
| Hình nên chèn | `img/stm_wallet_fintech.png` |

**Chức năng chính:**

| Nhóm chức năng | Mô tả |
|---|---|
| Tạo ví tài xế | Lắng nghe `driver.approved`, tạo ví `INACTIVE` |
| Ký quỹ | Khi top-up đủ 300.000 VND, chuyển tiền vào `lockedBalance` và kích hoạt ví |
| Ghi nhận thu nhập | Lắng nghe `driver.earnings.settled`, tạo `PendingEarning` T+24h |
| Công nợ CASH | Nếu tài xế thu tiền mặt, tạo `DebtRecord` bằng platform fee |
| Settlement | Sau 24h, giải phóng pending; trả nợ FIFO trước, phần còn lại vào available |
| Rút tiền | Tài xế tạo yêu cầu rút tiền, admin duyệt hoặc từ chối |
| Merchant ledger | Ghi nhận dòng tiền vào/ra của nền tảng |
| Merchant balance | Duy trì số dư tổng hợp của nền tảng |
| Lịch sử giao dịch | `WalletTransaction` lưu snapshot `balanceAfter` và idempotency key |

**Quy tắc tài chính:**

| Quy tắc | Diễn giải |
|---|---|
| Ký quỹ bắt buộc | Tài xế cần locked balance 300.000 VND để kích hoạt |
| Thu nhập không rút ngay | Net earning đi vào `pendingBalance` trong 24h |
| Nợ được tất toán trước | Khi có tiền vào, DebtRecord cũ nhất được trả trước |
| Giao dịch bất biến | Lịch sử ví không update tùy tiện; mỗi thay đổi tạo transaction mới |
| Chống trùng | Mọi top-up, earning, refund dùng idempotency key |

### 4.11.10. Notification Service

**Vai trò:** gửi thông báo đến người dùng qua email, SMS, push và in-app notification dựa trên domain event.

| Thuộc tính | Giá trị |
|---|---|
| Cổng HTTP | `3005` |
| Database | MongoDB `notification_db` |
| Công nghệ | Express, Mongoose, RabbitMQ, Nodemailer, Twilio, FCM |

**Chức năng chính:**

| Chức năng | Mô tả |
|---|---|
| Consume event | Lắng nghe `user.registered`, `ride.assigned`, `ride.completed`, `payment.completed`, `driver.approved` |
| Tạo notification | Lưu notification document với trạng thái `PENDING`, `SENT` hoặc `FAILED` |
| Gửi đa kênh | Email, SMS, push notification hoặc in-app |
| Retry | Thử lại khi gửi thất bại, tăng delay theo số lần retry |
| Admin API | Cho phép admin xem lịch sử thông báo và thống kê gửi thành công/thất bại |

**Lý do dùng MongoDB:** thông báo có schema linh hoạt, có thể thêm template data, channel-specific metadata mà không cần migration phức tạp.

### 4.11.11. Review Service

**Vai trò:** quản lý đánh giá hai chiều sau chuyến đi và cập nhật uy tín tài xế.

| Thuộc tính | Giá trị |
|---|---|
| Cổng HTTP | `3010` |
| Database | MongoDB `review_db` |
| Công nghệ | Express, Mongoose, RabbitMQ |

**Chức năng chính:**

| Chức năng | Mô tả |
|---|---|
| Tạo đánh giá | Khách đánh giá tài xế hoặc tài xế đánh giá khách sau chuyến |
| Kiểm tra hợp lệ | Một người chỉ đánh giá một lần cho một chiều đánh giá của chuyến |
| Lưu tag và nhận xét | Hỗ trợ rating 1-5, comment, tag nghiệp vụ |
| Ẩn đánh giá | Admin có thể ẩn review vi phạm |
| Cập nhật rating | Sau review, service phát `driver.rating_updated` để Driver Service cập nhật rating trung bình |

**Ràng buộc:** chỉ cho phép review trong cửa sổ thời gian cấu hình sau khi chuyến hoàn thành.

### 4.11.12. AI Service

**Vai trò:** cung cấp năng lực dự đoán và chatbot hỗ trợ, tách biệt khỏi backend Node.js để tận dụng hệ sinh thái Python ML.

| Thuộc tính | Giá trị |
|---|---|
| Cổng HTTP | `8000` |
| Database | Không dùng DB, model file `.joblib` và knowledge base text |
| Công nghệ | FastAPI, scikit-learn, joblib, sentence-transformers, FAISS |
| Hình nên chèn | `img/ai_ml_sklearn_train_infer_pipeline.png`, `img/ai_agent_rag_retrieval.png` |

**Chức năng chính:**

| Chức năng | Mô tả |
|---|---|
| ETA và surge | Dự đoán thời gian đến và hệ số giá theo khoảng cách, giờ, loại ngày |
| Accept probability | Dự đoán xác suất tài xế nhận chuyến dựa trên đặc điểm tài xế và bối cảnh cuốc |
| Wait time | Dự đoán thời gian khách phải chờ dựa trên demand và supply |
| RAG chatbot | Trả lời câu hỏi hỗ trợ dựa trên knowledge base trong `app/data/knowledge` |
| Fallback | Nếu thiếu model hoặc lỗi inference, trả response rule-based để hệ thống không gián đoạn |

**Nguyên tắc tích hợp:** AI Service không phải dependency bắt buộc của nghiệp vụ chính; Pricing Service và API Gateway đều có timeout và fallback.

### 4.11.13. Tổng hợp trách nhiệm service theo nghiệp vụ

| Nghiệp vụ | Service chính | Service phối hợp |
|---|---|---|
| Đăng ký/đăng nhập | Auth Service | API Gateway, User Service, Notification Service |
| Cập nhật hồ sơ khách | User Service | Auth Service |
| Đăng ký tài xế | Driver Service | Auth Service, Wallet Service, Notification Service |
| Duyệt tài xế | Driver Service | Admin Dashboard, Wallet Service |
| Xem giá trước chuyến | Pricing Service | Booking Service, AI Service, API Gateway |
| Đặt xe | Booking Service, Ride Service | Pricing Service, API Gateway |
| Matching tài xế | API Gateway | Driver Service, Wallet Service, AI Service, Redis |
| Thực hiện chuyến | Ride Service | Driver Service, API Gateway |
| Thanh toán | Payment Service | Wallet Service, MoMo, VNPay |
| Ví tài xế | Wallet Service | Payment Service, Driver Service |
| Thông báo | Notification Service | RabbitMQ producers |
| Đánh giá | Review Service | Ride Service, Driver Service |
| Chat/gọi thoại | API Gateway | Ride Service, Customer App, Driver App |
| Chatbot hỗ trợ | AI Service | Customer App, Driver App, API Gateway |

## 4.12. Ranh giới Aggregate và nhất quán trong transaction

**Mục đích (bước 3.7 trong §4.0):** mỗi **Aggregate Root (AR)** là ranh giới **một giao dịch CSDL** — chỉnh sửa trạng thái nghiệp vụ qua các method trên AR hoặc Application Service của đúng BC; không cập nhật “xuyên service” vào bảng của BC khác.

| Bounded Context | Aggregate Root (chính) | Thực thể / VO gắn liền | Ghi chú nhất quán |
|---|---|---|---|
| Ride | `Ride` | điểm đón/trả, cước, trạng thái | Chuyển trạng thái bắt buộc qua **state machine** (không gán `status` tùy ý) |
| Driver | `Driver` | GPLX, xe, vị trí, availability | `DriverLocation` cập nhật tần suất cao nhưng vẫn thuộc quyền sở hữu driver-service |
| Wallet | `DriverWallet` | `WalletTransaction`, `PendingEarning`, `DebtRecord` | Giao dịch ví append-only / idempotency key; settlement + FIFO nợ trong cùng transaction logic |
| Payment | `Payment` (và luồng liên quan) | giao dịch, **OutboxEvent** | Ghi Payment và Outbox trong **một transaction** (pattern Outbox) |
| Booking | `Booking` | snapshot giá ước tính | BOOKING_CONFIRMED → event sang Ride, không sửa Ride trực tiếp từ booking-service |
| Auth | `User` (tài khoản) | refresh token, OTP | OTP TTL Redis; mật khẩu hash |
| Các BC còn lại | `UserProfile`, `Review`, `Notification`, … | tùy mô hình | Tuân **database-per-service**; chỉ đồng bộ qua **sự kiện** hoặc **API công khai** |

## 4.13. Giao tiếp giữa microservice, sở hữu dữ liệu và mẫu tích hợp

**Giao tiếp đồng bộ (ít coupling, độ trễ thấp cho luồng request–response):**

- **Client → API Gateway:** HTTPS / WebSocket (Socket.IO).
- **Gateway → service:** HTTP proxy (auth, wallet, …) hoặc **gRPC** (ride, driver lookup, pricing, booking) — Gateway đóng vai **API Gateway + Anti-Corruption** (timeout, chuẩn hóa payload).

**Giao tiếp bất đồng bộ:**

- **RabbitMQ** (topic exchange): domain events (`ride.completed`, `booking.confirmed`, `driver.earning.settled`, …) — **Integration pattern: event-driven notification**; consumer **tự trị**, có thể **replay** (trong giới hạn vận hành).

**Sở hữu dữ liệu:** mỗi microservice **sở hữu duy nhất** một (hoặc vài) schema/DB phù hợp §4.10 — không chia sẻ bảng giữa service; truy vấn xuyên BC qua **API hoặc bản sao sự kiện (eventual consistency)**.

**Các mẫu tích hợp tiêu biểu trong đề tài:**

| Mẫu | Chỗ áp dụng |
|---|---|
| **Database per service** | Mỗi service + Prisma schema riêng (§4.10) |
| **Transactional Outbox** | payment-service (và luồng cần “ghi DB + phát event” an toàn) — lý thuyết **§2.2.3** |
| **Idempotent consumer / idempotency key** | IPN MoMo/VNPay; ghi có ví — **Chương 5 §5.2** |
| **Anti-Corruption Layer** | API Gateway chuyển đổi REST ↔ gRPC, chuẩn hóa địa chỉ; tích hợp AI có timeout + fallback |
| **Strangler / Gateway** | Một điểm vào duy nhất từ internet tới cluster |
| **Saga (ủy nhiệm / choreography)** | Chuỗi **Ride completed → Payment → Wallet credit/refund** không dùng một transaction 2PC; điều phối bằng **sự kiện** — chi tiết **§5.7** |

---

# CHƯƠNG 5: GIẢI PHÁP CÔNG NGHỆ

## 5.1. Thuật toán Dispatch Chi tiết

### 5.1.1. Hàm tính điểm

```
score(driver, rideRequest) = 
    w_dist  × (1 - dist_km / max_dist_km)     // 0.40 — gần hơn, điểm cao hơn
  + w_rate  × (rating / 5.0)                  // 0.25 — đánh giá tốt
  + w_idle  × idleTimeFactor(driver)           // 0.15 — chờ lâu, ưu tiên hơn
  + w_acc   × acceptanceRate                   // 0.15 — hay nhận cuốc
  - w_can   × cancellationRate                 // 0.05 — hay hủy, trừ điểm
  + ai_adjustment                              // tùy chọn: [0, 0.1]
```

**idleTimeFactor**: `min(1.0, idleMinutes / 30)` — chuẩn hóa 0→1 trong 30 phút

**ai_adjustment**: xác suất AI dự đoán driver chấp nhận, nhân với 0.1 để giữ tỷ trọng nhỏ

### 5.1.2. Flowchart Dispatch

**Ảnh (PNG nền trắng, xuất từ Mermaid — file `img/flow_dispatch_multi_radius_rounds.png`):** `flow_dispatch_multi_radius_rounds.png`

![flowchart dispatch rounds](../img/flow_dispatch_multi_radius_rounds.png)


## 5.2. Idempotent Payment Processing

### 5.2.1. Vấn đề

```
Timeline của IPN callback:
t=0s:  MoMo gọi IPN lần 1
t=2s:  Backend xử lý OK → credited
t=3s:  Network timeout → MoMo không nhận được response
t=10s: MoMo retry IPN lần 2
       ❌ Nếu không có idempotency: credited 2 lần!
```

### 5.2.2. Giải pháp với idempotencyKey

**Ảnh (PNG nền trắng, xuất từ Mermaid — file `img/seq_payment_ipn_idempotent.png`):** `seq_payment_ipn_idempotent.png`

![sequence ipn idempotency](../img/seq_payment_ipn_idempotent.png)


## 5.3. Pending Balance Settlement

### 5.3.1. Thiết kế

**Ảnh (PNG nền trắng, xuất từ Mermaid — file `img/flow_wallet_pending_tplus24.png`):** `flow_wallet_pending_tplus24.png`

![flowchart pending settlement](../img/flow_wallet_pending_tplus24.png)


### 5.3.2. Debt Settlement FIFO

```
Ví dụ: Tài xế có 3 khoản nợ
  Nợ A: 20k (oldest, created T-1)
  Nợ B: 30k (created T-0.5)
  Nợ C: 15k (newest)

Thanh toán 40k (từ top-up):
  1. Trả hết Nợ A: 20k → A.status = SETTLED
  2. Trả một phần Nợ B: 20k → B.remaining = 10k, B.status = ACTIVE
  3. Nợ C: chưa đụng
```

## 5.4. WebRTC Architecture

**Ảnh (PNG nền trắng, xuất từ Mermaid — file `img/seq_webrtc_signaling_gateway.png`):** `seq_webrtc_signaling_gateway.png`

![sequence webrtc signaling](../img/seq_webrtc_signaling_gateway.png)


## 5.5. Tính Hoa hồng

```
Tỷ lệ hoa hồng theo loại xe:
  MOTORBIKE / SCOOTER: 20%
  CAR_4:               18%
  CAR_7:               15%

Ví dụ chuyến CAR_4 cước 163.850₫:
  grossFare     = 163.850₫
  commissionRate = 18%
  platformFee   = 163.850 × 0.18 = 29.493₫
  netEarnings   = 163.850 - 29.493 = 134.357₫

  (nếu có voucher giảm 20k khách dùng):
  voucherDiscount = 20.000₫  ← platform chịu
  grossFare đến tài xế vẫn = 163.850₫ (không đổi)
  netEarnings = 134.357₫ (không đổi)
  Merchant OUT thêm 20k voucher
```

## 5.6. Các mẫu thiết kế phần mềm áp dụng (Phần 5)

> **Phần 5 — Design patterns:** các pattern dưới đây **không lý thuyết suông** — đều có chỗ hiện thực tương ứng trong repo (Gateway, service, ví, thanh toán).

| Mẫu | Vai trò trong hệ thống đặt xe | Gợi ý vị trí trong code / kiến trúc |
|---|---|---|
| **State** | Mô hình hóa vòng đời `Ride`, chuyển trạng thái hợp lệ | `ride-state-machine.ts`, diagram **§4.7** |
| **Strategy** | Thay đổi thuật toán matching/scoring hoặc nhánh thanh toán theo provider | Dispatch engine; MoMo vs VNPay handler |
| **Repository** | Tách truy cập CSDL khỏi domain service | Prisma trong từng service |
| **Domain Event + Observer** | Publish–subscribe qua RabbitMQ, giảm coupling BC | **§4.5**, `img/evt_rabbitmq_domain_flow.png` |
| **Anti-Corruption Layer** | Gateway và lớp adapter tích hợp AI / map / cổng thanh toán | API Gateway, timeout AI **§4.11.12** |
| **Transactional Outbox** | Đảm bảo ghi nhận thanh toán và phát sự kiện nhất quán | **§2.2.3**, payment flow **§5.2** |
| **Saga (choreography)** | Chuỗi giao dịch đa bước không 2PC (ride → pay → ví) | **§5.7** |
| **Adapter** | Redis Adapter cho Socket.IO cluster; HTTP↔gRPC bridge | **§6.2**, `img/gw_component_internal_stack.png` |
| **Facade** | API Gateway che giấu nhiều microservice phía sau một endpoint public | **§4.11.1** |

## 5.7. Tối ưu luồng giao dịch thanh toán trong kiến trúc vi dịch vụ (Phần 6)

Trong MSA, **không thể** dùng một transaction ACID trùm `ride_db`, `payment_db`, `wallet_db`. Đề tài xử lý bằng **phân tách trách nhiệm + eventual consistency**:

1. **Ride Service** hoàn tất chuyến và phát `ride.completed` (sự kiện đã gắn với nghiệp vụ Ride).
2. **Payment Service** tiêu thụ sự kiện, ghi nhận thanh toán, **idempotency** theo mã giao dịch/IPN — tránh ghi có hai lần khi cổng retry **§5.2**.
3. Khi cần, **Outbox** đảm bảo “ghi DB + enqueue” không lệch (xem **§2.2.3**).
4. **Wallet Service** nhận `driver.earning.settled` / `refund.completed`, cập nhật **pendingBalance**, **DebtRecord**, FIFO — **§5.3**.

Như vậy **tối ưu giao dịch** ở đây là **đúng với bản chất phân tán**: đổi lấy **độ trễ chấp nhận được** giữa các BC, lấy **bất biến tài chính** (không double-credit) và **vết kiểm toán**.

## 5.8. Ứng dụng AI và pipeline (Phần 7)

**AI Service** (FastAPI) cung cấp: dự đoán ETA/surge, xác suất accept cho dispatch, RAG chatbot. **Pipeline** tổng quát: `features` → (optional) model `.joblib` → response JSON; RAG: embed query → FAISS → LLM/rerank — chi tiết **§4.11.12** và khảo sát nghiệp vụ **§3.6.9**.

**Hình gợi ý (thư mục `img/`):** `img/ai_ml_sklearn_train_infer_pipeline.png`, `img/ai_agent_rag_retrieval.png`.

Nguyên tắc vận hành: mọi lời gọi AI có **timeout ngắn** và **fallback** rule-based tại Pricing/Gateway để không chặn luồng đặt xe.

---

# CHƯƠNG 6: HIỆN THỰC VÀ TRIỂN KHAI

## 6.1. Tổ chức Monorepo

```
cab-booking-system/
├── apps/
│   ├── customer-app/     # React SPA :4000 — Material UI + Leaflet
│   ├── driver-app/       # React SPA :4001 — Material UI + Socket.IO
│   └── admin-dashboard/  # React SPA :4002 — Material UI + DataGrid
├── services/
│   ├── api-gateway/      # Express + Socket.IO + gRPC bridge
│   ├── auth-service/     # OTP, JWT, user accounts
│   ├── ride-service/     # Ride lifecycle, state machine
│   ├── driver-service/   # Driver profiles, go-online
│   ├── payment-service/  # MoMo, VNPay, IPN handlers
│   ├── notification-service/
│   ├── wallet-service/   # Driver wallet, settlement
│   ├── user-service/     # Customer profiles
│   ├── booking-service/  # Booking history, vouchers
│   ├── pricing-service/  # Fare calculation, surge
│   ├── review-service/   # Ratings
│   └── ai-service/       # Python/FastAPI surge model
├── shared/
│   ├── types/            # Shared TypeScript interfaces
│   └── proto/            # gRPC .proto definitions
├── scripts/
│   ├── seed-database.ts  # Seed sample data
│   ├── reset-database.sh
│   └── smoke-tests/
└── docker-compose.yml
```

## 6.2. Cấu trúc API Gateway

**Ảnh (PNG nền trắng, xuất từ Mermaid — file `img/gw_graph_internal_components.png`):** `gw_graph_internal_components.png`

![graph api gateway internals](../img/gw_graph_internal_components.png)


**Lý do tách HTTP và gRPC:**
- auth-service và wallet-service: không expose gRPC, dùng HTTP proxy
- `drivers/me/*` routes: dùng HTTP proxy (trust-sensitive, cần flexibility)
- Các route còn lại: gRPC bridge cho hiệu năng

## 6.3. Cấu trúc một Service điển hình — wallet-service

**Ảnh (PNG nền trắng, xuất từ Mermaid — file `img/graph_wallet_layered_services.png`):** `graph_wallet_layered_services.png`

![graph wallet service layers](../img/graph_wallet_layered_services.png)


## 6.4. Flow Đăng ký Tài xế

**Ảnh (PNG nền trắng, xuất từ Mermaid — file `img/seq_driver_registration_approval.png`):** `seq_driver_registration_approval.png`

![sequence driver registration flow](../img/seq_driver_registration_approval.png)


## 6.5. Giao diện người dùng

### 6.5.1. Customer App — Màn hình chính

Màn hình HomeMap gồm:
- **Bản đồ Leaflet** toàn màn hình, hiển thị marker tài xế online (cập nhật qua Socket.IO)
- **Bottom Sheet** có thể kéo lên: input địa chỉ đón/đến với autocomplete
- **Pending payment banner**: cảnh báo nếu có thanh toán đang chờ
- **Tracking panel**: khi chuyến đang chạy, hiển thị ETA, vị trí tài xế, thông tin chuyến

### 6.5.2. Driver App — Wallet Page

4 thành phần số dư luôn hiển thị:
```
┌─────────────────────────────────────────────┐
│  Số dư khả dụng               450,000₫      │ ← có thể rút
│  Tiền chờ xử lý  ⏱            131,080₫      │ ← T+24h
│  Công nợ platform ⚠            -20,000₫      │ ← chuyến cash
│  Ký quỹ (khoá)  🔒            300,000₫      │ ← không rút được
└─────────────────────────────────────────────┘
```

Tab "Công nợ" hiển thị danh sách DebtRecord:
```
┌─────────────────────────────────────────────┐
│ [Còn 2 ngày]   Mã: ABC123                   │
│ Tạo: 27/04/2025  Hạn: 29/04/2025           │
│                            -20,000₫          │
├─────────────────────────────────────────────┤
│ [Quá hạn!] ⚠  Mã: XYZ789                   │
│ Tạo: 20/04/2025  Hạn: 22/04/2025           │
│                            -15,000₫          │
└─────────────────────────────────────────────┘
```

### 6.5.3. Admin — Driver Approvals

DataGrid với filter theo status (PENDING/APPROVED/REJECTED), hành động Approve/Reject ngay trên row. Socket.IO nhận `driver.approved` event để tự refresh danh sách.

## 6.6. Kiểm thử

### 6.6.1. Unit Tests

Các class được unit test với Jest:

| File | Test case |
|---|---|
| `driver-wallet.service.ts` | `debitCommission` tạo DebtRecord đúng dueDate |
| `driver-wallet.service.ts` | `settlePendingEarnings` trả debt FIFO trước khi credit available |
| `driver-wallet.service.ts` | `applyDelta` EARN → pendingBalance (không vào available) |
| `driver-wallet.service.ts` | `applyDelta` TOP_UP → pay debt trước, dư vào available |
| `ride-state-machine.ts` | Chuyển đổi hợp lệ: CREATED→FINDING_DRIVER→OFFERED→ASSIGNED→ACCEPTED→... |
| `ride-state-machine.ts` | Chuyển đổi không hợp lệ: COMPLETED→IN_PROGRESS throw error |
| `payment.service.ts` | IPN handler idempotent với key trùng lặp |

### 6.6.2. Integration Tests — Các kịch bản đầy đủ

**Kịch bản 1: Chuyến online hoàn thành, thanh toán MoMo**
```
1. Tạo ride, dispatch, driver accept
2. Ride → COMPLETED
3. Publish ride.completed → payment-service
4. Payment create, init MoMo
5. Mock IPN (resultCode=0)
6. Verify: driver_earnings created
7. Verify: driver.earning.settled published
8. wallet-service consume: pendingBalance += netEarnings
9. PendingEarning created với settleAt = T+24h
10. Sau 24h: availableBalance tăng, pendingBalance giảm
```

**Kịch bản 2: Chuyến tiền mặt, công nợ**
```
1. Ride CASH → COMPLETED
2. payment-service publish driver.earning.settled {paymentMethod=CASH}
3. wallet-service: debitCommission → debt += commission
4. DebtRecord created {status=ACTIVE, dueDate=T+2}
5. Sau 2 ngày: cron mark OVERDUE
6. Tài xế nạp tiền: TOP_UP → settle DebtRecords FIFO
```

**Kịch bản 3: IPN trùng lặp không tạo giao dịch kép**
```
1. Payment MoMo IPN lần 1 → processed, credited
2. Payment MoMo IPN lần 2 (same orderId) → idempotencyKey found, skip
3. Verify: wallet balance unchanged after 2nd IPN
```

## 6.7. Bảo mật, hạ tầng và triển khai

### 6.7.1. Ranh giới tin cậy bảo mật

Hệ thống chia thành bốn vùng tin cậy chính: client public, gateway edge, service nội bộ và data/secrets layer. Cách chia này giúp báo cáo rõ ràng hơn khi trình bày vì sao client không được gọi trực tiếp vào database hoặc microservice phía sau.

**Hình gợi ý chèn vào Word:** `img/sec_trust_boundary_multitier.png`

![Hình 6.1. Security trust boundary](../img/sec_trust_boundary_multitier.png)

| Vùng | Thành phần | Biện pháp bảo vệ |
|---|---|---|
| Public client | Customer App, Driver App, Admin Dashboard | HTTPS, JWT, CORS, rate limit |
| Edge/Gateway | API Gateway, Socket.IO server | Verify token, inject identity headers, request logging, address normalization |
| Internal services | Auth, Ride, Driver, Payment, Wallet, Pricing, Notification, Review, AI | Internal token, service URL private, validation bằng Joi/Pydantic |
| Data layer | PostgreSQL, MongoDB, Redis, RabbitMQ, secrets | Network isolation trong Docker, không expose credential ra frontend |

**Các điểm bảo mật quan trọng:**

| Rủi ro | Cách xử lý trong hệ thống |
|---|---|
| Lộ mật khẩu | Mật khẩu hash bằng bcrypt, không lưu plaintext |
| Lộ OTP | OTP được hash/lưu TTL; API lấy OTP chỉ bật ở dev/mock và bị tắt trong production |
| Gọi API trái quyền | API Gateway kiểm tra JWT và role trước khi proxy |
| Callback thanh toán giả | Payment Service kiểm tra chữ ký MoMo/VNPay |
| IPN gọi lặp | Idempotency key ngăn cộng tiền nhiều lần |
| Dữ liệu tài chính sai lệch | Wallet transaction và merchant ledger ghi append-only |
| Service nội bộ bị gọi trực tiếp | Dùng internal token và network private trong Docker |

### 6.7.2. Hạ tầng local, triển khai thử nghiệm trên AWS và kiến trúc đám mây tham chiếu

**Môi trường phát triển và demo chính:** **Docker Compose** trên máy cục bộ (hoặc máy chủ lab) — toàn bộ backend, frontend, PostgreSQL, MongoDB, Redis, RabbitMQ và stack quan sát có thể khởi động đồng bộ.

**Môi trường triển khai thử nghiệm (Swarm):** repo kèm hướng dẫn **Docker Swarm trên AWS EC2** (`deploy/SWARM-SETUP.md`): manager on-demand + worker spot, **Elastic IP** cho điểm vào API Gateway, `docker stack deploy` từ `docker-stack.thesis.yml`, đồng bộ secrets và khởi tạo DB/migrate. Đây là **bản minh họa vận hành** (HA Raft, scale worker), **không** tương đương hợp đồng SLA production.

**Thành phần runtime:**

| Nhóm | Thành phần |
|---|---|
| Frontend | Customer App `:4000`, Driver App `:4001`, Admin Dashboard `:4002` |
| Backend | API Gateway và 11 service nghiệp vụ |
| AI | FastAPI AI Service `:8000` |
| Data | PostgreSQL, MongoDB, Redis |
| Messaging | RabbitMQ topic exchange |
| Monitoring | Prometheus, Grafana, (tùy cấu hình: Loki, Promtail) |

**Tham chiếu kiến trúc đám mây “đích” (ECS/RDS/…):** có thể trình bày song song để so sánh với Swarm thực tế — hình **`img/deploy_aws_reference_ecs.png`**.

**Hình gợi ý chèn vào Word:** `img/deploy_aws_reference_ecs.png`

![Hình 6.2. Kiến trúc triển khai AWS tham chiếu (ECS/RDS/...)](../img/deploy_aws_reference_ecs.png)

## 6.8. Giám sát và quan sát hệ thống (Phần 8)

> **Phần 8 — System monitor:** nhằm quan sát sức khỏe cluster và dịch vụ, không chỉ “có chạy hay không”.

| Thành phần | Vai trò |
|---|---|
| **Prometheus** | Thu **metrics** HTTP từ service ( và từ **node-exporter**, **cAdvisor** trên từng node khi triển khai Swarm) |
| **Grafana** | Dashboard tổng quan CPU, RAM, container; port ví dụ `:3030` trên môi trường Swarm (xem `deploy/SWARM-SETUP.md`) |
| **Health endpoint** | API Gateway `/health` và health riêng từng service (khi bật) |

Trong báo cáo Word, có thể chèn **`img/deploy_swarm_aws_asbuilt.png`** để minh họa **luồng CI/CD + DNS → Swarm** (phần observability nằm cùng cluster).

## 6.9. CI/CD và quy trình triển khai (Phần 10)

Pipeline **GitHub Actions** điển hình: kiểm tra/build image → đẩy **Docker Hub** → SSH vào manager chạy `docker stack deploy` (chi tiết tùy nhánh `main` và secrets repo).

**Hình gợi ý (thư mục `img/`):** `img/cicd_github_actions_docker.png`.

> **Phần 9 — Bảo mật:** đã trình bày tại **§6.7.1** và hình `img/sec_trust_boundary_multitier.png`.

---

# CHƯƠNG 7: ĐÁNH GIÁ VÀ THẢO LUẬN

## 7.1. Đánh giá chức năng

### 7.1.1. Kết quả kiểm thử chức năng

| Kịch bản | Kết quả | Chi tiết |
|---|---|---|
| Đặt xe, thanh toán MoMo | ✅ Đạt | pendingBalance += netEarnings trong < 500ms sau IPN |
| Đặt xe, thanh toán VNPay | ✅ Đạt | VNPay signature verify đúng, idempotent |
| Đặt xe tiền mặt | ✅ Đạt | DebtRecord ACTIVE, dueDate = T+2 |
| IPN trùng lặp | ✅ Đạt | 2nd IPN bị bỏ qua, không credit 2 lần |
| Hủy chuyến online, hoàn tiền | ✅ Đạt | Refund debit ngược wallet driver |
| Tài xế PENDING không go-online | ✅ Đạt | 403 với message tiếng Việt |
| Tài xế chưa nạp 300k không go-online | ✅ Đạt | canAcceptRide=false, wallet INACTIVE |
| Tài xế nạp tiền tất toán nợ FIFO | ✅ Đạt | Nợ cũ nhất được trả trước |
| Settlement T+24h | ✅ Đạt | Available tăng, pending giảm, debt trừ đúng |
| Chat giữa tài xế và khách | ✅ Đạt | Socket.IO message trong 50ms |
| Gọi thoại WebRTC | ✅ Đạt | P2P audio kết nối trên cùng LAN |
| Admin duyệt hồ sơ | ✅ Đạt | Socket notify Driver App ngay lập tức |
| Dispatch 3 vòng | ✅ Đạt | Mở rộng bán kính đúng quy trình |

### 7.1.2. Đánh giá Hệ thống Ví Tài chính

Thực hiện 10 kịch bản tài chính và kiểm tra tính nhất quán:

| Kịch bản | Số dư trước | Operation | Số dư sau (expected) | Kết quả |
|---|---|---|---|---|
| Top-up 300k (kích hoạt) | bal=0 | TOP_UP 300k | locked=300k, avail=0 | ✅ |
| Top-up thêm 100k | avail=0, debt=0 | TOP_UP 100k | avail=100k | ✅ |
| Cash ride commission 20k | avail=100k | COMMISSION 20k | avail=80k, debt=20k | ✅ |
| Top-up 10k trả nợ một phần | debt=20k | TOP_UP 10k | debt=10k, avail+0 | ✅ |
| Top-up 50k trả hết nợ + dư | debt=10k | TOP_UP 50k | debt=0, avail=40k | ✅ |
| Online ride +131k pending | pend=0 | EARN 131k | pend=131k | ✅ |
| Settlement sau 24h (nợ=0) | pend=131k, avail=40k | SETTLE | avail=171k, pend=0 | ✅ |
| Settlement khi có nợ 15k | pend=80k, debt=15k | SETTLE | avail=65k, pend=0, debt=0 | ✅ |
| Rút tiền 50k | avail=65k | WITHDRAW 50k | avail=15k | ✅ |
| Rút quá số dư khả dụng | avail=15k | WITHDRAW 20k | Error 400 | ✅ |

## 7.2. Đánh giá hiệu năng

### 7.2.1. Response time

Đo lường trên môi trường Docker local, 10 requests liên tiếp:

| Endpoint | Min | Avg | Max | P95 |
|---|---|---|---|---|
| GET /wallet/balance | 35ms | 42ms | 68ms | 61ms |
| GET /wallet/debt-records | 28ms | 35ms | 55ms | 49ms |
| POST /drivers/me/online | 150ms | 185ms | 310ms | 280ms |
| POST /rides (đặt xe) | 180ms | 210ms | 380ms | 345ms |
| GET /rides/:id | 22ms | 28ms | 45ms | 40ms |
| POST /rides/:id/accept | 88ms | 110ms | 175ms | 160ms |

*Đo tại: [Thông tin cấu hình máy tính]*

### 7.2.2. Dispatch timing

Mô phỏng với 5 tài xế online:

| Kịch bản | Số vòng | Thời gian |
|---|---|---|
| Tài xế trong 2km (vòng 1) | 1 | ~800ms |
| Tài xế trong 3km, không có 2km | 2 | ~2.1s |
| Tài xế trong 5km | 3 | ~4.5s |
| Không có tài xế trong 5km | 3 (thất bại) | ~5.2s |

## 7.3. Thảo luận

### 7.3.1. Ưu điểm của phương pháp DDD

Việc áp dụng DDD mang lại:
1. **Ranh giới service rõ ràng**: mỗi BC là một bounded context, không service nào biết implementation của service khác.
2. **Ubiquitous language nhất quán**: code dùng đúng tên nghiệp vụ (`pendingBalance`, `cashDebt`, `DebtRecord`) thay vì tên kỹ thuật.
3. **Domain model phong phú**: Wallet không chỉ là CRUD — nó có behavior (`creditEarning`, `settlePendingEarnings`, `settleDebtRecordsFifo`).
4. **Domain Events liên kết loose**: Payment và Wallet không biết nhau trực tiếp, chỉ giao tiếp qua event.

### 7.3.2. Điểm mạnh

- Kiến trúc microservices đầy đủ với database isolation và event-driven communication
- Hệ thống ví tài chính nghiêm ngặt với audit trail bất biến và idempotency ở mọi layer
- Dispatch algorithm có thể mở rộng thêm tiêu chí mà không thay đổi cấu trúc
- Giao tiếp real-time đa kênh: socket, chat, WebRTC
- AI service optional với graceful fallback

### 7.3.3. Hạn chế

- **L3/L4 wallet enforcement** (force deduction từ deposit khi overdue) chưa có cron job chạy định kỳ
- **Load testing** chưa thực hiện — response time đo trên 10 requests, chưa có concurrent load
- **WebRTC TURN** dùng free STUN — không đảm bảo cho mạng cellular với symmetric NAT
- **AI model** dùng dữ liệu mô phỏng — chưa validate với dữ liệu thực tế
- **Triển khai production đa vùng / ECS / RDS** như bản vận hành thương mại đầy đủ **chưa** có — trong phạm vi đề tài có **Docker Compose (dev)** và **Docker Swarm thử nghiệm trên AWS** (**§6.7.2–6.9**)

## 7.4. Khả năng mở rộng và tối ưu đáp ứng tải (Phần 11)

> **Phần 11 — System scalability:** hệ thống được thiết kế để **scale theo chiều ngang** ở lớp **stateless** (hầu hết microservice + Gateway), trong khi **stateful** (PostgreSQL, MongoDB, Redis, RabbitMQ) tách riêng hoặc gán placement constraint (ví dụ chỉ manager trong cấu hình Swarm demo).

| Chiến lược | Áp dụng trong đề tài |
|---|---|
| **Database per service** | Giảm khóa chung; scale từng BC độc lập về dữ liệu — §4.10 |
| **Stateless service + replicas** | `docker service scale`/replicas trên Swarm; Gateway dùng **Redis Adapter** để Socket.IO đa instance |
| **Cache & GEO** | Redis **GEO** cho query tài xế O(log N) thay vì quét toàn bảng |
| **Async hàng đợi** | RabbitMQ giải hệ số đồng bộ giữa các BC khi peak event |
| **Tách AI** | AI Service scale riêng; timeout + fallback tránh nghẽn cổ chai request chính |

Giới hạn thực nghiệm: **chưa có kết quả load test quy mô lớn** (xem §7.3.3); số đo latency hiện có ở §7.2.1 trên môi trường Docker cục bộ.

---

# CHƯƠNG 8: KẾT LUẬN

> **Phần 12 — Kết luận:** Chương này tổng kết kết quả đạt được (§8.1), bài học (§8.2) và hướng mở rộng (§8.3), đóng vòng **Refine & validate** (bước 3.12 trong §4.0).

## 8.1. Tổng kết những gì đã đạt được

Đề tài đã hoàn thành đầy đủ các mục tiêu đề ra:

**Về phân tích thiết kế:**
- Áp dụng DDD phân rã hệ thống thành 11 Bounded Context với Context Map rõ ràng (**§4.0–4.13**)
- Xây dựng Ubiquitous Language nhất quán giữa code và nghiệp vụ
- Thiết kế Domain Model chi tiết cho các BC cốt lõi: Ride, Driver, Wallet, Payment; bổ sung Booking, Review, Notification trong catalog sự kiện
- Thiết kế Domain Event catalog và luồng event-driven giữa các BC; **data ownership** và **integration patterns** được hệ thống hóa

**Về hiện thực:**
- 11 microservice backend Node.js/TypeScript (trong đó **booking-service** tách bước đặt chỗ và snapshot giá), 3 SPA React, 1 **ai-service** Python — đóng gói Docker; môi trường **Docker Compose** (dev) và tài liệu **Docker Swarm/AWS** (demo)
- **notification-service** (MongoDB), **review-service** (MongoDB), tích hợp map/OSM, Redis GEO + Socket.IO cluster adapter
- Hệ thống thanh toán dual-gateway (MoMo + VNPay) với idempotent IPN handling
- Hệ thống ví tài xế fintech-grade với 4 thành phần số dư và settlement logic
- Thuật toán dispatch 3 vòng với weighted scoring và AI adjustment (timeout + fallback)
- Real-time communication qua Socket.IO + WebRTC; **Prometheus/Grafana** và pipeline **GitHub Actions** (xem Chương 6)

## 8.2. Bài học rút ra

1. **DDD giúp microservice decomposition tự nhiên hơn** — khi BC được xác định đúng, ranh giới service trở nên hiển nhiên.
2. **Idempotency là bắt buộc cho tài chính** — mọi mutation tài chính phải có `idempotencyKey`.
3. **Event-driven tốt cho loose coupling nhưng phức tạp để debug** — cần correlation ID để trace event qua nhiều service.
4. **Pending balance cần lazy settlement** — gọi `settlePendingEarnings()` trong `getBalance()` (lazy) đơn giản hơn background job nhưng cần careful transaction isolation.

## 8.3. Hướng phát triển

| Hướng | Mô tả | Độ ưu tiên |
|---|---|---|
| **Cloud deployment** | Nâng cấp từ Swarm demo lên ECS/EKS hoặc Swarm production-grade + RDS + ElastiCache | Cao |
| **L3/L4 debt enforcement** | Cron job hàng giờ check overdue, force deduct từ deposit | Cao |
| **Load testing** | k6 hoặc Locust: 500 concurrent users, measure P99 | Cao |
| **Native mobile** | React Native hoặc Flutter cho iOS/Android | Trung bình |
| **AI improvement** | Thu thập dữ liệu thực, retrain surge model | Trung bình |
| **TURN server** | Coturn self-hosted cho WebRTC reliability | Trung bình |
| **Advanced features** | Đặt xe theo lịch, chia sẻ chuyến, loyalty program | Thấp |

---

## TÀI LIỆU THAM KHẢO

### Tiếng Việt

[1]. Nguyễn Anh Tuấn, Phạm Minh Đức (2023), "Phân tích thị trường ride-hailing Việt Nam giai đoạn 2020–2023", *Tạp chí Kinh tế Số*, Tập 5(2), tr. 18–29.

[2]. Hoàng Vũ Long, Lê Thị Mai (2022), *Phân tích và Thiết kế Hệ thống Thông tin Hướng Đối tượng*, NXB Đại học Quốc gia TP. HCM, Thành phố Hồ Chí Minh.

### Tiếng Anh

[3]. Evans, E. (2003), *Domain-Driven Design: Tackling Complexity in the Heart of Software*, Addison-Wesley, Boston, MA.

[4]. Newman, S. (2021), *Building Microservices: Designing Fine-Grained Systems*, 2nd Edition, O'Reilly Media, Sebastopol, CA.

[5]. Vernon, V. (2013), *Implementing Domain-Driven Design*, Addison-Wesley, Boston, MA.

[6]. Richardson, C. (2018), *Microservices Patterns: With Examples in Java*, Manning Publications, Shelter Island, NY.

[7]. Kleppmann, M. (2017), *Designing Data-Intensive Applications: The Big Ideas Behind Reliable, Scalable, and Maintainable Systems*, O'Reilly Media, Sebastopol, CA.

[8]. Burns, B. (2018), *Designing Distributed Systems: Patterns and Paradigms for Scalable, Reliable Services*, O'Reilly Media, Sebastopol, CA.

[9]. Uber Engineering Blog (2020), "Project DISCO: Dispatch System at Scale", https://eng.uber.com/dispatch-optimization

[10]. Grab Engineering Blog (2021), "Building a Real-time Geolocation System", https://engineering.grab.com/geolocation-system

[11]. Fowler, M. (2011), "CQRS", https://martinfowler.com/bliki/CQRS.html

[12]. Fowler, M. (2010), "Outbox Pattern", https://microservices.io/patterns/data/transactional-outbox.html

[13]. MoMo Developer Portal (2024), "MoMo Payment API v2 Documentation", https://developers.momo.vn/v3/docs/payment/api/wallet

[14]. VNPay Developer Portal (2024), "VNPay Integration Guide — Sandbox", https://sandbox.vnpayment.vn/apis/docs/huong-dan-tich-hop

[15]. Prisma (2024), "Prisma ORM Documentation", https://www.prisma.io/docs

[16]. Socket.IO (2024), "Socket.IO Documentation with Redis Adapter", https://socket.io/docs/v4/redis-adapter

[17]. Redis (2024), "Redis GEO Commands Reference", https://redis.io/commands/georadius

[18]. RabbitMQ (2024), "RabbitMQ Topics — Tutorial 5", https://www.rabbitmq.com/tutorials/tutorial-five-javascript

[19]. WebRTC (2024), "WebRTC API — MDN Web Docs", https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API

[20]. Statista (2024), "Ride-hailing market in Southeast Asia — Statistics & Facts", https://www.statista.com/topics/5066/ride-hailing-in-southeast-asia

---

## PHỤ LỤC

### Phụ lục A: Tài khoản demo

| Vai trò | Số điện thoại | Mật khẩu | Ghi chú |
|---|---|---|---|
| Khách hàng | 0901234561–0901234580 | Password@1 | 20 tài khoản seed |
| Tài xế (approved, ví kích hoạt) | 0911234561–0911234575 | Password@1 | 15 tài xế seed |
| Quản trị viên | 0900000001 | Password@1 | 1 admin seed |

### Phụ lục B: Hướng dẫn khởi chạy

```bash
# Yêu cầu: Docker Desktop, Node.js 20+

# Bước 1: Cài dependencies
npm install

# Bước 2: Khởi chạy hạ tầng
npm run docker:up

# Bước 3: Chờ healthy (~30s), kiểm tra
docker ps --format "table {{.Names}}\t{{.Status}}"

# Bước 4: Seed dữ liệu
npx tsx scripts/seed-database.ts

# Bước 5: Khởi chạy frontend (3 terminal)
npm run dev:customer      # http://localhost:4000
npm run dev:driver-app    # http://localhost:4001
npm run dev:admin         # http://localhost:4002

# Lấy OTP trong dev/mock mode bằng Postman hoặc curl
curl "http://localhost:3000/api/auth/dev/otp?phone=0901234501&purpose=register"

# Reset toàn bộ
bash scripts/reset-database.sh
```

### Phụ lục C: Danh sách API chính

| Method | Endpoint | Auth | Chức năng |
|---|---|---|---|
| POST | /api/auth/register-phone/start | — | Gửi OTP đăng ký |
| GET | /api/auth/dev/otp | — dev/mock | Lấy OTP khi test Docker Compose/Postman |
| POST | /api/auth/register-phone/verify | — | Xác thực OTP đăng ký |
| POST | /api/auth/register-phone/complete | — | Hoàn tất đăng ký |
| POST | /api/auth/login | — | Đăng nhập |
| POST | /api/auth/refresh | — | Refresh access token |
| GET | /api/drivers/me | DRIVER | Hồ sơ tài xế |
| POST | /api/drivers/register | DRIVER | Tạo hồ sơ tài xế |
| POST | /api/drivers/me/online | DRIVER | Bật nhận cuốc |
| POST | /api/drivers/me/offline | DRIVER | Tắt nhận cuốc |
| POST | /api/rides | CUSTOMER | Đặt xe |
| GET | /api/rides/:id | AUTH | Chi tiết chuyến |
| POST | /api/rides/:id/accept | DRIVER | Nhận cuốc |
| POST | /api/rides/:id/pickup | DRIVER | Xác nhận đến điểm đón |
| POST | /api/rides/:id/start | DRIVER | Bắt đầu chuyến |
| POST | /api/rides/:id/complete | DRIVER | Hoàn thành chuyến |
| GET | /api/wallet/balance | DRIVER | Số dư ví (4 thành phần) |
| GET | /api/wallet/debt-records | DRIVER | Danh sách công nợ |
| GET | /api/wallet/transactions | DRIVER | Lịch sử giao dịch |
| POST | /api/wallet/withdraw | DRIVER | Rút tiền |
| POST | /api/wallet/top-up/init | DRIVER | Nạp tiền MoMo/VNPay |
| POST | /api/admin/drivers/:id/approve | ADMIN | Duyệt tài xế |
| POST | /api/admin/drivers/:id/reject | ADMIN | Từ chối tài xế |
| GET | /api/admin/wallet/merchant-balance | ADMIN | Số dư nền tảng |
| GET | /api/admin/wallet/ledger | ADMIN | Sổ cái giao dịch |

### Phụ lục D: Cấu hình môi trường quan trọng

```env
# auth-service
OTP_SMS_MODE=mock          # mock | twilio | speedsms | sns
OTP_TTL_SECONDS=120
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# wallet-service
INITIAL_ACTIVATION_BALANCE=300000
DEBT_LIMIT=-200000
WARNING_THRESHOLD=-100000
MIN_WITHDRAWAL=50000

# api-gateway (dispatch)
MATCHING_ROUNDS=[{"radiusKm":2,"timeout":20},{"radiusKm":3,"timeout":60},{"radiusKm":5,"timeout":100}]
MATCHING_AI_ADJUSTMENT_ENABLED=false

# payment-service
MOMO_SANDBOX_MODE=true
VNPAY_SANDBOX_MODE=true
```

### Phụ lục E: Cấu trúc thư mục mã nguồn (tham chiếu nhanh)

| Đường dẫn | Mô tả |
|---|---|
| `apps/customer-app`, `apps/driver-app`, `apps/admin-dashboard` | Ba ứng dụng React |
| `services/api-gateway` | Gateway, Socket.IO, dispatch, bridge gRPC |
| `services/auth-service`, `user-service`, `driver-service`, `ride-service`, `booking-service`, `pricing-service`, `payment-service`, `wallet-service`, `notification-service`, `review-service` | Microservices nghiệp vụ |
| `services/ai-service` | FastAPI, ML/RAG |
| `shared/proto`, `shared/types` | Hợp đồng gRPC / kiểu dùng chung |
| `docs/diagrams/mermaid` | Nguồn Mermaid xuất hình `img/*.png` |
| `deploy/SWARM-SETUP.md`, `docker-stack.thesis.yml` | Triển khai Swarm (nếu dùng) |
| `.github/workflows` | CI/CD GitHub Actions |

Tài liệu chi tiết từng service: thư mục `docs/services/`.

---

## NHẬT KÍ LÀM VIỆC

**Đề tài:** Thiết kế và Xây dựng Hệ thống Đặt Xe Trực Tuyến  
**Giảng viên hướng dẫn:** [Học hàm/học vị Họ và tên GVHD]  
**Ngày bắt đầu:** [DD/MM/YYYY]

| Tuần | Từ ngày | Đến ngày | Ngày báo cáo GVHD | Tóm tắt công việc |
|---|---|---|---|---|
| 1 | | | | Nghiên cứu DDD, Event Storming, phân tích hệ thống tham khảo (Grab/Gojek) |
| 2 | | | | Thiết kế Context Map, Ubiquitous Language, xác định 11 Bounded Context |
| 3 | | | | Thiết kế Domain Model chi tiết, database schema cho mỗi service |
| 4 | | | | Triển khai api-gateway, auth-service, Docker Compose infrastructure |
| 5 | | | | Triển khai ride-service, driver-service, Redis GEO dispatch |
| 6 | | | | Triển khai payment-service, tích hợp MoMo sandbox |
| 7 | | | | Tích hợp VNPay, idempotent IPN, refund flow |
| 8 | | | | Triển khai wallet-service: pendingBalance, DebtRecord, settlement |
| 9 | | | | Xây dựng Customer App: bản đồ, đặt xe, theo dõi |
| 10 | | | | Xây dựng Driver App: dashboard, ví 4-section, công nợ |
| 11 | | | | Xây dựng Admin Dashboard: duyệt tài xế, wallet admin |
| 12 | | | | Tích hợp WebRTC chat/voice call |
| 13 | | | | pricing-service, review-service, AI service |
| 14 | | | | Kiểm thử integration, sửa lỗi, đánh giá hiệu năng |
| 15 | | | | Viết báo cáo, thiết kế sơ đồ, chuẩn bị slide |
