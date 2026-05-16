# FoxGo Diagram Set

Generated Mermaid and PNG diagrams for the FoxGo cab booking system.
The folder tree is split into two high-level categories:

- `01_system_architecture`: system overview, service architecture, AI pipelines, CI/CD, AWS, Docker Swarm HA, scaling, and monitoring.
- `02_analysis_design`: use cases, activity diagrams, sequence diagrams, database/event design, DDD design, state machines, and algorithms.

Each diagram folder keeps the `.mmd` source and rendered `.png` together. Most PNG files are normalized to a white 2400x1600 canvas with a diagram-type caption at the bottom. Activity diagrams use a wider 3600px swimlane canvas with dynamic height so validation, error, retry, and timeout branches remain readable without leaving a large blank area below the flow.

## Render

```powershell
python scripts\build-foxgo-diagram-set.py
```

Activity diagrams use a custom UML swimlane renderer to keep the layout close to the report reference style: vertical lanes, black-and-white nodes, and high-contrast routed arrows.

```powershell
python scripts\render-activity-swimlanes.py
```

## Diagram Index

| PNG | Type | Title |
|-----|------|-------|
| [01_system_architecture/01_system_overview/01_system_overview.png](./01_system_architecture/01_system_overview/01_system_overview.png) | System Architecture Diagram | FoxGo System Overview |
| [01_system_architecture/02_service_architecture/02_service_domain_architecture.png](./01_system_architecture/02_service_architecture/02_service_domain_architecture.png) | Service Architecture Diagram | Service Domains and Communication |
| [01_system_architecture/02_service_architecture/03_component_boundaries.png](./01_system_architecture/02_service_architecture/03_component_boundaries.png) | Component Architecture Diagram | Runtime Component Boundaries |
| [01_system_architecture/03_ai_pipelines/04_ai_training_pipeline.png](./01_system_architecture/03_ai_pipelines/04_ai_training_pipeline.png) | AI Pipeline Diagram | Multi-Model Training Pipeline |
| [01_system_architecture/03_ai_pipelines/05_ai_runtime_decision_pipeline.png](./01_system_architecture/03_ai_pipelines/05_ai_runtime_decision_pipeline.png) | AI Pipeline Diagram | Runtime Decision Pipeline |
| [01_system_architecture/03_ai_pipelines/06_ai_chatbot_rag_pipeline.png](./01_system_architecture/03_ai_pipelines/06_ai_chatbot_rag_pipeline.png) | AI Pipeline Diagram | RAG Chatbot Pipeline |
| [01_system_architecture/03_ai_pipelines/07_ai_eta_surge_prediction.png](./01_system_architecture/03_ai_pipelines/07_ai_eta_surge_prediction.png) | AI Pipeline Diagram | ETA and Surge Prediction |
| [01_system_architecture/03_ai_pipelines/08_ai_rag_chatbot_mia.png](./01_system_architecture/03_ai_pipelines/08_ai_rag_chatbot_mia.png) | AI Pipeline Diagram | RAG Chatbot Mia |
| [01_system_architecture/04_cicd_pipeline/07_cicd_pipeline.png](./01_system_architecture/04_cicd_pipeline/07_cicd_pipeline.png) | CI/CD Pipeline Diagram | Build, Test, Release, and Rollback |
| [01_system_architecture/05_deployment_aws_swarm/08_docker_swarm_ha_deployment.png](./01_system_architecture/05_deployment_aws_swarm/08_docker_swarm_ha_deployment.png) | Deployment Diagram | Docker Swarm High Availability |
| [01_system_architecture/05_deployment_aws_swarm/09_aws_topology.png](./01_system_architecture/05_deployment_aws_swarm/09_aws_topology.png) | AWS Architecture Diagram | AWS Deployment Topology |
| [01_system_architecture/05_deployment_aws_swarm/11_cloud_deployment_overview.png](./01_system_architecture/05_deployment_aws_swarm/11_cloud_deployment_overview.png) | Deployment Diagram | Cloud Deployment Overview |
| [01_system_architecture/05_deployment_aws_swarm/10_scaling_failover_strategy.png](./01_system_architecture/05_deployment_aws_swarm/10_scaling_failover_strategy.png) | Scalability and HA Diagram | Scaling and Failover Strategy |
| [01_system_architecture/06_monitoring_observability/11_observability_flow.png](./01_system_architecture/06_monitoring_observability/11_observability_flow.png) | Monitoring Diagram | Observability Flow |
| [01_system_architecture/06_monitoring_observability/12_health_check_recovery.png](./01_system_architecture/06_monitoring_observability/12_health_check_recovery.png) | Monitoring Diagram | Health Check and Recovery Loop |
| [01_system_architecture/06_monitoring_observability/13_metrics_stack.png](./01_system_architecture/06_monitoring_observability/13_metrics_stack.png) | Monitoring Diagram | Metrics and Dashboard Stack |
| [01_system_architecture/07_architecture_patterns/14_architecture_pattern_catalog.png](./01_system_architecture/07_architecture_patterns/14_architecture_pattern_catalog.png) | Architecture Pattern Diagram | Microservice Pattern Catalog |
| [01_system_architecture/07_architecture_patterns/15_api_gateway_pattern.png](./01_system_architecture/07_architecture_patterns/15_api_gateway_pattern.png) | Architecture Pattern Diagram | API Gateway Pattern |
| [01_system_architecture/07_architecture_patterns/16_database_per_service_pattern.png](./01_system_architecture/07_architecture_patterns/16_database_per_service_pattern.png) | Architecture Pattern Diagram | Database per Service Pattern |
| [01_system_architecture/07_architecture_patterns/17_saga_outbox_idempotency_pattern.png](./01_system_architecture/07_architecture_patterns/17_saga_outbox_idempotency_pattern.png) | Architecture Pattern Diagram | Saga, Outbox, and Idempotency Pattern |
| [01_system_architecture/07_architecture_patterns/18_resilience_patterns.png](./01_system_architecture/07_architecture_patterns/18_resilience_patterns.png) | Architecture Pattern Diagram | Resilience Pattern Map |
| [01_system_architecture/08_operating_principles/19_jwt_authentication_principle.png](./01_system_architecture/08_operating_principles/19_jwt_authentication_principle.png) | Operating Principle Diagram | JWT Authentication Principle |
| [01_system_architecture/08_operating_principles/20_database_per_service_principle.png](./01_system_architecture/08_operating_principles/20_database_per_service_principle.png) | Operating Principle Diagram | Database per Service Principle |
| [01_system_architecture/08_operating_principles/21_event_driven_messaging_principle.png](./01_system_architecture/08_operating_principles/21_event_driven_messaging_principle.png) | Operating Principle Diagram | Event Driven Messaging Principle |
| [01_system_architecture/08_operating_principles/22_redis_geo_matching_principle.png](./01_system_architecture/08_operating_principles/22_redis_geo_matching_principle.png) | Operating Principle Diagram | Redis GEO Matching Principle |
| [01_system_architecture/08_operating_principles/23_payment_ipn_idempotency_principle.png](./01_system_architecture/08_operating_principles/23_payment_ipn_idempotency_principle.png) | Operating Principle Diagram | Payment IPN Idempotency Principle |
| [01_system_architecture/08_operating_principles/24_observability_feedback_principle.png](./01_system_architecture/08_operating_principles/24_observability_feedback_principle.png) | Operating Principle Diagram | Observability Feedback Principle |
| [02_analysis_design/01_use_case/01_usecase_roles.png](./02_analysis_design/01_use_case/01_usecase_roles.png) | Use Case Diagram | Role-Based Use Cases |
| [02_analysis_design/02_activity/02_customer_booking_activity.png](./02_analysis_design/02_activity/02_customer_booking_activity.png) | Activity Diagram | Customer Booking Activity |
| [02_analysis_design/02_activity/03_driver_onboarding_activity.png](./02_analysis_design/02_activity/03_driver_onboarding_activity.png) | Activity Diagram | Driver Onboarding Activity |
| [02_analysis_design/02_activity/04_payment_wallet_activity.png](./02_analysis_design/02_activity/04_payment_wallet_activity.png) | Activity Diagram | Payment and Wallet Activity |
| [02_analysis_design/02_activity/05_admin_operations_activity.png](./02_analysis_design/02_activity/05_admin_operations_activity.png) | Activity Diagram | Admin Operations Activity |
| [02_analysis_design/02_activity/06_voucher_review_activity.png](./02_analysis_design/02_activity/06_voucher_review_activity.png) | Activity Diagram | Voucher and Review Activity |
| [02_analysis_design/02_activity/07_auth_otp_activity.png](./02_analysis_design/02_activity/07_auth_otp_activity.png) | Activity Diagram | Auth OTP Activity |
| [02_analysis_design/02_activity/08_profile_management_activity.png](./02_analysis_design/02_activity/08_profile_management_activity.png) | Activity Diagram | Profile Management Activity |
| [02_analysis_design/02_activity/09_fare_estimation_activity.png](./02_analysis_design/02_activity/09_fare_estimation_activity.png) | Activity Diagram | Fare Estimation Activity |
| [02_analysis_design/02_activity/10_driver_matching_activity.png](./02_analysis_design/02_activity/10_driver_matching_activity.png) | Activity Diagram | Driver Matching Activity |
| [02_analysis_design/02_activity/11_driver_acceptance_activity.png](./02_analysis_design/02_activity/11_driver_acceptance_activity.png) | Activity Diagram | Driver Acceptance Activity |
| [02_analysis_design/02_activity/12_driver_availability_activity.png](./02_analysis_design/02_activity/12_driver_availability_activity.png) | Activity Diagram | Driver Availability Activity |
| [02_analysis_design/02_activity/13_ride_lifecycle_activity.png](./02_analysis_design/02_activity/13_ride_lifecycle_activity.png) | Activity Diagram | Ride Lifecycle Activity |
| [02_analysis_design/02_activity/14_realtime_tracking_activity.png](./02_analysis_design/02_activity/14_realtime_tracking_activity.png) | Activity Diagram | Realtime Tracking Activity |
| [02_analysis_design/02_activity/15_cancellation_refund_activity.png](./02_analysis_design/02_activity/15_cancellation_refund_activity.png) | Activity Diagram | Cancellation Refund Activity |
| [02_analysis_design/02_activity/16_online_payment_activity.png](./02_analysis_design/02_activity/16_online_payment_activity.png) | Activity Diagram | Online Payment Activity |
| [02_analysis_design/02_activity/17_driver_wallet_topup_activity.png](./02_analysis_design/02_activity/17_driver_wallet_topup_activity.png) | Activity Diagram | Driver Wallet Top-Up Activity |
| [02_analysis_design/02_activity/18_driver_withdrawal_activity.png](./02_analysis_design/02_activity/18_driver_withdrawal_activity.png) | Activity Diagram | Driver Withdrawal Activity |
| [02_analysis_design/02_activity/19_complaint_handling_activity.png](./02_analysis_design/02_activity/19_complaint_handling_activity.png) | Activity Diagram | Complaint Handling Activity |
| [02_analysis_design/02_activity/20_chat_notification_activity.png](./02_analysis_design/02_activity/20_chat_notification_activity.png) | Activity Diagram | Chat Notification Activity |
| [02_analysis_design/02_activity/21_ai_support_activity.png](./02_analysis_design/02_activity/21_ai_support_activity.png) | Activity Diagram | AI Support Activity |
| [02_analysis_design/02_activity/22_settlement_t24h_activity.png](./02_analysis_design/02_activity/22_settlement_t24h_activity.png) | Activity Diagram | Settlement T+24h Activity |
| [02_analysis_design/02_activity/23_forgot_password_activity.png](./02_analysis_design/02_activity/23_forgot_password_activity.png) | Activity Diagram | Forgot Password Activity |
| [02_analysis_design/02_activity/24_logout_activity.png](./02_analysis_design/02_activity/24_logout_activity.png) | Activity Diagram | Logout Activity |
| [02_analysis_design/02_activity/25_cash_payment_debt_activity.png](./02_analysis_design/02_activity/25_cash_payment_debt_activity.png) | Activity Diagram | Cash Payment and Debt Activity |
| [02_analysis_design/03_sequence/07_auth_otp_sequence.png](./02_analysis_design/03_sequence/07_auth_otp_sequence.png) | Sequence Diagram | OTP Authentication Sequence |
| [02_analysis_design/03_sequence/08_booking_dispatch_sequence.png](./02_analysis_design/03_sequence/08_booking_dispatch_sequence.png) | Sequence Diagram | Booking Dispatch Sequence |
| [02_analysis_design/03_sequence/09_ride_tracking_sequence.png](./02_analysis_design/03_sequence/09_ride_tracking_sequence.png) | Sequence Diagram | Ride Tracking Sequence |
| [02_analysis_design/03_sequence/10_online_payment_ipn_sequence.png](./02_analysis_design/03_sequence/10_online_payment_ipn_sequence.png) | Sequence Diagram | Online Payment IPN Sequence |
| [02_analysis_design/03_sequence/11_wallet_topup_withdrawal_sequence.png](./02_analysis_design/03_sequence/11_wallet_topup_withdrawal_sequence.png) | Sequence Diagram | Wallet Top-Up and Withdrawal Sequence |
| [02_analysis_design/03_sequence/12_driver_approval_sequence.png](./02_analysis_design/03_sequence/12_driver_approval_sequence.png) | Sequence Diagram | Driver Approval Sequence |
| [02_analysis_design/03_sequence/13_cancel_refund_sequence.png](./02_analysis_design/03_sequence/13_cancel_refund_sequence.png) | Sequence Diagram | Cancellation and Refund Sequence |
| [02_analysis_design/03_sequence/14_chat_notification_sequence.png](./02_analysis_design/03_sequence/14_chat_notification_sequence.png) | Sequence Diagram | Chat and Notification Sequence |
| [02_analysis_design/03_sequence/15_voucher_redeem_sequence.png](./02_analysis_design/03_sequence/15_voucher_redeem_sequence.png) | Sequence Diagram | Voucher Redeem Sequence |
| [02_analysis_design/03_sequence/16_review_rating_sequence.png](./02_analysis_design/03_sequence/16_review_rating_sequence.png) | Sequence Diagram | Review and Rating Sequence |
| [02_analysis_design/03_sequence/17_settlement_t24h_sequence.png](./02_analysis_design/03_sequence/17_settlement_t24h_sequence.png) | Sequence Diagram | T+24h Settlement Sequence |
| [02_analysis_design/03_sequence/18_ai_chatbot_sequence.png](./02_analysis_design/03_sequence/18_ai_chatbot_sequence.png) | Sequence Diagram | AI Chatbot Sequence |
| [02_analysis_design/03_sequence/19_booking_end_to_end_sequence.png](./02_analysis_design/03_sequence/19_booking_end_to_end_sequence.png) | Sequence Diagram | Booking End-to-End Sequence |
| [02_analysis_design/03_sequence/20_payment_end_to_end_sequence.png](./02_analysis_design/03_sequence/20_payment_end_to_end_sequence.png) | Sequence Diagram | Payment End-to-End Sequence |
| [02_analysis_design/03_sequence/21_profile_management_sequence.png](./02_analysis_design/03_sequence/21_profile_management_sequence.png) | Sequence Diagram | Profile Management Sequence |
| [02_analysis_design/03_sequence/22_fare_estimation_sequence.png](./02_analysis_design/03_sequence/22_fare_estimation_sequence.png) | Sequence Diagram | Fare Estimation Sequence |
| [02_analysis_design/03_sequence/23_driver_availability_sequence.png](./02_analysis_design/03_sequence/23_driver_availability_sequence.png) | Sequence Diagram | Driver Availability Sequence |
| [02_analysis_design/03_sequence/24_admin_management_sequence.png](./02_analysis_design/03_sequence/24_admin_management_sequence.png) | Sequence Diagram | Admin Management Sequence |
| [02_analysis_design/03_sequence/25_admin_dashboard_observability_sequence.png](./02_analysis_design/03_sequence/25_admin_dashboard_observability_sequence.png) | Sequence Diagram | Admin Dashboard and Observability Sequence |
| [02_analysis_design/03_sequence/26_complaint_handling_sequence.png](./02_analysis_design/03_sequence/26_complaint_handling_sequence.png) | Sequence Diagram | Complaint Handling Sequence |
| [02_analysis_design/03_sequence/27_forgot_password_sequence.png](./02_analysis_design/03_sequence/27_forgot_password_sequence.png) | Sequence Diagram | Forgot Password Sequence |
| [02_analysis_design/03_sequence/28_logout_sequence.png](./02_analysis_design/03_sequence/28_logout_sequence.png) | Sequence Diagram | Logout Sequence |
| [02_analysis_design/03_sequence/29_cash_payment_debt_sequence.png](./02_analysis_design/03_sequence/29_cash_payment_debt_sequence.png) | Sequence Diagram | Cash Payment and Debt Sequence |
| [02_analysis_design/04_database/19_core_erd.png](./02_analysis_design/04_database/19_core_erd.png) | Database Diagram | Core Entity Relationship Diagram |
| [02_analysis_design/04_database/20_rabbitmq_event_flow.png](./02_analysis_design/04_database/20_rabbitmq_event_flow.png) | Event Flow Diagram | RabbitMQ Domain Event Flow |
| [02_analysis_design/05_ddd/21_bounded_context_map.png](./02_analysis_design/05_ddd/21_bounded_context_map.png) | DDD Diagram | Bounded Context Map |
| [02_analysis_design/05_ddd/22_data_ownership.png](./02_analysis_design/05_ddd/22_data_ownership.png) | DDD Diagram | Data Ownership by Bounded Context |
| [02_analysis_design/05_ddd/23_context_map_dependencies.png](./02_analysis_design/05_ddd/23_context_map_dependencies.png) | DDD Diagram | Context Map Dependencies |
| [02_analysis_design/05_ddd/24_domain_model_identity_context.png](./02_analysis_design/05_ddd/24_domain_model_identity_context.png) | Domain Model Diagram | Domain Model Identity Context |
| [02_analysis_design/05_ddd/25_domain_model_mobility_context.png](./02_analysis_design/05_ddd/25_domain_model_mobility_context.png) | Domain Model Diagram | Domain Model Mobility Context |
| [02_analysis_design/05_ddd/26_domain_model_finance_context.png](./02_analysis_design/05_ddd/26_domain_model_finance_context.png) | Domain Model Diagram | Domain Model Finance Context |
| [02_analysis_design/05_ddd/27_domain_model_support_context.png](./02_analysis_design/05_ddd/27_domain_model_support_context.png) | Domain Model Diagram | Domain Model Support Context |
| [02_analysis_design/05_ddd/28_booking_aggregate.png](./02_analysis_design/05_ddd/28_booking_aggregate.png) | Aggregate Diagram | Booking Aggregate |
| [02_analysis_design/05_ddd/29_driver_aggregate.png](./02_analysis_design/05_ddd/29_driver_aggregate.png) | Aggregate Diagram | Driver Aggregate |
| [02_analysis_design/05_ddd/30_payment_aggregate.png](./02_analysis_design/05_ddd/30_payment_aggregate.png) | Aggregate Diagram | Payment Aggregate |
| [02_analysis_design/05_ddd/31_wallet_aggregate.png](./02_analysis_design/05_ddd/31_wallet_aggregate.png) | Aggregate Diagram | Wallet Aggregate |
| [02_analysis_design/05_ddd/32_full_bounded_context_overview.png](./02_analysis_design/05_ddd/32_full_bounded_context_overview.png) | DDD Diagram | Full Bounded Context Overview |
| [02_analysis_design/06_state_machine/23_ride_state_machine.png](./02_analysis_design/06_state_machine/23_ride_state_machine.png) | State Machine Diagram | Ride State Machine |
| [02_analysis_design/06_state_machine/24_payment_state_machine.png](./02_analysis_design/06_state_machine/24_payment_state_machine.png) | State Machine Diagram | Payment State Machine |
| [02_analysis_design/06_state_machine/25_wallet_state_machine.png](./02_analysis_design/06_state_machine/25_wallet_state_machine.png) | State Machine Diagram | Wallet State Machine |
| [02_analysis_design/06_state_machine/26_driver_availability_state_machine.png](./02_analysis_design/06_state_machine/26_driver_availability_state_machine.png) | State Machine Diagram | Driver Availability State Machine |
| [02_analysis_design/07_algorithm/27_driver_dispatch_algorithm.png](./02_analysis_design/07_algorithm/27_driver_dispatch_algorithm.png) | Algorithm Flowchart | Driver Dispatch Algorithm |
| [02_analysis_design/08_design_patterns/28_ddd_tactical_patterns.png](./02_analysis_design/08_design_patterns/28_ddd_tactical_patterns.png) | Design Pattern Diagram | DDD Tactical Patterns |
| [02_analysis_design/08_design_patterns/29_application_design_patterns.png](./02_analysis_design/08_design_patterns/29_application_design_patterns.png) | Design Pattern Diagram | Application Design Pattern Map |
| [02_analysis_design/08_design_patterns/30_pattern_decision_matrix.png](./02_analysis_design/08_design_patterns/30_pattern_decision_matrix.png) | Design Pattern Diagram | Pattern Decision Matrix |
| [02_analysis_design/08_design_patterns/31_design_patterns_overview.png](./02_analysis_design/08_design_patterns/31_design_patterns_overview.png) | Design Pattern Diagram | Design Patterns Overview |
| [02_analysis_design/08_design_patterns/32_design_patterns_slide_overview.png](./02_analysis_design/08_design_patterns/32_design_patterns_slide_overview.png) | Design Pattern Diagram | Presentation Overview: 4 Key Patterns |
| [02_analysis_design/08_design_patterns/33_pattern_api_gateway.png](./02_analysis_design/08_design_patterns/33_pattern_api_gateway.png) | Design Pattern Diagram | Pattern Detail: API Gateway |
| [02_analysis_design/08_design_patterns/34_pattern_ride_state_machine.png](./02_analysis_design/08_design_patterns/34_pattern_ride_state_machine.png) | Design Pattern Diagram | Pattern Detail: Ride State Machine |
| [02_analysis_design/08_design_patterns/35_pattern_outbox_idempotency.png](./02_analysis_design/08_design_patterns/35_pattern_outbox_idempotency.png) | Design Pattern Diagram | Pattern Detail: Outbox and Idempotency |
| [02_analysis_design/08_design_patterns/36_pattern_saga_wallet_rules.png](./02_analysis_design/08_design_patterns/36_pattern_saga_wallet_rules.png) | Design Pattern Diagram | Pattern Detail: Saga and Wallet Rules |
| [02_analysis_design/09_erd_per_service/32_erd_auth_service.png](./02_analysis_design/09_erd_per_service/32_erd_auth_service.png) | Database Diagram | ERD Auth Service |
| [02_analysis_design/09_erd_per_service/33_erd_user_service.png](./02_analysis_design/09_erd_per_service/33_erd_user_service.png) | Database Diagram | ERD User Service |
| [02_analysis_design/09_erd_per_service/34_erd_driver_service.png](./02_analysis_design/09_erd_per_service/34_erd_driver_service.png) | Database Diagram | ERD Driver Service |
| [02_analysis_design/09_erd_per_service/35_erd_booking_service.png](./02_analysis_design/09_erd_per_service/35_erd_booking_service.png) | Database Diagram | ERD Booking Service |
| [02_analysis_design/09_erd_per_service/36_erd_ride_service.png](./02_analysis_design/09_erd_per_service/36_erd_ride_service.png) | Database Diagram | ERD Ride Service |
| [02_analysis_design/09_erd_per_service/37_erd_payment_service.png](./02_analysis_design/09_erd_per_service/37_erd_payment_service.png) | Database Diagram | ERD Payment Service |
| [02_analysis_design/09_erd_per_service/38_erd_wallet_service.png](./02_analysis_design/09_erd_per_service/38_erd_wallet_service.png) | Database Diagram | ERD Wallet Service |
| [02_analysis_design/09_erd_per_service/39_erd_notification_service.png](./02_analysis_design/09_erd_per_service/39_erd_notification_service.png) | Database Diagram | ERD Notification Service |
| [02_analysis_design/09_erd_per_service/40_erd_review_service.png](./02_analysis_design/09_erd_per_service/40_erd_review_service.png) | Database Diagram | ERD Review Service |
| [02_analysis_design/10_event_flow/41_domain_event_lifecycle.png](./02_analysis_design/10_event_flow/41_domain_event_lifecycle.png) | Event Flow Diagram | Domain Event Lifecycle |
| [02_analysis_design/10_event_flow/42_event_producer_consumer_map.png](./02_analysis_design/10_event_flow/42_event_producer_consumer_map.png) | Event Flow Diagram | Event Producer Consumer Map |
