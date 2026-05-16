from __future__ import annotations

import json
import math
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT /"foxgo_diagrams"
CANVAS = (2400, 1600)
BG = "#ffffff"
TEXT = "#0f172a"
MUTED = "#64748b"


CONFIG = {
    "theme": "default",
    "securityLevel": "loose",
    "htmlLabels": True,
    "themeVariables": {
        "background": BG,
        "primaryColor": "#dbeafe",
        "primaryTextColor": TEXT,
        "primaryBorderColor": "#60a5fa",
        "secondaryColor": "#dcfce7",
        "secondaryTextColor": TEXT,
        "secondaryBorderColor": "#86efac",
        "tertiaryColor": "#fef3c7",
        "tertiaryTextColor": TEXT,
        "tertiaryBorderColor": "#facc15",
        "lineColor": "#64748b",
        "textColor": TEXT,
        "mainBkg": "#dbeafe",
        "secondBkg": "#dcfce7",
        "tertiaryBkg": "#fef3c7",
        "clusterBkg": "#f8fafc",
        "clusterBorder": "#cbd5e1",
        "edgeLabelBackground": BG,
        "fontFamily": "Segoe UI, Roboto, Arial, sans-serif",
        "fontSize": "14px",
        "actorBkg": "#dbeafe",
        "actorBorder": "#60a5fa",
        "actorTextColor": TEXT,
        "actorLineColor": "#94a3b8",
        "activationBkgColor": "#e0f2fe",
        "activationBorderColor": "#38bdf8",
        "noteBkgColor": "#fef9c3",
        "noteTextColor": TEXT,
        "noteBorderColor": "#facc15",
    },
    "flowchart": {
        "curve": "basis",
        "padding": 20,
        "nodeSpacing": 44,
        "rankSpacing": 52,
        "useMaxWidth": False,
    },
    "sequence": {
        "useMaxWidth": False,
        "diagramMarginX": 24,
        "diagramMarginY": 20,
        "actorMargin": 48,
        "boxMargin": 10,
        "messageMargin": 34,
        "mirrorActors": False,
    },
    "er": {"useMaxWidth": False, "fontSize": 13},
    "stateDiagram": {"useMaxWidth": False},
}

PUPPETEER_CONFIG = {
    "timeout": 120000,
    "protocolTimeout": 120000,
    "args": ["--no-sandbox", "--disable-setuid-sandbox"],
}


COMMON_CLASSES = """
classDef user fill:#dbeafe,stroke:#60a5fa,color:#0f172a,stroke-width:1.5px;
classDef service fill:#ccfbf1,stroke:#14b8a6,color:#0f172a,stroke-width:1.5px;
classDef data fill:#dcfce7,stroke:#22c55e,color:#0f172a,stroke-width:1.5px;
classDef ai fill:#fef3c7,stroke:#f59e0b,color:#0f172a,stroke-width:1.5px;
classDef infra fill:#e0e7ff,stroke:#818cf8,color:#0f172a,stroke-width:1.5px;
classDef external fill:#ffedd5,stroke:#fb923c,color:#0f172a,stroke-width:1.5px;
classDef risk fill:#fee2e2,stroke:#ef4444,color:#0f172a,stroke-width:1.5px;
classDef ok fill:#bbf7d0,stroke:#22c55e,color:#0f172a,stroke-width:1.5px;
classDef pattern fill:#f5d0fe,stroke:#d946ef,color:#0f172a,stroke-width:1.5px;
classDef security fill:#dbeafe,stroke:#2563eb,color:#0f172a,stroke-width:1.5px;
"""


@dataclass(frozen=True)
class Diagram:
    group: str
    folder: str
    filename: str
    diagram_type: str
    title: str
    source: str

    @property
    def relative_path(self) -> Path:
        return Path(self.group) / self.folder / self.filename


def with_classes(source: str) -> str:
    return source.strip() + "\n" + COMMON_CLASSES.strip() + "\n"


DIAGRAMS: list[Diagram] = [
    Diagram(
        "01_system_architecture",
        "01_system_overview",
        "01_system_overview.mmd",
        "System Architecture Diagram",
        "FoxGo System Overview",
        with_classes(
            """
flowchart TB
  subgraph Clients["Client Applications"]
    direction LR
    Customer["Customer App<br/>React Native / Web"]:::user
    Driver["Driver App<br/>Realtime GPS"]:::user
    Admin["Admin Dashboard<br/>Operations"]:::user
  end

  Gateway["API Gateway<br/>JWT, routing, Socket.IO"]:::service

  subgraph Domains["Service Domains"]
    direction LR
    Identity["Identity<br/>Auth, User"]:::service
    Mobility["Mobility Core<br/>Booking, Ride, Driver, Pricing"]:::service
    Finance["Finance<br/>Payment, Wallet"]:::service
    Support["Support<br/>Notification, Review"]:::service
  end

  subgraph Intelligence["AI and Decision Support"]
    direction LR
    AI["AI Service<br/>ETA, surge, acceptance, RAG"]:::ai
    Models["Model Artifacts<br/>trained predictors"]:::ai
  end

  subgraph Platform["Data and Infrastructure"]
    direction LR
    PostgreSQL[("PostgreSQL<br/>service databases")]:::data
    MongoDB[("MongoDB<br/>documents")]:::data
    Redis[("Redis<br/>cache, GEO, adapter")]:::data
    RabbitMQ["RabbitMQ<br/>domain events"]:::infra
  end

  External["External Providers<br/>Maps, OSRM, MoMo, VNPay, SMS"]:::external

  Customer --> Gateway
  Driver --> Gateway
  Admin --> Gateway
  Gateway --> Identity
  Gateway --> Mobility
  Gateway --> Finance
  Gateway --> Support
  Identity --> Mobility
  Mobility --> Finance
  Mobility --> AI
  AI --> Models
  Identity --> PostgreSQL
  Mobility --> PostgreSQL
  Finance --> PostgreSQL
  Support --> MongoDB
  Gateway --> Redis
  Mobility --> Redis
  Mobility --> RabbitMQ
  Finance --> RabbitMQ
  Support --> RabbitMQ
  Mobility --> External
  Finance --> External
"""
        ),
    ),
    Diagram(
        "01_system_architecture",
        "02_service_architecture",
        "02_service_domain_architecture.mmd",
        "Service Architecture Diagram",
        "Service Domains and Communication",
        with_classes(
            """
flowchart LR
  subgraph Access["Access Layer"]
    direction TB
    Web["React Apps"]:::user
    Gateway["API Gateway<br/>REST + WebSocket facade"]:::service
  end

  subgraph Identity["Identity Context"]
    direction TB
    Auth["Auth Service"]:::service
    Profile["User Service"]:::service
  end

  subgraph Mobility["Mobility Core"]
    direction TB
    Booking["Booking Service"]:::service
    Ride["Ride Service"]:::service
    DriverSvc["Driver Service"]:::service
    Pricing["Pricing Service"]:::service
  end

  subgraph Finance["Finance Context"]
    direction TB
    Payment["Payment Service"]:::service
    Wallet["Wallet Service"]:::service
  end

  subgraph Support["Support Context"]
    direction TB
    Notification["Notification Service"]:::service
    Review["Review Service"]:::service
    AI["AI Service"]:::ai
  end

  subgraph Messaging["Integration Layer"]
    direction TB
    Sync["gRPC / internal HTTP"]:::infra
    Async["RabbitMQ domain events"]:::infra
    Realtime["Socket.IO rooms"]:::infra
  end

  Web --> Gateway
  Gateway --> Sync
  Gateway --> Realtime
  Sync --> Identity
  Sync --> Mobility
  Sync --> Finance
  Sync --> Support
  Mobility --> Async
  Finance --> Async
  Support --> Async
  Pricing --> AI
  Ride --> Realtime
"""
        ),
    ),
    Diagram(
        "01_system_architecture",
        "02_service_architecture",
        "03_component_boundaries.mmd",
        "Component Architecture Diagram",
        "Runtime Component Boundaries",
        with_classes(
            """
flowchart TB
  subgraph Gateway["API Gateway"]
    direction LR
    Middleware["Auth middleware"]:::service
    Routers["REST routers"]:::service
    SocketHub["Socket hub"]:::service
    MatchEngine["Matching coordinator"]:::service
  end

  subgraph Services["Service Modules"]
    direction LR
    Controllers["Controllers"]:::service
    UseCases["Application use cases"]:::service
    Domain["Domain rules"]:::service
    Repos["Repositories"]:::service
  end

  subgraph CrossCutting["Shared Platform Concerns"]
    direction LR
    Contracts["DTOs and contracts"]:::infra
    Logging["Structured logging"]:::infra
    Health["Health endpoints"]:::infra
    Config["Environment config"]:::infra
  end

  subgraph Persistence["Persistence Adapters"]
    direction LR
    SQL[("PostgreSQL adapters")]:::data
    Doc[("MongoDB adapters")]:::data
    Cache[("Redis adapters")]:::data
    Queue["RabbitMQ publishers"]:::infra
  end

  Middleware --> Routers
  Routers --> Controllers
  SocketHub --> Controllers
  MatchEngine --> UseCases
  Controllers --> UseCases
  UseCases --> Domain
  UseCases --> Repos
  Repos --> SQL
  Repos --> Doc
  Repos --> Cache
  UseCases --> Queue
  Services --> CrossCutting
"""
        ),
    ),
    Diagram(
        "01_system_architecture",
        "03_ai_pipelines",
        "04_ai_training_pipeline.mmd",
        "AI Pipeline Diagram",
        "Multi-Model Training Pipeline",
        with_classes(
            """
flowchart LR
  subgraph Sources["Data Sources"]
    direction TB
    Rides["Ride history"]:::data
    Drivers["Driver behavior"]:::data
    Payments["Payment outcomes"]:::data
    Docs["Project documents"]:::data
  end

  subgraph Features["Feature Engineering"]
    direction TB
    RouteFeatures["Route, time, weather features"]:::service
    SupplyDemand["Supply-demand windows"]:::service
    AcceptanceFeatures["Distance, rating, idle time"]:::service
    Chunks["Document chunks + embeddings"]:::service
  end

  subgraph Training["Training Jobs"]
    direction TB
    ETATrain["ETA regression"]:::ai
    SurgeTrain["Surge classifier"]:::ai
    AcceptTrain["Acceptance model"]:::ai
    RAGIndex["Vector index build"]:::ai
  end

  subgraph Outputs["Versioned Outputs"]
    direction TB
    ETA["ETA model"]:::ai
    Surge["Surge model"]:::ai
    Accept["Acceptance model"]:::ai
    Vector[("RAG vector index")]:::data
  end

  Rides --> RouteFeatures --> ETATrain --> ETA
  Rides --> SupplyDemand --> SurgeTrain --> Surge
  Payments --> SupplyDemand
  Drivers --> AcceptanceFeatures --> AcceptTrain --> Accept
  Docs --> Chunks --> RAGIndex --> Vector
"""
        ),
    ),
    Diagram(
        "01_system_architecture",
        "03_ai_pipelines",
        "05_ai_runtime_decision_pipeline.mmd",
        "AI Pipeline Diagram",
        "Runtime Decision Pipeline",
        with_classes(
            """
flowchart TB
  Request["Booking or pricing request"]:::user
  FeatureBuilder["Feature builder<br/>route, time, demand, driver pool"]:::service

  subgraph Inference["Bounded AI Inference"]
    direction LR
    ETA["ETA predictor"]:::ai
    Surge["Surge predictor"]:::ai
    Accept["Acceptance predictor"]:::ai
  end

  Guard["Latency guard<br/>timeout + circuit breaker"]:::infra
  Fallback["Rule-based fallback"]:::ok

  subgraph Decisions["Decision Outputs"]
    direction LR
    Quote["Fare quote"]:::service
    DispatchScore["Driver ranking score"]:::service
    Explanation["Traceable reason codes"]:::service
  end

  Request --> FeatureBuilder
  FeatureBuilder --> Guard
  Guard --> ETA
  Guard --> Surge
  Guard --> Accept
  Guard -. slow or unavailable .-> Fallback
  ETA --> Quote
  Surge --> Quote
  Accept --> DispatchScore
  Fallback --> Quote
  Fallback --> DispatchScore
  Quote --> Explanation
  DispatchScore --> Explanation
"""
        ),
    ),
    Diagram(
        "01_system_architecture",
        "03_ai_pipelines",
        "06_ai_chatbot_rag_pipeline.mmd",
        "AI Pipeline Diagram",
        "RAG Chatbot Pipeline",
        with_classes(
            """
flowchart LR
  User["User question"]:::user
  Gateway["API Gateway"]:::service
  AI["AI Service"]:::ai
  Embed["Query embedding"]:::ai
  Vector[("Vector index")]:::data
  Context["Relevant project context"]:::data
  Prompt["Grounded prompt"]:::ai
  Answer["Answer with source hints"]:::service

  User --> Gateway --> AI --> Embed --> Vector
  Vector --> Context --> Prompt --> Answer --> Gateway --> User
"""
        ),
    ),
    Diagram(
        "01_system_architecture",
        "04_cicd_pipeline",
        "07_cicd_pipeline.mmd",
        "CI/CD Pipeline Diagram",
        "Build, Test, Release, and Rollback",
        with_classes(
            """
flowchart LR
  Commit["Git push / pull request"]:::user
  Quality["Install, lint, test"]:::service
  Build["Build apps and services"]:::service
  Image["Build Docker images"]:::infra
  Registry["Push image registry"]:::infra
  Deploy["Rolling deploy to Swarm"]:::service
  Verify["Smoke tests and health checks"]:::service
  Promote{"Healthy release?"}:::infra
  Stable["Promote release"]:::ok
  Rollback["Rollback previous image"]:::risk
  Alert["Notify maintainers"]:::external

  Commit --> Quality --> Build --> Image --> Registry --> Deploy --> Verify --> Promote
  Promote -- Yes --> Stable
  Promote -- No --> Rollback --> Alert
"""
        ),
    ),
    Diagram(
        "01_system_architecture",
        "05_deployment_aws_swarm",
        "08_docker_swarm_ha_deployment.mmd",
        "Deployment Diagram",
        "Docker Swarm High Availability",
        with_classes(
            """
flowchart TB
  Internet["Internet"]:::user
  LB["HTTPS load balancer / Nginx"]:::infra

  subgraph Swarm["AWS EC2 Docker Swarm Cluster"]
    direction LR
    Manager["Manager node<br/>scheduler + control plane"]:::infra
    WorkerA["Worker node A<br/>app replicas"]:::infra
    WorkerB["Worker node B<br/>app replicas"]:::infra
  end

  subgraph Replicas["Replicated Services"]
    direction LR
    Gateway["API Gateway x2"]:::service
    Services["Business services x2+"]:::service
    AI["AI Service x1-2"]:::ai
    Jobs["Scheduled jobs"]:::service
  end

  subgraph Data["Persistent Layer"]
    direction LR
    PG[("PostgreSQL volume")]:::data
    Mongo[("MongoDB volume")]:::data
    Redis[("Redis")]:::data
    Rabbit["RabbitMQ"]:::infra
  end

  Internet --> LB --> Gateway
  Manager --> WorkerA
  Manager --> WorkerB
  WorkerA --> Replicas
  WorkerB --> Replicas
  Gateway --> Services
  Services --> AI
  Services --> Jobs
  Services --> PG
  Services --> Mongo
  Services --> Redis
  Services --> Rabbit
"""
        ),
    ),
    Diagram(
        "01_system_architecture",
        "05_deployment_aws_swarm",
        "09_aws_topology.mmd",
        "AWS Architecture Diagram",
        "AWS Deployment Topology",
        with_classes(
            """
flowchart TB
  Users["Mobile and web users"]:::user
  DNS["Route 53 / DNS"]:::infra
  TLS["TLS termination"]:::infra

  subgraph VPC["AWS VPC"]
    direction TB
    subgraph Public["Public Subnet"]
      Bastion["Bastion / deploy runner"]:::infra
      Nginx["Nginx reverse proxy"]:::infra
    end
    subgraph Private["Private Subnet"]
      Swarm["Docker Swarm EC2 nodes"]:::infra
      AppNet["Overlay networks"]:::infra
      Storage["Attached volumes / backups"]:::data
    end
  end

  Providers["External providers<br/>Maps, OSRM, MoMo, VNPay, SMS"]:::external
  Observability["Prometheus, Grafana, logs"]:::infra

  Users --> DNS --> TLS --> Nginx --> Swarm --> AppNet
  Swarm --> Storage
  Swarm --> Providers
  Swarm --> Observability
"""
        ),
    ),
    Diagram(
        "01_system_architecture",
        "05_deployment_aws_swarm",
        "10_scaling_failover_strategy.mmd",
        "Scalability and HA Diagram",
        "Scaling and Failover Strategy",
        with_classes(
            """
flowchart LR
  Metrics["CPU, memory, latency, queue depth"]:::infra
  Autoscaler["Autoscaler policy"]:::service
  Replicas["Adjust service replicas"]:::service
  Placement["Spread replicas across nodes"]:::infra
  Health["Container health checks"]:::infra
  Failover{"Node or task unhealthy?"}:::infra
  Reschedule["Swarm reschedules task"]:::ok
  Alert["Alert operations team"]:::external

  Metrics --> Autoscaler --> Replicas --> Placement
  Placement --> Health --> Failover
  Failover -- Yes --> Reschedule --> Alert
  Failover -- No --> Metrics
"""
        ),
    ),
    Diagram(
        "01_system_architecture",
        "06_monitoring_observability",
        "11_observability_flow.mmd",
        "Monitoring Diagram",
        "Observability Flow",
        with_classes(
            """
flowchart LR
  Apps["Apps and services"]:::service
  Logs["Structured JSON logs"]:::infra
  Metrics["HTTP, process, queue metrics"]:::infra
  Health["/health endpoints"]:::infra

  subgraph Collectors["Collectors"]
    direction TB
    DockerLogs["Docker log driver"]:::infra
    Prometheus["Prometheus scraper"]:::infra
    HealthJob["Health polling job"]:::infra
  end

  subgraph Views["Operational Views"]
    direction TB
    Grafana["Grafana dashboards"]:::external
    Alerts["Alert rules"]:::external
    Admin["Admin health panel"]:::user
  end

  Apps --> Logs --> DockerLogs --> Grafana
  Apps --> Metrics --> Prometheus --> Grafana
  Prometheus --> Alerts
  Apps --> Health --> HealthJob --> Admin
"""
        ),
    ),
    Diagram(
        "01_system_architecture",
        "06_monitoring_observability",
        "12_health_check_recovery.mmd",
        "Monitoring Diagram",
        "Health Check and Recovery Loop",
        with_classes(
            """
flowchart TB
  Probe["Docker health check"]:::infra
  Endpoint["Service /health endpoint"]:::service
  Dependencies{"Critical dependencies ready?"}:::infra
  Healthy["Mark task healthy"]:::ok
  Unhealthy["Mark task unhealthy"]:::risk
  Restart["Restart container"]:::infra
  Reschedule["Reschedule if restart fails"]:::infra
  Notify["Notify through dashboard / alert"]:::external

  Probe --> Endpoint --> Dependencies
  Dependencies -- Yes --> Healthy
  Dependencies -- No --> Unhealthy --> Restart --> Probe
  Restart -. repeated failure .-> Reschedule --> Notify
"""
        ),
    ),
    Diagram(
        "01_system_architecture",
        "06_monitoring_observability",
        "13_metrics_stack.mmd",
        "Monitoring Diagram",
        "Metrics and Dashboard Stack",
        with_classes(
            """
flowchart TB
  subgraph Targets["Metric Targets"]
    direction LR
    Gateway["API Gateway"]:::service
    Services["Business services"]:::service
    Node["Docker nodes"]:::infra
    Rabbit["RabbitMQ"]:::infra
    DB["Databases"]:::data
  end

  Prometheus["Prometheus<br/>scrape + store"]:::infra
  Rules["Alert rules<br/>latency, errors, saturation"]:::infra
  Grafana["Grafana dashboards"]:::external
  Team["Operations team"]:::user

  Gateway --> Prometheus
  Services --> Prometheus
  Node --> Prometheus
  Rabbit --> Prometheus
  DB --> Prometheus
  Prometheus --> Rules --> Team
  Prometheus --> Grafana --> Team
"""
        ),
    ),
    Diagram(
        "02_analysis_design",
        "01_use_case",
        "01_usecase_roles.mmd",
        "Use Case Diagram",
        "Role-Based Use Cases",
        with_classes(
            """
flowchart LR
  Customer["Customer"]:::user
  Driver["Driver"]:::user
  Admin["Admin"]:::user

  subgraph CustomerCases["Customer Use Cases"]
    direction TB
    C1(["Register and sign in"]):::service
    C2(["Estimate fare"]):::service
    C3(["Book a ride"]):::service
    C4(["Track driver"]):::service
    C5(["Chat during ride"]):::service
    C6(["Pay and review"]):::service
    C7(["Redeem voucher"]):::service
    C8(["Ask AI chatbot"]):::ai
  end

  subgraph DriverCases["Driver Use Cases"]
    direction TB
    D1(["Submit documents"]):::service
    D2(["Go online or offline"]):::service
    D3(["Accept ride offer"]):::service
    D4(["Update ride state"]):::service
    D5(["Send GPS location"]):::service
    D6(["Top up wallet"]):::service
    D7(["Withdraw earnings"]):::service
  end

  subgraph AdminCases["Admin Use Cases"]
    direction TB
    A1(["Approve drivers"]):::service
    A2(["Monitor rides"]):::service
    A3(["Manage payments"]):::service
    A4(["Approve withdrawals"]):::service
    A5(["View system health"]):::service
    A6(["Manage users"]):::service
  end

  Customer --> C1
  Customer --> C2
  Customer --> C3
  Customer --> C4
  Customer --> C5
  Customer --> C6
  Customer --> C7
  Customer --> C8
  Driver --> D1
  Driver --> D2
  Driver --> D3
  Driver --> D4
  Driver --> D5
  Driver --> D6
  Driver --> D7
  Admin --> A1
  Admin --> A2
  Admin --> A3
  Admin --> A4
  Admin --> A5
  Admin --> A6
  C3 -. includes .-> C2
  C3 -. dispatches .-> D3
  C6 -. updates .-> D7
  A1 -. enables .-> D2
"""
        ),
    ),
    Diagram(
        "02_analysis_design",
        "02_activity",
        "02_customer_booking_activity.mmd",
        "Activity Diagram",
        "Customer Booking Activity",
        with_classes(
            """
flowchart LR
  subgraph Customer["Customer"]
    direction TB
    Start([Start]):::user
    Pick["Pick pickup and destination"]:::service
    Quote["View fare and ETA"]:::service
    Accept{"Accept quote?"}:::infra
    Edit["Edit route or cancel"]:::risk
  end

  subgraph System["FoxGo System"]
    direction TB
    Create["Create booking request"]:::service
    Dispatch["Dispatch nearby drivers"]:::service
    Assigned{"Driver assigned?"}:::infra
    Track["Track ride lifecycle"]:::service
    Pay["Pay and review"]:::service
    Done([End]):::ok
  end

  Start --> Pick --> Quote --> Accept
  Accept -- No --> Edit --> Done
  Accept -- Yes --> Create --> Dispatch --> Assigned
  Assigned -- No --> Dispatch
  Assigned -- Yes --> Track --> Pay --> Done
"""
        ),
    ),
    Diagram(
        "02_analysis_design",
        "02_activity",
        "03_driver_onboarding_activity.mmd",
        "Activity Diagram",
        "Driver Onboarding Activity",
        with_classes(
            """
flowchart LR
  subgraph DriverFlow["Driver"]
    direction TB
    Start([Start]):::user
    Signup["Create driver account"]:::service
    Verify["Verify phone OTP"]:::service
    Upload["Upload identity, license, vehicle"]:::service
    Fix["Fix rejected documents"]:::risk
  end

  subgraph AdminFlow["Admin Review"]
    direction TB
    Validate{"Documents complete?"}:::infra
    Queue["Put application in review queue"]:::service
    Review["Review documents"]:::service
    Approved{"Approved?"}:::infra
    Activate["Activate driver and wallet"]:::ok
    Reject["Reject with reason"]:::risk
    Done([End]):::ok
  end

  Start --> Signup --> Verify --> Upload --> Validate
  Validate -- No --> Fix --> Upload
  Validate -- Yes --> Queue --> Review --> Approved
  Approved -- No --> Reject --> Fix
  Approved -- Yes --> Activate --> Done
"""
        ),
    ),
    Diagram(
        "02_analysis_design",
        "02_activity",
        "04_payment_wallet_activity.mmd",
        "Activity Diagram",
        "Payment and Wallet Activity",
        with_classes(
            """
flowchart LR
  subgraph PaymentFlow["Payment"]
    direction TB
    Start([Ride completed]):::user
    Method{"Payment method?"}:::infra
    Capture["Capture cash confirmation<br/>or online checkout"]:::service
    Validate{"Valid and idempotent?"}:::infra
    Failed["Fail safely and keep audit trail"]:::risk
  end

  subgraph WalletFlow["Wallet"]
    direction TB
    Ledger["Write payment and wallet ledger"]:::data
    Hold["Hold driver earning for T+24h"]:::service
    Release["Release earning or process withdrawal"]:::ok
    Done([End]):::ok
  end

  Start --> Method --> Capture --> Validate
  Validate -- No --> Failed --> Done
  Validate -- Yes --> Ledger --> Hold --> Release --> Done
"""
        ),
    ),
    Diagram(
        "02_analysis_design",
        "02_activity",
        "05_admin_operations_activity.mmd",
        "Activity Diagram",
        "Admin Operations Activity",
        with_classes(
            """
flowchart LR
  Start([Start]):::user --> Login["Admin login"]:::service
  Login --> Dashboard["Open operations dashboard"]:::service
  Dashboard --> Task{"Select task"}:::infra

  Task -- Driver review --> DriverReview["Approve or reject driver"]:::service
  Task -- Finance review --> Withdrawal["Approve withdrawal"]:::service
  Task -- Live operations --> Monitor["Monitor rides and health"]:::service

  DriverReview --> Audit["Write audit log"]:::data
  Withdrawal --> Audit
  Monitor --> Audit
  Audit --> Notify["Notify affected user"]:::external
  Notify --> Done([End]):::ok
"""
        ),
    ),
    Diagram(
        "02_analysis_design",
        "02_activity",
        "06_voucher_review_activity.mmd",
        "Activity Diagram",
        "Voucher and Review Activity",
        with_classes(
            """
flowchart LR
  Start([Start]):::user
  Select["Select voucher"]:::service
  Eligible{"Eligible?"}:::infra
  Reject["Show eligibility reason"]:::risk
  Apply["Apply discount to fare"]:::service
  Complete["Complete ride"]:::service
  Review["Submit rating and review"]:::service
  Done([End]):::ok

  Start --> Select --> Eligible
  Eligible -- No --> Reject --> Done
  Eligible -- Yes --> Apply --> Complete --> Review --> Done
"""
        ),
    ),
    Diagram(
        "02_analysis_design",
        "03_sequence",
        "07_auth_otp_sequence.mmd",
        "Sequence Diagram",
        "OTP Authentication Sequence",
        """
sequenceDiagram
  autonumber
  actor User
  participant Gateway as API Gateway
  participant Auth as Auth Service
  participant Redis as Redis OTP
  participant SMS as SMS Provider
  participant DB as auth_db
  User->>Gateway: Start registration or login
  Gateway->>Auth: Send phone number
  Auth->>Redis: Save OTP with TTL
  Auth->>SMS: Send OTP
  SMS-->>User: OTP code
  User->>Gateway: Submit OTP
  Gateway->>Auth: Verify OTP
  Auth->>DB: Create user or session
  Auth-->>Gateway: JWT and refresh token
  Gateway-->>User: Authenticated session
""",
    ),
    Diagram(
        "02_analysis_design",
        "03_sequence",
        "08_booking_dispatch_sequence.mmd",
        "Sequence Diagram",
        "Booking Dispatch Sequence",
        """
sequenceDiagram
  autonumber
  actor Customer
  participant Gateway as API Gateway
  participant Booking as Booking Service
  participant Pricing as Pricing + AI
  participant Driver as Driver Service
  participant Ride as Ride Service
  participant Socket as Socket.IO
  actor DriverApp as Driver App
  Customer->>Gateway: Request fare estimate
  Gateway->>Booking: Route and vehicle type
  Booking->>Pricing: Calculate fare, ETA, surge
  Pricing-->>Booking: Quote with fallback status
  Booking-->>Customer: Show quote
  Customer->>Gateway: Confirm booking
  Gateway->>Booking: Create booking
  Booking->>Driver: Find ranked online drivers
  Driver-->>Booking: Candidate drivers
  Booking->>Ride: Create ride offer
  Ride->>Socket: Push offer
  Socket-->>DriverApp: New ride offer
  DriverApp->>Gateway: Accept offer
  Gateway->>Ride: Assign driver
  Ride->>Socket: Notify customer and driver
""",
    ),
    Diagram(
        "02_analysis_design",
        "03_sequence",
        "09_ride_tracking_sequence.mmd",
        "Sequence Diagram",
        "Ride Tracking Sequence",
        """
sequenceDiagram
  autonumber
  actor DriverApp as Driver App
  participant Gateway as API Gateway
  participant Ride as Ride Service
  participant Redis as Redis GEO
  participant Socket as Socket.IO
  actor Customer
  DriverApp->>Gateway: Start navigation
  Gateway->>Ride: Mark driver arriving
  Ride->>Socket: Broadcast ride state
  Socket-->>Customer: Driver is arriving
  loop Every few seconds
    DriverApp->>Gateway: Send GPS update
    Gateway->>Redis: Store latest location
    Gateway->>Ride: Append location point
    Gateway->>Socket: Emit driver location
    Socket-->>Customer: Move driver marker
  end
  DriverApp->>Gateway: Arrived, picked up, completed
  Gateway->>Ride: Update ride state
  Ride->>Socket: Broadcast state update
""",
    ),
    Diagram(
        "02_analysis_design",
        "03_sequence",
        "10_online_payment_ipn_sequence.mmd",
        "Sequence Diagram",
        "Online Payment IPN Sequence",
        """
%%{init: {"sequence": {"mirrorActors": true}} }%%
sequenceDiagram
  autonumber
  actor Customer as Customer App
  participant Gateway as API Gateway
  participant Ride as Ride Service
  participant Payment as Payment Service
  participant PayDB as payment_db
  participant Provider as MoMo / VNPay
  participant MQ as RabbitMQ
  participant Notify as Notification Service

  Customer->>Gateway: POST /api/rides {paymentMethod = MOMO or VNPAY}
  Gateway->>Ride: Create ride and estimate fare
  Ride->>Ride: Store ride as CREATED
  Ride-->>Customer: rideId + estimatedFare

  Customer->>Gateway: POST /api/payments/momo/create or vnpay/create
  Gateway->>Payment: Forward request via gRPC HTTP bridge
  Payment->>PayDB: Find Payment by rideId + Idempotency-Key
  alt Existing intent
    PayDB-->>Payment: Stored status + gatewayResponse
  else New intent
    Payment->>Provider: Create signed checkout order (orderId = rideId)
    Provider-->>Payment: payUrl / deeplink / qrCodeUrl / txnRef
    Payment->>PayDB: INSERT Payment(REQUIRES_ACTION, gatewayResponse)
    Payment->>MQ: payment.intent.created
  end
  Payment-->>Gateway: paymentUrl / payUrl / status
  Gateway-->>Customer: Checkout data
  Customer->>Provider: Redirect or open checkout

  par Provider IPN
    Provider->>Payment: POST /momo/webhook or GET /vnpay/ipn
  and Browser return
    Provider-->>Customer: Redirect /payment/callback
    Customer->>Gateway: GET /api/payments/{provider}/return
    Gateway->>Payment: Confirm return result
  end

  Payment->>Payment: Verify signature and VNPay amount
  Payment->>PayDB: Read payment by rideId
  alt Invalid signature, amount, or order
    Payment-->>Provider: Failure acknowledgement
    Payment-->>Customer: Payment failed
  else Duplicate terminal state
    PayDB-->>Payment: COMPLETED / FAILED / REFUNDED
    Payment-->>Provider: Safe acknowledgement
    Payment-->>Customer: Current payment status
  else Successful callback
    Payment->>PayDB: TX update Payment(COMPLETED) + OutboxEvent(payment.completed)
    Payment->>MQ: payment.completed + payment.success
    Note over Payment,MQ: Optional booking payment callback is sent after commit
    MQ->>Ride: startFindingDriverAfterPayment(rideId)
    MQ->>Notify: Notify customer payment success
  else Failed callback
    Payment->>PayDB: TX update Payment(FAILED) + OutboxEvent(payment.failed)
    Payment->>MQ: payment.failed
    MQ->>Notify: Notify customer payment failure
  end
""",
    ),
    Diagram(
        "02_analysis_design",
        "03_sequence",
        "11_wallet_topup_withdrawal_sequence.mmd",
        "Sequence Diagram",
        "Wallet Top-Up and Withdrawal Sequence",
        """
sequenceDiagram
  autonumber
  actor Driver
  participant Wallet as Wallet Service
  participant Payment as Payment Service
  participant Provider as MoMo/VNPay
  participant Admin as Admin Dashboard
  participant DB as wallet_db
  Driver->>Wallet: Request wallet top-up
  Wallet->>Payment: Create top-up payment
  Payment->>Provider: Create checkout session
  Provider-->>Payment: IPN success
  Payment-->>Wallet: Publish topup.completed
  Wallet->>DB: Credit ledger
  Driver->>Wallet: Request withdrawal
  Wallet->>Admin: Create approval task
  Admin->>Wallet: Approve withdrawal
  Wallet->>DB: Debit ledger
  Wallet-->>Driver: Withdrawal approved
""",
    ),
    Diagram(
        "02_analysis_design",
        "03_sequence",
        "12_driver_approval_sequence.mmd",
        "Sequence Diagram",
        "Driver Approval Sequence",
        """
sequenceDiagram
  autonumber
  actor Driver
  participant Gateway as API Gateway
  participant DriverSvc as Driver Service
  participant Admin as Admin Dashboard
  participant Notification as Notification Service
  Driver->>Gateway: Submit documents
  Gateway->>DriverSvc: Create pending application
  DriverSvc-->>Admin: Display application
  Admin->>DriverSvc: Review documents
  alt Approved
    Admin->>DriverSvc: Set status to APPROVED
    DriverSvc->>Notification: Notify approval
  else Rejected
    Admin->>DriverSvc: Set status to REJECTED
    DriverSvc->>Notification: Notify required fixes
  end
""",
    ),
    Diagram(
        "02_analysis_design",
        "03_sequence",
        "13_cancel_refund_sequence.mmd",
        "Sequence Diagram",
        "Cancellation and Refund Sequence",
        """
sequenceDiagram
  autonumber
  actor Customer
  participant Ride as Ride Service
  participant Payment as Payment Service
  participant Wallet as Wallet Service
  participant Notification as Notification Service
  actor Driver
  Customer->>Ride: Cancel ride
  Ride->>Ride: Validate current state
  alt Cancellation is allowed
    Ride->>Payment: Void or refund payment if needed
    Payment->>Wallet: Release held earning
    Ride->>Notification: Notify customer and driver
    Notification-->>Driver: Ride cancelled
  else Cancellation is too late
    Ride-->>Customer: Reject cancellation
  end
""",
    ),
    Diagram(
        "02_analysis_design",
        "03_sequence",
        "14_chat_notification_sequence.mmd",
        "Sequence Diagram",
        "Chat and Notification Sequence",
        """
sequenceDiagram
  autonumber
  actor Customer
  participant Gateway as API Gateway
  participant Ride as Ride Service
  participant Socket as Socket.IO
  participant Notification as Notification Service
  actor Driver
  Customer->>Gateway: Send chat message
  Gateway->>Ride: Store message
  Gateway->>Socket: Emit to ride room
  Socket-->>Driver: Receive message in realtime
  alt Driver is offline
    Gateway->>Notification: Send push notification
    Notification-->>Driver: Push notification
  end
""",
    ),
    Diagram(
        "02_analysis_design",
        "03_sequence",
        "15_voucher_redeem_sequence.mmd",
        "Sequence Diagram",
        "Voucher Redeem Sequence",
        """
sequenceDiagram
  autonumber
  actor Customer
  participant Gateway as API Gateway
  participant Payment as Payment Service
  participant Pricing as Pricing Service
  participant DB as payment_db
  Customer->>Gateway: Apply voucher
  Gateway->>Payment: Validate voucher
  Payment->>DB: Check usage, expiry, and budget
  DB-->>Payment: Voucher result
  Payment->>Pricing: Recalculate fare
  Pricing-->>Payment: Discounted fare
  Payment-->>Gateway: Voucher applied
  Gateway-->>Customer: Show final fare
""",
    ),
    Diagram(
        "02_analysis_design",
        "03_sequence",
        "16_review_rating_sequence.mmd",
        "Sequence Diagram",
        "Review and Rating Sequence",
        """
sequenceDiagram
  autonumber
  actor Customer
  participant Ride as Ride Service
  participant Review as Review Service
  participant Driver as Driver Service
  participant Mongo as MongoDB
  Customer->>Ride: Submit review
  Ride->>Review: Create review
  Review->>Mongo: Store rating and comment
  Review->>Driver: Update driver rating aggregate
  Driver-->>Review: Rating updated
  Review-->>Customer: Review saved
""",
    ),
    Diagram(
        "02_analysis_design",
        "03_sequence",
        "17_settlement_t24h_sequence.mmd",
        "Sequence Diagram",
        "T+24h Settlement Sequence",
        """
sequenceDiagram
  autonumber
  participant Ride as Ride Service
  participant MQ as RabbitMQ
  participant Payment as Payment Service
  participant PayDB as payment_db
  participant Wallet as Wallet Service
  participant WalletDB as wallet_db
  participant Job as Settlement Job
  actor Driver

  Ride->>MQ: ride.completed {fare, driverId, method, voucherCode}
  MQ->>Payment: Consume ride.completed
  Payment->>PayDB: Check Fare + Payment + DriverEarnings by rideId
  alt Duplicate ride.completed
    PayDB-->>Payment: Existing records found
    Payment-->>MQ: Ack without reprocessing
  else First settlement event
    Payment->>Payment: Calculate fare, voucher, commission, netEarnings
    Payment->>PayDB: TX upsert Fare + Payment + DriverEarnings
    Payment->>PayDB: INSERT OutboxEvent(fare.calculated)
  end

  alt Cash ride
    Payment->>PayDB: Mark Payment COMPLETED (COD)
    Payment->>MQ: driver.earning.settled(cashDebt)
    MQ->>Wallet: Consume driver.earning.settled
    Wallet->>WalletDB: debitCommission(driverId, cashDebt)
    Wallet->>WalletDB: DebtRecord + WalletTransaction(COMMISSION)
    Wallet->>WalletDB: MerchantLedger(COMMISSION)
  else Online ride (MoMo / VNPay)
    Payment->>MQ: driver.earning.settled(netEarnings, voucherDiscount)
    MQ->>Wallet: Consume driver.earning.settled
    Wallet->>WalletDB: creditEarning(driverId, netEarnings)
    Wallet->>WalletDB: pendingBalance += netEarnings
    Wallet->>WalletDB: PendingEarning(settleAt = now + 24h)
    Wallet->>WalletDB: MerchantLedger(PAYMENT)
    alt Voucher was used
      Wallet->>WalletDB: MerchantLedger(VOUCHER)
    end
  end

  loop Every 30 minutes or when driver reads balance
    Driver->>Wallet: GET /wallet/balance
    Job->>Wallet: settlePendingEarnings(driverId)
    Wallet->>WalletDB: Find unsettled PendingEarning where settleAt <= now
    Wallet->>WalletDB: pendingBalance -> availableBalance
    Wallet->>WalletDB: Settle oldest DebtRecords first
    Wallet->>WalletDB: MerchantLedger(PAYOUT)
    Wallet-->>Driver: Updated availableBalance
  end
""",
    ),
    Diagram(
        "02_analysis_design",
        "03_sequence",
        "18_ai_chatbot_sequence.mmd",
        "Sequence Diagram",
        "AI Chatbot Sequence",
        """
sequenceDiagram
  autonumber
  actor User
  participant Gateway as API Gateway
  participant AI as AI Service
  participant Vector as Vector Index
  participant Docs as Project Docs
  User->>Gateway: Ask chatbot
  Gateway->>AI: Send question and context
  AI->>Vector: Retrieve relevant chunks
  Vector-->>AI: Top documents
  AI->>Docs: Optional source lookup
  AI-->>Gateway: Grounded answer
  Gateway-->>User: AI response
""",
    ),
    Diagram(
        "02_analysis_design",
        "04_database",
        "19_core_erd.mmd",
        "Database Diagram",
        "Core Entity Relationship Diagram",
        """
erDiagram
  USER ||--o{ REFRESH_TOKEN : owns
  USER ||--o{ USER_PROFILE : has
  USER ||--o{ DRIVER : may_be
  DRIVER ||--o{ VEHICLE : owns
  DRIVER ||--o{ DRIVER_LOCATION : reports
  USER ||--o{ BOOKING : creates
  BOOKING ||--|| RIDE : becomes
  DRIVER ||--o{ RIDE : accepts
  RIDE ||--o{ RIDE_STATE_TRANSITION : records
  RIDE ||--o{ PAYMENT : paid_by
  PAYMENT ||--o{ TRANSACTION : has
  DRIVER ||--|| WALLET : owns
  WALLET ||--o{ WALLET_LEDGER : records
  RIDE ||--o{ REVIEW : receives

  USER {
    string id
    string phone
    string role
  }
  DRIVER {
    string id
    string status
    float rating
  }
  BOOKING {
    string id
    string pickup
    string destination
  }
  RIDE {
    string id
    string status
    decimal fare
  }
  PAYMENT {
    string id
    string provider
    string status
  }
  WALLET {
    string id
    decimal available_balance
    decimal held_balance
  }
""",
    ),
    Diagram(
        "02_analysis_design",
        "04_database",
        "20_rabbitmq_event_flow.mmd",
        "Event Flow Diagram",
        "RabbitMQ Domain Event Flow",
        with_classes(
            """
flowchart LR
  subgraph Producers["Event Producers"]
    direction TB
    Ride["Ride Service"]:::service
    Payment["Payment Service"]:::service
    Wallet["Wallet Service"]:::service
    Driver["Driver Service"]:::service
  end

  Exchange["topic exchange<br/>foxgo.events"]:::infra

  subgraph Queues["Durable Queues"]
    direction TB
    PaymentQ["payment.events"]:::infra
    WalletQ["wallet.events"]:::infra
    NotificationQ["notification.events"]:::infra
    ReviewQ["review.events"]:::infra
  end

  subgraph Consumers["Event Consumers"]
    direction TB
    WalletConsumer["Wallet handlers"]:::service
    RideConsumer["Ride handlers"]:::service
    NotificationConsumer["Notification handlers"]:::service
    ReviewConsumer["Review handlers"]:::service
  end

  Ride --> Exchange
  Payment --> Exchange
  Wallet --> Exchange
  Driver --> Exchange
  Exchange --> PaymentQ
  Exchange --> WalletQ
  Exchange --> NotificationQ
  Exchange --> ReviewQ
  WalletQ --> WalletConsumer
  PaymentQ --> RideConsumer
  NotificationQ --> NotificationConsumer
  ReviewQ --> ReviewConsumer
"""
        ),
    ),
    Diagram(
        "02_analysis_design",
        "05_ddd",
        "21_bounded_context_map.mmd",
        "DDD Diagram",
        "Bounded Context Map",
        with_classes(
            """
flowchart TB
  Identity["Identity Context<br/>Auth, User"]:::service
  Mobility["Mobility Core Context<br/>Booking, Ride, Driver, Pricing"]:::service
  Finance["Finance Context<br/>Payment, Wallet"]:::service
  Support["Support and AI Context<br/>Notification, Review, AI"]:::ai

  Identity -- identity data --> Mobility
  Mobility -- ride completed --> Finance
  Finance -- payment status --> Mobility
  Mobility -- notify users --> Support
  Finance -- finance event --> Support
  Mobility -- AI request --> Support
  Support -- AI signal --> Mobility
"""
        ),
    ),
    Diagram(
        "02_analysis_design",
        "05_ddd",
        "22_data_ownership.mmd",
        "DDD Diagram",
        "Data Ownership by Bounded Context",
        with_classes(
            """
flowchart TB
  subgraph Identity["Identity Context Stores"]
    direction LR
    Auth["Auth"]:::service --> AuthDB[("auth_db")]:::data
    UserSvc["User"]:::service --> UserDB[("user_db")]:::data
  end

  subgraph Mobility["Mobility Context Stores"]
    direction LR
    Driver["Driver"]:::service --> DriverDB[("driver_db")]:::data
    Booking["Booking"]:::service --> BookingDB[("booking_db")]:::data
    Ride["Ride"]:::service --> RideDB[("ride_db")]:::data
    Pricing["Pricing"]:::service --> PricingDB[("pricing_db")]:::data
  end

  subgraph Finance["Finance Context Stores"]
    direction LR
    Payment["Payment"]:::service --> PaymentDB[("payment_db")]:::data
    Wallet["Wallet"]:::service --> WalletDB[("wallet_db")]:::data
  end

  subgraph Support["Support Context Stores"]
    direction LR
    Notification["Notification"]:::service --> NotiDB[("Mongo notifications")]:::data
    Review["Review"]:::service --> ReviewDB[("Mongo reviews")]:::data
    AI["AI"]:::ai --> AIStore[("models + vector index")]:::data
  end

  Identity --> Mobility
  Mobility --> Finance
  Mobility --> Support
"""
        ),
    ),
    Diagram(
        "02_analysis_design",
        "06_state_machine",
        "23_ride_state_machine.mmd",
        "State Machine Diagram",
        "Ride State Machine",
        """
stateDiagram-v2
  [*] --> REQUESTED
  REQUESTED --> MATCHING: customer confirms
  MATCHING --> DRIVER_ASSIGNED: driver accepts
  MATCHING --> CANCELLED: timeout or cancel
  DRIVER_ASSIGNED --> DRIVER_ARRIVING
  DRIVER_ARRIVING --> ARRIVED
  ARRIVED --> IN_PROGRESS
  IN_PROGRESS --> COMPLETED
  COMPLETED --> PAID
  PAID --> REVIEWED
  REVIEWED --> [*]
  CANCELLED --> [*]
""",
    ),
    Diagram(
        "02_analysis_design",
        "06_state_machine",
        "24_payment_state_machine.mmd",
        "State Machine Diagram",
        "Payment State Machine",
        """
stateDiagram-v2
  [*] --> CREATED
  CREATED --> PENDING_PROVIDER: online checkout
  CREATED --> CAPTURED: cash confirmed
  PENDING_PROVIDER --> CAPTURED: valid IPN
  PENDING_PROVIDER --> FAILED: invalid or expired
  CAPTURED --> REFUNDED: cancellation refund
  CAPTURED --> SETTLED: wallet event published
  FAILED --> [*]
  REFUNDED --> [*]
  SETTLED --> [*]
""",
    ),
    Diagram(
        "02_analysis_design",
        "06_state_machine",
        "25_wallet_state_machine.mmd",
        "State Machine Diagram",
        "Wallet State Machine",
        """
stateDiagram-v2
  [*] --> ACTIVE
  ACTIVE --> TOPUP_PENDING
  TOPUP_PENDING --> ACTIVE: provider confirms
  ACTIVE --> EARNING_HELD: ride completed
  EARNING_HELD --> AVAILABLE: T+24h settlement
  AVAILABLE --> WITHDRAW_PENDING
  WITHDRAW_PENDING --> AVAILABLE: rejected
  WITHDRAW_PENDING --> WITHDRAWN: approved
  WITHDRAWN --> AVAILABLE
""",
    ),
    Diagram(
        "02_analysis_design",
        "06_state_machine",
        "26_driver_availability_state_machine.mmd",
        "State Machine Diagram",
        "Driver Availability State Machine",
        """
stateDiagram-v2
  [*] --> OFFLINE
  OFFLINE --> ONLINE: go online
  ONLINE --> OFFERED: ride offer sent
  OFFERED --> BUSY: accept offer
  OFFERED --> ONLINE: decline or timeout
  BUSY --> ONLINE: ride completed
  BUSY --> SUSPENDED: safety or policy issue
  ONLINE --> OFFLINE: go offline
  SUSPENDED --> OFFLINE: admin clears issue
""",
    ),
    Diagram(
        "02_analysis_design",
        "07_algorithm",
        "27_driver_dispatch_algorithm.mmd",
        "Algorithm Flowchart",
        "Driver Dispatch Algorithm",
        with_classes(
            """
flowchart TB
  Start([Booking confirmed]):::user
  Build["Build driver candidate pool"]:::service
  Radius["Search radius rounds<br/>2 km, 3 km, 5 km"]:::service
  Filter["Filter availability, vehicle type, rating"]:::service
  Score["Score by distance, acceptance probability, ETA"]:::ai
  Offer["Send offer to best driver"]:::service
  Accepted{"Accepted before timeout?"}:::infra
  Assign["Assign driver and create ride"]:::ok
  Retry{"More candidates or rounds?"}:::infra
  Fail["No driver available"]:::risk

  Start --> Build --> Radius --> Filter --> Score --> Offer --> Accepted
  Accepted -- Yes --> Assign
  Accepted -- No --> Retry
  Retry -- Yes --> Radius
  Retry -- No --> Fail
"""
        ),
    ),
    Diagram(
        "01_system_architecture",
        "07_architecture_patterns",
        "14_architecture_pattern_catalog.mmd",
        "Architecture Pattern Diagram",
        "Microservice Pattern Catalog",
        with_classes(
            """
flowchart TB
  Goal["Maintainable, scalable microservice architecture"]:::user

  subgraph Access["Access and Edge"]
    direction TB
    Gateway["API Gateway"]:::service
    Realtime["Realtime gateway<br/>Socket.IO rooms"]:::service
  end

  subgraph Decomposition["Service Decomposition"]
    direction TB
    BoundedContext["Bounded Context per Service"]:::service
    DatabasePerService["Database per Service"]:::data
    ContractFirst["Contract-first DTOs"]:::infra
  end

  subgraph Integration["Integration"]
    direction TB
    PubSub["Publish / Subscribe"]:::infra
    Saga["Saga orchestration"]:::service
    Idempotency["Idempotent consumer"]:::ok
    Outbox["Transactional outbox"]:::infra
  end

  subgraph Reliability["Reliability"]
    direction TB
    CircuitBreaker["Circuit breaker"]:::infra
    Retry["Retry with backoff"]:::infra
    Fallback["Fallback response"]:::ok
    HealthCheck["Health check"]:::infra
  end

  Goal --> Gateway
  Goal --> BoundedContext
  Goal --> PubSub
  Goal --> CircuitBreaker
  Gateway --> Realtime
  BoundedContext --> DatabasePerService --> ContractFirst
  PubSub --> Saga --> Idempotency --> Outbox
  CircuitBreaker --> Retry --> Fallback --> HealthCheck
"""
        ),
    ),
    Diagram(
        "01_system_architecture",
        "07_architecture_patterns",
        "15_api_gateway_pattern.mmd",
        "Architecture Pattern Diagram",
        "API Gateway Pattern",
        with_classes(
            """
flowchart LR
  Clients["Customer, driver, and admin apps"]:::user

  subgraph Gateway["API Gateway Responsibilities"]
    direction TB
    Auth["JWT validation"]:::service
    Route["Route aggregation"]:::service
    Throttle["Rate limiting and guard rules"]:::infra
    Socket["Socket.IO session bridge"]:::service
    Grpc["gRPC / HTTP service clients"]:::service
  end

  subgraph Services["Internal Services"]
    direction TB
    Identity["Identity services"]:::service
    Mobility["Mobility services"]:::service
    Finance["Finance services"]:::service
    Support["Support services"]:::service
  end

  Clients --> Auth --> Route
  Route --> Grpc
  Route --> Socket
  Route --> Throttle
  Grpc --> Identity
  Grpc --> Mobility
  Grpc --> Finance
  Grpc --> Support
  Socket --> Mobility
"""
        ),
    ),
    Diagram(
        "01_system_architecture",
        "07_architecture_patterns",
        "16_database_per_service_pattern.mmd",
        "Architecture Pattern Diagram",
        "Database per Service Pattern",
        with_classes(
            """
flowchart TB
  subgraph Services["Service Ownership"]
    direction LR
    Auth["Auth Service"]:::service
    Ride["Ride Service"]:::service
    Payment["Payment Service"]:::service
    Wallet["Wallet Service"]:::service
    Review["Review Service"]:::service
  end

  subgraph Stores["Private Data Stores"]
    direction LR
    AuthDB[("auth_db")]:::data
    RideDB[("ride_db")]:::data
    PaymentDB[("payment_db")]:::data
    WalletDB[("wallet_db")]:::data
    ReviewDB[("review_db / Mongo")]:::data
  end

  Events["Domain events for cross-service state"]:::infra
  APIs["Read APIs for owned data"]:::service

  Auth --> AuthDB
  Ride --> RideDB
  Payment --> PaymentDB
  Wallet --> WalletDB
  Review --> ReviewDB
  Services --> Events
  Services --> APIs
  Events --> Services
"""
        ),
    ),
    Diagram(
        "01_system_architecture",
        "07_architecture_patterns",
        "17_saga_outbox_idempotency_pattern.mmd",
        "Architecture Pattern Diagram",
        "Saga, Outbox, and Idempotency Pattern",
        with_classes(
            """
flowchart LR
  Command["Ride completed command"]:::user
  Ride["Ride Service<br/>state transition"]:::service
  Outbox[("Outbox table<br/>pending event")]:::data
  Relay["Event relay"]:::infra
  MQ["RabbitMQ exchange"]:::infra

  subgraph Consumers["Idempotent Consumers"]
    direction TB
    Payment["Payment handler<br/>dedupe by event id"]:::service
    Wallet["Wallet handler<br/>ledger uniqueness"]:::service
    Notification["Notification handler<br/>safe retry"]:::service
  end

  Compensation["Compensation action<br/>refund or release hold"]:::risk

  Command --> Ride
  Ride --> Outbox
  Outbox --> Relay --> MQ
  MQ --> Payment
  MQ --> Wallet
  MQ --> Notification
  Payment -. failure .-> Compensation
  Wallet -. failure .-> Compensation
"""
        ),
    ),
    Diagram(
        "01_system_architecture",
        "07_architecture_patterns",
        "18_resilience_patterns.mmd",
        "Architecture Pattern Diagram",
        "Resilience Pattern Map",
        with_classes(
            """
flowchart TB
  Request["Incoming request"]:::user
  Timeout["Timeout budget"]:::infra
  Retry["Retry with backoff"]:::infra
  Circuit{"Circuit open?"}:::infra
  Primary["Primary dependency"]:::service
  Fallback["Fallback value or cached response"]:::ok
  Queue["Queue for async retry"]:::infra
  Alert["Alert and trace correlation"]:::external
  Response["Controlled response"]:::service

  Request --> Timeout --> Circuit
  Circuit -- No --> Primary --> Response
  Circuit -- Yes --> Fallback --> Response
  Primary -. transient error .-> Retry --> Primary
  Primary -. repeated failure .-> Queue --> Alert
"""
        ),
    ),
    Diagram(
        "02_analysis_design",
        "08_design_patterns",
        "28_ddd_tactical_patterns.mmd",
        "Design Pattern Diagram",
        "DDD Tactical Patterns",
        with_classes(
            """
flowchart TB
  subgraph Aggregate["Aggregate Pattern"]
    direction LR
    RideAgg["Ride aggregate<br/>state transition rules"]:::service
    WalletAgg["Wallet aggregate<br/>balance invariants"]:::service
    PaymentAgg["Payment aggregate<br/>provider status"]:::service
  end

  subgraph DomainModel["Domain Model Patterns"]
    direction LR
    Entity["Entity<br/>identity over time"]:::service
    ValueObject["Value Object<br/>money, location, phone"]:::service
    DomainEvent["Domain Event<br/>ride.completed"]:::infra
  end

  subgraph Application["Application Layer Patterns"]
    direction LR
    UseCase["Use case service"]:::service
    Repository["Repository interface"]:::service
    Mapper["DTO mapper"]:::infra
  end

  RideAgg --> Entity
  WalletAgg --> ValueObject
  PaymentAgg --> DomainEvent
  UseCase --> Aggregate
  UseCase --> Repository
  UseCase --> Mapper
"""
        ),
    ),
    Diagram(
        "02_analysis_design",
        "08_design_patterns",
        "29_application_design_patterns.mmd",
        "Design Pattern Diagram",
        "Application Design Pattern Map",
        with_classes(
            """
flowchart LR
  Controller["Controller<br/>validate request"]:::service
  UseCase["Use case<br/>orchestrate workflow"]:::service
  Strategy["Strategy<br/>payment provider, fare rule"]:::ai
  StateMachine["State machine<br/>ride and payment status"]:::service
  Repository["Repository<br/>persistence abstraction"]:::service
  Adapter["Adapter<br/>external provider client"]:::external
  Events["Domain event publisher"]:::infra

  Controller --> UseCase
  UseCase --> Strategy
  UseCase --> StateMachine
  UseCase --> Repository
  UseCase --> Adapter
  UseCase --> Events
"""
        ),
    ),
    Diagram(
        "02_analysis_design",
        "08_design_patterns",
        "30_pattern_decision_matrix.mmd",
        "Design Pattern Diagram",
        "Pattern Decision Matrix",
        with_classes(
            """
flowchart TB
  Need["System design need"]:::user

  subgraph Decisions["Pattern Choices"]
    direction LR
    Scale["Scale independent services<br/>Microservices + API Gateway"]:::service
    Data["Keep ownership clear<br/>Database per Service"]:::data
    Workflow["Coordinate distributed workflow<br/>Saga + domain events"]:::infra
    Safety["Handle duplicate callbacks<br/>Idempotency key"]:::ok
    Change["Swap algorithms/providers<br/>Strategy + adapter"]:::ai
    State["Control lifecycle transitions<br/>State machine"]:::service
  end

  Need --> Scale
  Need --> Data
  Need --> Workflow
  Need --> Safety
  Need --> Change
  Need --> State
"""
        ),
    ),
]


DIAGRAMS.extend(
    [
        Diagram(
            "01_system_architecture",
            "08_operating_principles",
            "19_jwt_authentication_principle.mmd",
            "Operating Principle Diagram",
            "JWT Authentication Principle",
            with_classes(
                """
flowchart LR
  Login["Login / OTP verified"]:::user
  Auth["Auth Service<br/>issue signed JWT"]:::security
  Token["Access token<br/>header.payload.signature"]:::pattern
  Client["Client stores token"]:::user
  Gateway["API Gateway<br/>verify signature + claims"]:::security
  Service["Protected service"]:::service
  Refresh["Refresh token rotation"]:::infra

  Login --> Auth --> Token --> Client --> Gateway --> Service
  Client --> Refresh --> Auth
"""
            ),
        ),
        Diagram(
            "01_system_architecture",
            "08_operating_principles",
            "20_database_per_service_principle.mmd",
            "Operating Principle Diagram",
            "Database per Service Principle",
            with_classes(
                """
flowchart TB
  subgraph Rule["Principle"]
    direction LR
    Own["Each service owns its schema"]:::service
    NoJoin["No cross-service joins"]:::risk
    API["Read through API"]:::ok
    Event["Sync state through events"]:::infra
  end

  subgraph Example["Example"]
    direction LR
    Ride["Ride Service"]:::service --> RideDB[("ride_db")]:::data
    Payment["Payment Service"]:::service --> PaymentDB[("payment_db")]:::data
    Wallet["Wallet Service"]:::service --> WalletDB[("wallet_db")]:::data
  end

  Own --> API
  Own --> Event
  NoJoin -. avoided by .-> API
  Event --> Payment
  Event --> Wallet
"""
            ),
        ),
        Diagram(
            "01_system_architecture",
            "08_operating_principles",
            "21_event_driven_messaging_principle.mmd",
            "Operating Principle Diagram",
            "Event Driven Messaging Principle",
            with_classes(
                """
flowchart LR
  Producer["Producer service<br/>state changed"]:::service
  Event["Domain event<br/>RideCompleted"]:::pattern
  Exchange["Topic exchange"]:::infra
  QueueA["payment.queue"]:::infra
  QueueB["wallet.queue"]:::infra
  QueueC["notification.queue"]:::infra
  ConsumerA["Payment handler"]:::service
  ConsumerB["Wallet handler"]:::service
  ConsumerC["Notification handler"]:::service

  Producer --> Event --> Exchange
  Exchange --> QueueA --> ConsumerA
  Exchange --> QueueB --> ConsumerB
  Exchange --> QueueC --> ConsumerC
"""
            ),
        ),
        Diagram(
            "01_system_architecture",
            "08_operating_principles",
            "22_redis_geo_matching_principle.mmd",
            "Operating Principle Diagram",
            "Redis GEO Matching Principle",
            with_classes(
                """
flowchart TB
  DriverGPS["Driver app sends GPS"]:::user
  GeoAdd["Redis GEOADD<br/>driver location"]:::data
  Booking["Booking confirmed"]:::user
  GeoRadius["Search nearby drivers<br/>2 km, 3 km, 5 km"]:::data
  Rank["Rank by distance, rating, acceptance probability"]:::ai
  Offer["Send ride offer"]:::service
  TTL["Expire stale locations"]:::infra

  DriverGPS --> GeoAdd --> TTL
  Booking --> GeoRadius
  GeoAdd --> GeoRadius --> Rank --> Offer
"""
            ),
        ),
        Diagram(
            "01_system_architecture",
            "08_operating_principles",
            "23_payment_ipn_idempotency_principle.mmd",
            "Operating Principle Diagram",
            "Payment IPN Idempotency Principle",
            with_classes(
                """
flowchart LR
  Provider["MoMo / VNPay IPN"]:::external
  Verify["Verify signature"]:::security
  Key["Idempotency key<br/>providerTxnId"]:::pattern
  Seen{"Already processed?"}:::infra
  Ack["Safe ACK"]:::ok
  Commit["Create payment transaction"]:::service
  Event["Publish payment.completed"]:::infra

  Provider --> Verify --> Key --> Seen
  Seen -- Yes --> Ack
  Seen -- No --> Commit --> Event --> Ack
"""
            ),
        ),
        Diagram(
            "01_system_architecture",
            "08_operating_principles",
            "24_observability_feedback_principle.mmd",
            "Operating Principle Diagram",
            "Observability Feedback Principle",
            with_classes(
                """
flowchart LR
  Signal["Logs, metrics, traces, health"]:::infra
  Collect["Collect and normalize"]:::service
  Dashboard["Dashboard view"]:::external
  Alert["Alert rule"]:::risk
  Diagnose["Diagnose service / node"]:::service
  Fix["Rollback, scale, or restart"]:::ok
  Learn["Improve threshold and runbook"]:::pattern

  Signal --> Collect --> Dashboard --> Diagnose --> Fix --> Learn --> Alert
  Collect --> Alert --> Diagnose
"""
            ),
        ),
        Diagram(
            "02_analysis_design",
            "05_ddd",
            "23_context_map_dependencies.mmd",
            "DDD Diagram",
            "Context Map Dependencies",
            with_classes(
                """
flowchart LR
  Identity["Identity Context"]:::service
  Mobility["Mobility Core Context"]:::service
  Finance["Finance Context"]:::service
  Support["Support Context"]:::service
  AI["AI Context"]:::ai

  Identity -- customer identity --> Mobility
  Mobility -- ride completed --> Finance
  Finance -- payment / wallet events --> Mobility
  Mobility -- notify state changes --> Support
  Finance -- notify payment state --> Support
  Mobility -- feature request --> AI
  AI -- ETA / acceptance signal --> Mobility
"""
            ),
        ),
        Diagram(
            "02_analysis_design",
            "05_ddd",
            "24_domain_model_identity_context.mmd",
            "Domain Model Diagram",
            "Domain Model Identity Context",
            """
classDiagram
  class User {
    +String id
    +String phone
    +UserRole role
    +UserStatus status
    +verifyOtp()
    +changePassword()
  }
  class RefreshToken {
    +String tokenId
    +DateTime expiresAt
    +revoke()
  }
  class OtpRecord {
    +String phone
    +String otpHash
    +Int attempts
    +Boolean verified
  }
  class AuditLog {
    +String action
    +Boolean success
    +Json metadata
  }
  User "1" --> "*" RefreshToken
  User "1" --> "*" AuditLog
  OtpRecord ..> User : verifies phone
""",
        ),
        Diagram(
            "02_analysis_design",
            "05_ddd",
            "25_domain_model_mobility_context.mmd",
            "Domain Model Diagram",
            "Domain Model Mobility Context",
            """
classDiagram
  class Booking {
    +String id
    +String customerId
    +Location pickup
    +Location dropoff
    +BookingStatus status
    +confirm()
    +cancel()
  }
  class Ride {
    +String id
    +RideStatus status
    +String driverId
    +Float fare
    +assignDriver()
    +complete()
  }
  class Driver {
    +String id
    +DriverStatus status
    +AvailabilityStatus availability
    +goOnline()
    +acceptRide()
  }
  class Location {
    +Float lat
    +Float lng
    +String address
  }
  Booking "1" --> "1" Ride : becomes
  Ride "*" --> "1" Driver : assigned to
  Booking --> Location
  Ride --> Location
""",
        ),
        Diagram(
            "02_analysis_design",
            "05_ddd",
            "26_domain_model_finance_context.mmd",
            "Domain Model Diagram",
            "Domain Model Finance Context",
            """
classDiagram
  class Payment {
    +String id
    +String rideId
    +Float amount
    +PaymentStatus status
    +complete()
    +refund()
  }
  class Wallet {
    +String driverId
    +Float availableBalance
    +Float pendingBalance
    +holdEarning()
    +withdraw()
  }
  class WalletTransaction {
    +String id
    +TransactionType type
    +Float amount
    +String idempotencyKey
  }
  class Voucher {
    +String code
    +DiscountType discountType
    +Float discountValue
  }
  Payment "0..1" --> "1" Voucher : applies
  Wallet "1" --> "*" WalletTransaction
  Payment ..> Wallet : creates earning
""",
        ),
        Diagram(
            "02_analysis_design",
            "05_ddd",
            "27_domain_model_support_context.mmd",
            "Domain Model Diagram",
            "Domain Model Support Context",
            """
classDiagram
  class Notification {
    +String userId
    +NotificationType type
    +NotificationStatus status
    +NotificationPriority priority
    +send()
  }
  class Review {
    +String rideId
    +String reviewerId
    +String revieweeId
    +Int rating
    +submit()
  }
  class PendingAutoRating {
    +String rideId
    +DateTime scheduledAt
    +Boolean processed
  }
  Review ..> PendingAutoRating : may be generated by
  Notification ..> Review : prompts after ride
""",
        ),
        Diagram(
            "02_analysis_design",
            "05_ddd",
            "28_booking_aggregate.mmd",
            "Aggregate Diagram",
            "Booking Aggregate",
            with_classes(
                """
flowchart TB
  Root["Booking Aggregate Root<br/>Booking"]:::service
  Status["BookingStatus<br/>PENDING, CONFIRMED, CANCELLED, EXPIRED"]:::pattern
  Route["Route Value Object<br/>pickup, dropoff"]:::data
  Quote["Quote Value Object<br/>fare, distance, duration, surge"]:::data
  Event1["BookingCreated"]:::infra
  Event2["BookingConfirmed"]:::infra

  Root --> Status
  Root --> Route
  Root --> Quote
  Root --> Event1
  Root --> Event2
"""
            ),
        ),
        Diagram(
            "02_analysis_design",
            "05_ddd",
            "29_driver_aggregate.mmd",
            "Aggregate Diagram",
            "Driver Aggregate",
            with_classes(
                """
flowchart TB
  Root["Driver Aggregate Root<br/>Driver"]:::service
  Vehicle["Vehicle Value Object<br/>type, brand, plate"]:::data
  License["License Value Object<br/>class, number, expiry"]:::data
  Availability["Availability State<br/>OFFLINE, ONLINE, BUSY"]:::pattern
  Rating["Rating Summary<br/>average, count"]:::data
  Event1["DriverApproved"]:::infra
  Event2["DriverLocationUpdated"]:::infra

  Root --> Vehicle
  Root --> License
  Root --> Availability
  Root --> Rating
  Root --> Event1
  Root --> Event2
"""
            ),
        ),
        Diagram(
            "02_analysis_design",
            "05_ddd",
            "30_payment_aggregate.mmd",
            "Aggregate Diagram",
            "Payment Aggregate",
            with_classes(
                """
flowchart TB
  Root["Payment Aggregate Root<br/>Payment"]:::service
  Fare["Fare<br/>base, distance, time, surge"]:::data
  Voucher["Voucher<br/>discount and limits"]:::pattern
  Provider["Provider Transaction<br/>MoMo, VNPay, cash"]:::external
  Outbox["OutboxEvent<br/>reliable publish"]:::infra
  Event["PaymentCompleted"]:::infra

  Root --> Fare
  Root --> Voucher
  Root --> Provider
  Root --> Outbox --> Event
"""
            ),
        ),
        Diagram(
            "02_analysis_design",
            "05_ddd",
            "31_wallet_aggregate.mmd",
            "Aggregate Diagram",
            "Wallet Aggregate",
            with_classes(
                """
flowchart TB
  Root["Wallet Aggregate Root<br/>DriverWallet"]:::service
  Ledger["WalletTransaction<br/>immutable ledger"]:::data
  Pending["PendingEarning<br/>T+24h hold"]:::pattern
  Debt["DebtRecord<br/>cash commission debt"]:::risk
  Withdrawal["WithdrawalRequest"]:::external
  Merchant["MerchantLedger<br/>platform balance"]:::data
  Event["WalletBalanceChanged"]:::infra

  Root --> Ledger
  Root --> Pending
  Root --> Debt
  Root --> Withdrawal
  Root --> Merchant
  Root --> Event
"""
            ),
        ),
        Diagram(
            "02_analysis_design",
            "09_erd_per_service",
            "32_erd_auth_service.mmd",
            "Database Diagram",
            "ERD Auth Service",
            """
erDiagram
  USER ||--o{ REFRESH_TOKEN : owns
  USER ||--o{ AUDIT_LOG : records
  USER {
    string id
    string phone
    string email
    string role
    string status
  }
  REFRESH_TOKEN {
    string id
    string tokenId
    string userId
    datetime expiresAt
    datetime revokedAt
  }
  OTP_RECORD {
    string id
    string phone
    string otpHash
    int attempts
    boolean verified
  }
  AUDIT_LOG {
    string id
    string userId
    string action
    boolean success
  }
""",
        ),
        Diagram(
            "02_analysis_design",
            "09_erd_per_service",
            "33_erd_user_service.mmd",
            "Database Diagram",
            "ERD User Service",
            """
erDiagram
  USER_PROFILE {
    string id
    string userId
    string firstName
    string lastName
    string phone
    string avatar
    string status
  }
""",
        ),
        Diagram(
            "02_analysis_design",
            "09_erd_per_service",
            "34_erd_driver_service.mmd",
            "Database Diagram",
            "ERD Driver Service",
            """
erDiagram
  DRIVER {
    string id
    string userId
    string status
    string availabilityStatus
    string vehicleType
    string vehiclePlate
    string licenseClass
    string currentRideId
    float ratingAverage
  }
""",
        ),
        Diagram(
            "02_analysis_design",
            "09_erd_per_service",
            "35_erd_booking_service.mmd",
            "Database Diagram",
            "ERD Booking Service",
            """
erDiagram
  BOOKING {
    string id
    string customerId
    string pickupAddress
    string dropoffAddress
    string vehicleType
    string paymentMethod
    float estimatedFare
    string status
  }
""",
        ),
        Diagram(
            "02_analysis_design",
            "09_erd_per_service",
            "36_erd_ride_service.mmd",
            "Database Diagram",
            "ERD Ride Service",
            """
erDiagram
  RIDE ||--o{ RIDE_CHAT_MESSAGE : has
  RIDE ||--o{ RIDE_STATE_TRANSITION : records
  RIDE {
    string id
    string customerId
    string driverId
    string status
    string pickupAddress
    string dropoffAddress
    float fare
  }
  RIDE_CHAT_MESSAGE {
    string id
    string rideId
    string senderId
    string senderRole
    string message
  }
  RIDE_STATE_TRANSITION {
    string id
    string rideId
    string fromStatus
    string toStatus
    string actorType
  }
""",
        ),
        Diagram(
            "02_analysis_design",
            "09_erd_per_service",
            "37_erd_payment_service.mmd",
            "Database Diagram",
            "ERD Payment Service",
            """
erDiagram
  VOUCHER ||--o{ USER_VOUCHER : collected_as
  VOUCHER ||--o{ PAYMENT : applied_to
  PAYMENT ||--o{ DRIVER_EARNINGS : creates
  PAYMENT {
    string id
    string rideId
    string customerId
    string driverId
    float amount
    string method
    string provider
    string status
  }
  FARE {
    string id
    string rideId
    float totalFare
    float distanceKm
  }
  DRIVER_EARNINGS {
    string id
    string rideId
    string driverId
    float netEarnings
  }
  VOUCHER {
    string id
    string code
    string discountType
    float discountValue
  }
  USER_VOUCHER {
    string id
    string userId
    string voucherId
    int usedCount
  }
  OUTBOX_EVENT {
    string id
    string eventType
    string correlationId
  }
""",
        ),
        Diagram(
            "02_analysis_design",
            "09_erd_per_service",
            "38_erd_wallet_service.mmd",
            "Database Diagram",
            "ERD Wallet Service",
            """
erDiagram
  DRIVER_WALLET ||--o{ WALLET_TRANSACTION : records
  DRIVER_WALLET ||--o{ PENDING_EARNING : holds
  DRIVER_WALLET ||--o{ DEBT_RECORD : tracks
  DRIVER_WALLET ||--o{ WITHDRAWAL_REQUEST : requests
  DRIVER_WALLET ||--o{ WALLET_TOPUP_ORDER : tops_up
  DRIVER_WALLET {
    string id
    string driverId
    float availableBalance
    float pendingBalance
    float lockedBalance
    string status
  }
  WALLET_TRANSACTION {
    string id
    string driverId
    string type
    string direction
    float amount
    string idempotencyKey
  }
  PENDING_EARNING {
    string id
    string driverId
    string rideId
    float amount
    datetime settleAt
  }
  DEBT_RECORD {
    string id
    string driverId
    float remaining
    string status
  }
  WITHDRAWAL_REQUEST {
    string id
    string driverId
    float amount
    string status
  }
  MERCHANT_LEDGER {
    string id
    string type
    string category
    float amount
  }
""",
        ),
        Diagram(
            "02_analysis_design",
            "09_erd_per_service",
            "39_erd_notification_service.mmd",
            "Database Diagram",
            "ERD Notification Service",
            """
erDiagram
  NOTIFICATION {
    string id
    string userId
    string type
    string status
    string priority
    string recipient
    string message
    int retryCount
  }
""",
        ),
        Diagram(
            "02_analysis_design",
            "09_erd_per_service",
            "40_erd_review_service.mmd",
            "Database Diagram",
            "ERD Review Service",
            """
erDiagram
  REVIEW {
    string id
    string rideId
    string bookingId
    string type
    string reviewerId
    string revieweeId
    int rating
    string comment
  }
  PENDING_AUTO_RATING {
    string id
    string rideId
    datetime scheduledAt
    boolean processed
  }
""",
        ),
        Diagram(
            "02_analysis_design",
            "10_event_flow",
            "41_domain_event_lifecycle.mmd",
            "Event Flow Diagram",
            "Domain Event Lifecycle",
            with_classes(
                """
flowchart LR
  Booking["BookingConfirmed"]:::infra
  RideOffer["RideOffered"]:::infra
  DriverAccepted["DriverAccepted"]:::infra
  RideStarted["RideStarted"]:::infra
  RideCompleted["RideCompleted"]:::infra
  PaymentCompleted["PaymentCompleted"]:::infra
  WalletCredited["WalletCredited"]:::infra
  Settlement["EarningSettledT24h"]:::infra
  Notified["NotificationSent"]:::external

  Booking --> RideOffer --> DriverAccepted --> RideStarted --> RideCompleted
  RideCompleted --> PaymentCompleted --> WalletCredited --> Settlement
  RideOffer --> Notified
  PaymentCompleted --> Notified
"""
            ),
        ),
        Diagram(
            "02_analysis_design",
            "10_event_flow",
            "42_event_producer_consumer_map.mmd",
            "Event Flow Diagram",
            "Event Producer Consumer Map",
            with_classes(
                """
flowchart TB
  subgraph Events["Domain Events"]
    direction LR
    E1["BookingCreated"]:::infra
    E2["RideCompleted"]:::infra
    E3["PaymentCompleted"]:::infra
    E4["WithdrawalRequested"]:::infra
    E5["DriverApproved"]:::infra
  end

  subgraph Producers["Producers"]
    direction LR
    Booking["Booking Service"]:::service
    Ride["Ride Service"]:::service
    Payment["Payment Service"]:::service
    Wallet["Wallet Service"]:::service
    Driver["Driver Service"]:::service
  end

  subgraph Consumers["Consumers"]
    direction LR
    Notify["Notification Service"]:::service
    WalletC["Wallet Service"]:::service
    RideC["Ride Service"]:::service
    Admin["Admin Dashboard"]:::user
  end

  Booking --> E1
  Ride --> E2
  Payment --> E3
  Wallet --> E4
  Driver --> E5
  E1 --> RideC
  E2 --> Payment
  E2 --> Notify
  E3 --> WalletC
  E4 --> Admin
  E5 --> Notify
"""
            ),
        ),
    ]
)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            pass
    return ImageFont.load_default()


def draw_centered(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], text: str, size: int, fill: str, bold: bool = False) -> None:
    lines = text.split("\n")
    fnt = font(size, bold)
    metrics = [draw.textbbox((0, 0), line, font=fnt) for line in lines]
    widths = [bbox[2] - bbox[0] for bbox in metrics]
    heights = [bbox[3] - bbox[1] for bbox in metrics]
    total_height = sum(heights) + max(0, len(lines) - 1) * 8
    y = box[1] + ((box[3] - box[1]) - total_height) / 2
    for line, width, height in zip(lines, widths, heights):
        x = box[0] + ((box[2] - box[0]) - width) / 2
        draw.text((x, y), line, font=fnt, fill=fill)
        y += height + 8


def wrap_label(text: str, max_chars: int = 24) -> str:
    words = text.replace("<br/>", " ").split()
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        trial = " ".join(current + [word])
        if current and len(trial) > max_chars:
            lines.append(" ".join(current))
            current = [word]
        else:
            current.append(word)
    if current:
        lines.append(" ".join(current))
    return "\n".join(lines)


def image_name(diagram: Diagram) -> str:
    stem = diagram.relative_path.stem
    parts = stem.split("_")
    if parts and parts[0].isdigit():
        parts = parts[1:]
    acronyms = {
        "ai": "AI",
        "api": "API",
        "aws": "AWS",
        "cicd": "CI/CD",
        "ddd": "DDD",
        "erd": "ERD",
        "gps": "GPS",
        "ha": "HA",
        "ipn": "IPN",
        "jwt": "JWT",
        "otp": "OTP",
        "rag": "RAG",
        "t24h": "T+24h",
        "topup": "Top-Up",
        "usecase": "Use Case",
    }
    return " ".join(acronyms.get(part.lower(), part.capitalize()) for part in parts)


def draw_caption(canvas: Image.Image, diagram: Diagram) -> None:
    draw = ImageDraw.Draw(canvas)
    caption = image_name(diagram)
    draw.line((180, CANVAS[1] - 115, CANVAS[0] - 180, CANVAS[1] - 115), fill="#e2e8f0", width=2)
    draw_centered(draw, (160, CANVAS[1] - 100, CANVAS[0] - 160, CANVAS[1] - 35), caption, 30, TEXT, True)


def arrow(draw: ImageDraw.ImageDraw, points: list[tuple[int, int]], color: str = "#64748b", width: int = 3) -> None:
    draw.line(points, fill=color, width=width, joint="curve")
    if len(points) < 2:
        return
    x1, y1 = points[-2]
    x2, y2 = points[-1]
    angle = math.atan2(y2 - y1, x2 - x1)
    length = 15
    spread = 0.48
    a = (x2 - length * math.cos(angle - spread), y2 - length * math.sin(angle - spread))
    b = (x2 - length * math.cos(angle + spread), y2 - length * math.sin(angle + spread))
    draw.polygon([(x2, y2), a, b], fill=color)


def dashed_line(draw: ImageDraw.ImageDraw, points: list[tuple[int, int]], color: str = "#475569", width: int = 2, dash: int = 12, gap: int = 8) -> None:
    for start, end in zip(points, points[1:]):
        x1, y1 = start
        x2, y2 = end
        length = math.hypot(x2 - x1, y2 - y1)
        if length == 0:
            continue
        ux = (x2 - x1) / length
        uy = (y2 - y1) / length
        pos = 0.0
        while pos < length:
            segment_end = min(pos + dash, length)
            draw.line(
                (
                    x1 + ux * pos,
                    y1 + uy * pos,
                    x1 + ux * segment_end,
                    y1 + uy * segment_end,
                ),
                fill=color,
                width=width,
            )
            pos += dash + gap


def dashed_arrow(draw: ImageDraw.ImageDraw, points: list[tuple[int, int]], color: str = "#475569", width: int = 2) -> None:
    dashed_line(draw, points, color=color, width=width)
    if len(points) < 2:
        return
    x1, y1 = points[-2]
    x2, y2 = points[-1]
    angle = math.atan2(y2 - y1, x2 - x1)
    length = 13
    spread = 0.48
    a = (x2 - length * math.cos(angle - spread), y2 - length * math.sin(angle - spread))
    b = (x2 - length * math.cos(angle + spread), y2 - length * math.sin(angle + spread))
    draw.polygon([(x2, y2), a, b], fill=color)


def draw_box(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], label: str, fill: str = "#f8fafc", outline: str = "#94a3b8", size: int = 24, bold: bool = False) -> None:
    draw.rounded_rectangle(box, radius=10, fill=fill, outline=outline, width=3)
    draw_centered(draw, box, wrap_label(label), size, TEXT, bold)


def draw_oval(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], label: str, fill: str = "#ffffff", outline: str = "#111827") -> None:
    draw.ellipse(box, fill=fill, outline=outline, width=3)
    draw_centered(draw, box, wrap_label(label, 22), 22, TEXT)


def draw_diamond(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], label: str, fill: str = "#fef3c7", outline: str = "#f59e0b") -> None:
    x1, y1, x2, y2 = box
    points = [((x1 + x2) // 2, y1), (x2, (y1 + y2) // 2), ((x1 + x2) // 2, y2), (x1, (y1 + y2) // 2)]
    draw.polygon(points, fill=fill, outline=outline)
    draw.line(points + [points[0]], fill=outline, width=3)
    draw_centered(draw, box, wrap_label(label, 18), 20, TEXT, True)


def draw_actor(draw: ImageDraw.ImageDraw, center_x: int, top_y: int, label: str, color: str = "#111827") -> None:
    head = (center_x - 32, top_y, center_x + 32, top_y + 64)
    draw.ellipse(head, outline=color, width=4, fill="#ffffff")
    body_top = top_y + 72
    body_bottom = top_y + 180
    draw.line((center_x, body_top, center_x, body_bottom), fill=color, width=4)
    draw.line((center_x - 70, top_y + 112, center_x + 70, top_y + 112), fill=color, width=4)
    draw.line((center_x, body_bottom, center_x - 68, top_y + 260), fill=color, width=4)
    draw.line((center_x, body_bottom, center_x + 68, top_y + 260), fill=color, width=4)
    draw_centered(draw, (center_x - 150, top_y + 280, center_x + 150, top_y + 330), label, 26, TEXT, True)


def custom_usecase_roles(path: Path, diagram: Diagram) -> None:
    canvas = Image.new("RGBA", CANVAS, (255, 255, 255, 255))
    draw = ImageDraw.Draw(canvas)
    boundary = (170, 70, 2200, 1405)
    draw.rectangle(boundary, fill="#7fd3ef", outline="#111827", width=3)
    draw_centered(draw, (boundary[0], boundary[1] + 3, boundary[2], boundary[1] + 35), "cab_booking", 18, TEXT)

    # Actor guide boxes, matching the classic UML sketch style from the sample.
    draw.rectangle((60, 120, 2275, 860), outline="#111827", width=2)
    draw.rectangle((60, 860, 2275, 1350), outline="#111827", width=2)
    draw_actor(draw, 50, 250, "Customer")
    draw_actor(draw, 2295, 420, "Driver")
    draw_actor(draw, 50, 1000, "Admin")

    usecases: dict[str, tuple[int, int, int, int]] = {}

    def oval(key: str, box: tuple[int, int, int, int], label: str, extension: bool = False) -> None:
        usecases[key] = box
        draw.ellipse(box, fill="#7fd3ef", outline="#111827", width=2)
        if extension:
            draw_centered(draw, (box[0] + 8, box[1] + 10, box[2] - 8, box[1] + 44), label, 15, TEXT)
            draw_centered(draw, (box[0] + 8, box[3] - 37, box[2] - 8, box[3] - 9), "extension points", 13, TEXT, True)
        else:
            draw_centered(draw, (box[0] + 8, box[1] + 7, box[2] - 8, box[3] - 7), label, 15, TEXT)

    oval("choose_vehicle", (250, 245, 535, 330), "Select vehicle\nand estimate fare")
    oval("destination", (570, 205, 760, 275), "Enter destination")
    oval("book", (355, 430, 775, 515), "Book ride", True)
    oval("track", (720, 300, 950, 385), "Track driver\nin real time")
    oval("cancel_customer", (840, 555, 1010, 625), "Cancel ride")
    oval("pay", (815, 680, 1035, 765), "Pay ride")
    oval("rate", (450, 735, 655, 805), "Rate driver")
    oval("report", (225, 655, 455, 725), "Report ride")

    oval("profile", (1030, 120, 1245, 185), "Manage profile")
    oval("register", (860, 955, 1040, 1025), "Register")
    oval("login", (1115, 430, 1405, 530), "Login")

    oval("status", (1590, 245, 1830, 315), "Manage status")
    oval("requests", (1655, 395, 1975, 485), "View ride request list")
    oval("accept", (1755, 625, 1980, 710), "Accept ride\nrequest")
    oval("customer_location", (1490, 570, 1685, 635), "View customer\nlocation")
    oval("income", (1340, 650, 1590, 735), "View trip income")
    oval("complete", (1220, 775, 1510, 860), "Mark ride\ncompleted")
    oval("navigate", (1320, 875, 1570, 965), "Navigate to\npickup point")
    oval("manage_ride", (1710, 775, 2075, 860), "Manage ride", True)
    oval("driver_cancel", (1570, 965, 1735, 1035), "Cancel ride")
    oval("gps", (1790, 1065, 1985, 1135), "Update GPS")
    oval("wallet", (1810, 1165, 2075, 1265), "Manage wallet", True)
    oval("balance", (1535, 1280, 1710, 1345), "View balance")
    oval("history", (1835, 1290, 2070, 1355), "View income history")

    oval("users", (250, 1140, 490, 1225), "Manage user\naccounts")
    oval("approve_driver", (380, 1240, 605, 1310), "Approve driver\ndocuments")
    oval("process_report", (445, 1060, 620, 1130), "Process reports")
    oval("stats", (230, 1310, 405, 1370), "View statistics")

    def left(key: str) -> tuple[int, int]:
        x1, y1, _, y2 = usecases[key]
        return (x1, (y1 + y2) // 2)

    def right(key: str) -> tuple[int, int]:
        _, y1, x2, y2 = usecases[key]
        return (x2, (y1 + y2) // 2)

    def top(key: str) -> tuple[int, int]:
        x1, y1, x2, _ = usecases[key]
        return ((x1 + x2) // 2, y1)

    def bottom(key: str) -> tuple[int, int]:
        x1, _, x2, y2 = usecases[key]
        return ((x1 + x2) // 2, y2)

    def center(key: str) -> tuple[int, int]:
        x1, y1, x2, y2 = usecases[key]
        return ((x1 + x2) // 2, (y1 + y2) // 2)

    def solid(points: list[tuple[int, int]]) -> None:
        draw.line(points, fill="#111827", width=2)

    # Actor associations.
    customer = (120, 430)
    solid([customer, left("book")])
    solid([customer, left("choose_vehicle")])
    solid([customer, left("report")])
    solid([customer, left("rate")])

    driver = (2210, 570)
    solid([driver, right("status")])
    solid([driver, right("requests")])
    solid([driver, right("accept")])
    solid([driver, right("manage_ride")])
    solid([driver, right("wallet")])

    admin = (120, 1185)
    solid([admin, left("users")])
    solid([admin, left("approve_driver")])
    solid([admin, left("process_report")])
    solid([admin, left("stats")])

    def relation(points: list[tuple[int, int]], label: str, at: tuple[int, int]) -> None:
        dashed_arrow(draw, points, color="#111827", width=2)
        draw_centered(draw, (at[0] - 80, at[1] - 16, at[0] + 80, at[1] + 16), label, 13, TEXT, True)

    relation([top("book"), bottom("choose_vehicle")], "<<include>>", (400, 365))
    relation([top("book"), bottom("destination")], "<<include>>", (585, 350))
    relation([right("book"), left("login")], "<<include>>", (970, 455))
    relation([bottom("track"), top("book")], "<<extend>>", (735, 435))
    relation([right("book"), left("pay")], "<<include>>", (880, 620))
    relation([top("rate"), bottom("book")], "<<extend>>", (575, 670))
    relation([top("report"), left("book")], "<<extend>>", (260, 575))
    relation([top("profile"), top("login")], "<<include>>", (1150, 275))
    relation([right("register"), left("login")], "<<include>>", (1075, 970))
    relation([left("status"), top("login")], "<<include>>", (1465, 350))
    relation([left("requests"), right("login")], "<<include>>", (1545, 445))
    relation([top("complete"), left("manage_ride")], "<<extend>>", (1585, 770))
    relation([right("income"), left("manage_ride")], "<<extend>>", (1645, 705))
    relation([right("navigate"), left("manage_ride")], "<<extend>>", (1605, 905))
    relation([right("driver_cancel"), left("manage_ride")], "<<extend>>", (1690, 965))
    relation([top("gps"), bottom("manage_ride")], "<<extend>>", (1830, 1000))
    relation([top("balance"), bottom("wallet")], "<<extend>>", (1705, 1225))
    relation([top("history"), bottom("wallet")], "<<extend>>", (1970, 1225))
    relation([right("users"), left("login")], "<<include>>", (1040, 1160))
    relation([right("approve_driver"), left("login")], "<<include>>", (1050, 1265))
    relation([right("process_report"), left("login")], "<<include>>", (1040, 1085))
    draw_caption(canvas, diagram)
    canvas.convert("RGB").save(path, "PNG", optimize=True)


ACTIVITY_BLUEPRINTS = {
    "02_customer_booking_activity.mmd": {
        "lanes": ("Customer", "System"),
        "nodes": [
            (0, "start", "Start"),
            (0, "rect", "Select pickup and destination"),
            (1, "rect", "Calculate fare and ETA"),
            (0, "diamond", "Accept quote?"),
            (1, "rect", "Create booking request"),
            (1, "rect", "Dispatch nearby drivers"),
            (1, "diamond", "Driver accepts?"),
            (0, "rect", "Track ride"),
            (0, "rect", "Pay and review"),
            (1, "end", "End"),
        ],
    },
    "03_driver_onboarding_activity.mmd": {
        "lanes": ("Driver", "Admin and System"),
        "nodes": [
            (0, "start", "Start"),
            (0, "rect", "Create driver account"),
            (0, "rect", "Verify OTP"),
            (0, "rect", "Upload documents"),
            (1, "diamond", "Documents complete?"),
            (1, "rect", "Review application"),
            (1, "diamond", "Approved?"),
            (1, "rect", "Activate driver and wallet"),
            (1, "end", "End"),
        ],
    },
    "04_payment_wallet_activity.mmd": {
        "lanes": ("Payment", "Wallet"),
        "nodes": [
            (0, "start", "Ride completed"),
            (0, "diamond", "Payment method?"),
            (0, "rect", "Capture payment"),
            (0, "diamond", "Valid and idempotent?"),
            (1, "rect", "Write immutable ledger"),
            (1, "rect", "Hold earning T+24h"),
            (1, "rect", "Release or withdraw"),
            (1, "end", "End"),
        ],
    },
    "05_admin_operations_activity.mmd": {
        "lanes": ("Admin", "Platform"),
        "nodes": [
            (0, "start", "Start"),
            (0, "rect", "Admin login"),
            (0, "diamond", "Select task"),
            (0, "rect", "Approve driver / withdrawal"),
            (1, "rect", "Update service state"),
            (1, "rect", "Write audit log"),
            (1, "rect", "Notify result"),
            (1, "end", "End"),
        ],
    },
    "06_voucher_review_activity.mmd": {
        "lanes": ("Customer", "System"),
        "nodes": [
            (0, "start", "Start"),
            (0, "rect", "Select voucher"),
            (1, "diamond", "Eligible?"),
            (1, "rect", "Apply discount"),
            (1, "rect", "Complete ride"),
            (0, "rect", "Submit review"),
            (1, "end", "End"),
        ],
    },
}


ADDITIONAL_ACTIVITY_BLUEPRINTS = {
    "07_fare_estimation_activity.mmd": {
        "lanes": ("Customer", "Pricing System"),
        "nodes": [
            (0, "start", "Start"),
            (0, "rect", "Enter pickup and destination"),
            (1, "rect", "Validate route"),
            (1, "rect", "Calculate distance and duration"),
            (1, "diamond", "Surge or promotion?"),
            (1, "rect", "Apply pricing rules"),
            (0, "rect", "View fare and ETA"),
            (0, "end", "End"),
        ],
    },
    "08_driver_matching_activity.mmd": {
        "lanes": ("Booking Service", "Driver Service"),
        "nodes": [
            (0, "start", "Booking created"),
            (0, "rect", "Build ride offer"),
            (1, "rect", "Find nearby online drivers"),
            (1, "rect", "Rank by distance and status"),
            (0, "diamond", "Candidate found?"),
            (0, "rect", "Send ride offer"),
            (1, "rect", "Driver accepts or rejects"),
            (0, "rect", "Assign driver"),
            (0, "end", "End"),
        ],
    },
    "09_driver_acceptance_activity.mmd": {
        "lanes": ("Driver", "Ride System"),
        "nodes": [
            (0, "start", "Start"),
            (0, "rect", "Go online"),
            (1, "rect", "Push ride request"),
            (0, "diamond", "Accept request?"),
            (1, "rect", "Lock ride assignment"),
            (1, "rect", "Notify customer"),
            (0, "rect", "Navigate to pickup"),
            (0, "end", "End"),
        ],
    },
    "10_ride_lifecycle_activity.mmd": {
        "lanes": ("Driver", "Ride System"),
        "nodes": [
            (0, "start", "Driver assigned"),
            (0, "rect", "Move to pickup"),
            (1, "rect", "Broadcast arriving state"),
            (0, "rect", "Start trip"),
            (1, "rect", "Track route and GPS"),
            (0, "rect", "Complete trip"),
            (1, "rect", "Close ride"),
            (1, "end", "End"),
        ],
    },
    "11_realtime_tracking_activity.mmd": {
        "lanes": ("Driver App", "Realtime System"),
        "nodes": [
            (0, "start", "Ride active"),
            (0, "rect", "Send GPS update"),
            (1, "rect", "Store latest location"),
            (1, "rect", "Emit Socket.IO event"),
            (1, "diamond", "Ride still active?"),
            (0, "rect", "Continue sending GPS"),
            (1, "rect", "Stop tracking"),
            (1, "end", "End"),
        ],
    },
    "12_customer_cancellation_activity.mmd": {
        "lanes": ("Customer", "Booking System"),
        "nodes": [
            (0, "start", "Start"),
            (0, "rect", "Request cancellation"),
            (1, "diamond", "Ride cancellable?"),
            (1, "rect", "Calculate fee or refund"),
            (1, "rect", "Update ride status"),
            (1, "rect", "Notify driver"),
            (0, "rect", "Show cancellation result"),
            (0, "end", "End"),
        ],
    },
    "13_online_payment_activity.mmd": {
        "lanes": ("Customer", "Payment System"),
        "nodes": [
            (0, "start", "Start"),
            (0, "rect", "Choose MoMo or VNPay"),
            (1, "rect", "Create checkout session"),
            (0, "rect", "Pay at provider"),
            (1, "rect", "Verify IPN signature"),
            (1, "diamond", "Payment valid?"),
            (1, "rect", "Mark payment completed"),
            (1, "end", "End"),
        ],
    },
    "14_driver_wallet_topup_activity.mmd": {
        "lanes": ("Driver", "Wallet System"),
        "nodes": [
            (0, "start", "Start"),
            (0, "rect", "Request top-up"),
            (1, "rect", "Create payment order"),
            (1, "rect", "Receive provider callback"),
            (1, "diamond", "Callback valid?"),
            (1, "rect", "Credit wallet ledger"),
            (0, "rect", "View updated balance"),
            (0, "end", "End"),
        ],
    },
    "15_driver_withdrawal_activity.mmd": {
        "lanes": ("Driver", "Admin and Wallet"),
        "nodes": [
            (0, "start", "Start"),
            (0, "rect", "Request withdrawal"),
            (1, "rect", "Check balance and hold period"),
            (1, "rect", "Create approval task"),
            (1, "diamond", "Admin approves?"),
            (1, "rect", "Debit wallet ledger"),
            (0, "rect", "Receive withdrawal result"),
            (0, "end", "End"),
        ],
    },
    "16_complaint_handling_activity.mmd": {
        "lanes": ("User", "Admin Support"),
        "nodes": [
            (0, "start", "Start"),
            (0, "rect", "Submit report or complaint"),
            (1, "rect", "Classify complaint"),
            (1, "rect", "Review ride and payment evidence"),
            (1, "diamond", "Action required?"),
            (1, "rect", "Resolve complaint"),
            (0, "rect", "Receive support response"),
            (0, "end", "End"),
        ],
    },
    "17_notification_activity.mmd": {
        "lanes": ("Domain Service", "Notification Service"),
        "nodes": [
            (0, "start", "Domain event occurred"),
            (0, "rect", "Publish event"),
            (1, "rect", "Load notification template"),
            (1, "rect", "Choose channel"),
            (1, "rect", "Send push or socket event"),
            (1, "diamond", "Delivered?"),
            (1, "rect", "Record delivery status"),
            (1, "end", "End"),
        ],
    },
    "18_ai_support_activity.mmd": {
        "lanes": ("User", "AI Support"),
        "nodes": [
            (0, "start", "Start"),
            (0, "rect", "Ask support question"),
            (1, "rect", "Retrieve policy and ride context"),
            (1, "rect", "Generate answer"),
            (1, "diamond", "Confident answer?"),
            (1, "rect", "Escalate to admin if needed"),
            (0, "rect", "Receive answer"),
            (0, "end", "End"),
        ],
    },
}


def activity_mermaid_source(title: str, lanes: tuple[str, str], nodes: list[tuple[int, str, str]]) -> str:
    class_for_kind = {
        "start": "user",
        "end": "ok",
        "diamond": "infra",
        "rect": "service",
    }
    lines = ["flowchart LR"]
    for lane_index, lane_name in enumerate(lanes):
        node_ids = [f"N{i}" for i, node in enumerate(nodes) if node[0] == lane_index]
        lines.append(f'  subgraph L{lane_index}["{lane_name}"]')
        lines.append("    direction TB")
        for node_id in node_ids:
            idx = int(node_id[1:])
            _, kind, label = nodes[idx]
            css = class_for_kind.get(kind, "service")
            if kind in {"start", "end"}:
                lines.append(f'    {node_id}(["{label}"]):::{css}')
            elif kind == "diamond":
                lines.append(f'    {node_id}{{"{label}"}}:::{css}')
            else:
                lines.append(f'    {node_id}["{label}"]:::{css}')
        lines.append("  end")
    for idx in range(len(nodes) - 1):
        lines.append(f"  N{idx} --> N{idx + 1}")
    return with_classes("\n".join(lines))


ACTIVITY_BLUEPRINTS.update(ADDITIONAL_ACTIVITY_BLUEPRINTS)


def activity_title_from_filename(filename: str) -> str:
    stem = Path(filename).stem
    parts = stem.split("_")
    if parts and parts[0].isdigit():
        parts = parts[1:]
    acronyms = {"ai": "AI", "gps": "GPS", "ipn": "IPN"}
    return " ".join(acronyms.get(part.lower(), part.capitalize()) for part in parts)


for activity_filename, activity_blueprint in ADDITIONAL_ACTIVITY_BLUEPRINTS.items():
    DIAGRAMS.append(
        Diagram(
            "02_analysis_design",
            "02_activity",
            activity_filename,
            "Activity Diagram",
            activity_title_from_filename(activity_filename),
            activity_mermaid_source(activity_filename, activity_blueprint["lanes"], activity_blueprint["nodes"]),
        )
    )


def custom_activity(path: Path, diagram: Diagram) -> None:
    blueprint = ACTIVITY_BLUEPRINTS[diagram.filename]
    canvas = Image.new("RGBA", CANVAS, (255, 255, 255, 255))
    draw = ImageDraw.Draw(canvas)
    lane_boxes = [(230, 145, 1130, 1290), (1270, 145, 2170, 1290)]
    for idx, box in enumerate(lane_boxes):
        draw.rounded_rectangle(box, radius=8, fill="#ffffff", outline="#111827", width=3)
        draw.rectangle((box[0], box[1], box[2], box[1] + 70), fill="#f8fafc", outline="#111827", width=2)
        draw_centered(draw, (box[0], box[1] + 8, box[2], box[1] + 64), blueprint["lanes"][idx], 25, TEXT, True)

    nodes = blueprint["nodes"]
    y_start = 265
    step = min(112, (1200 - y_start) // max(1, len(nodes) - 1))
    centers: list[tuple[int, int, str, str]] = []
    for i, (lane, kind, label) in enumerate(nodes):
        x1, _, x2, _ = lane_boxes[lane]
        cx = (x1 + x2) // 2
        cy = y_start + i * step
        centers.append((cx, cy, kind, label))
        if kind in {"start", "end"}:
            radius = 38
            draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill="#ffffff", outline="#111827", width=3)
            draw_centered(draw, (cx - 76, cy - 28, cx + 76, cy + 28), label, 17, TEXT, True)
        elif kind == "diamond":
            draw_diamond(draw, (cx - 175, cy - 58, cx + 175, cy + 58), label, fill="#ffffff", outline="#111827")
        else:
            draw_box(draw, (cx - 240, cy - 43, cx + 240, cy + 43), label, fill="#ffffff", outline="#111827", size=20)

    def vertical_gap(kind: str) -> int:
        if kind == "diamond":
            return 62
        if kind in {"start", "end"}:
            return 42
        return 48

    for i in range(len(centers) - 1):
        x1, y1, kind1, _ = centers[i]
        x2, y2, kind2, _ = centers[i + 1]
        start = (x1, y1 + vertical_gap(kind1))
        end = (x2, y2 - vertical_gap(kind2))
        if x1 == x2:
            points = [start, end]
        else:
            mid_y = start[1] + max(24, (end[1] - start[1]) // 2)
            points = [start, (x1, mid_y), (x2, mid_y), end]
        arrow(draw, points, color="#111827", width=3)

    draw_caption(canvas, diagram)
    canvas.convert("RGB").save(path, "PNG", optimize=True)


def custom_bounded_context_map(path: Path, diagram: Diagram) -> None:
    canvas = Image.new("RGBA", CANVAS, (255, 255, 255, 255))
    draw = ImageDraw.Draw(canvas)

    def context(box: tuple[int, int, int, int], title: str, services: list[tuple[str, str]]) -> dict[str, tuple[int, int, int, int]]:
        x1, y1, x2, y2 = box
        draw.rounded_rectangle(box, radius=10, fill="#ffffff", outline="#111827", width=3)
        draw.rectangle((x1, y1, x2, y1 + 58), fill="#f8fafc", outline="#111827", width=2)
        draw_centered(draw, (x1, y1 + 8, x2, y1 + 52), title, 23, TEXT, True)
        service_boxes: dict[str, tuple[int, int, int, int]] = {}
        cols = 2 if len(services) > 2 else 1
        cell_w = (x2 - x1 - 70) // cols
        for idx, (key, label) in enumerate(services):
            col = idx % cols
            row = idx // cols
            sx1 = x1 + 35 + col * cell_w
            sy1 = y1 + 95 + row * 105
            sx2 = sx1 + cell_w - 25
            sy2 = sy1 + 74
            draw_box(draw, (sx1, sy1, sx2, sy2), label, fill="#ffffff", outline="#334155", size=19, bold=False)
            service_boxes[key] = (sx1, sy1, sx2, sy2)
        return service_boxes

    identity = context(
        (130, 190, 645, 600),
        "Identity Context",
        [("auth", "Auth Service\nOTP, token"), ("user", "User Service\nprofile")],
    )
    mobility = context(
        (790, 145, 1585, 650),
        "Mobility Core Context",
        [
            ("booking", "Booking\nquote, request"),
            ("ride", "Ride\nlifecycle, chat"),
            ("driver", "Driver\nvehicle, location"),
            ("pricing", "Pricing\nfare, ETA"),
        ],
    )
    finance = context(
        (790, 825, 1585, 1215),
        "Finance Context",
        [("payment", "Payment\nprovider IPN"), ("wallet", "Wallet\nledger, T+24h")],
    )
    support = context(
        (1730, 300, 2265, 900),
        "Support and AI Context",
        [
            ("notification", "Notification"),
            ("review", "Review"),
            ("ai", "AI\nprediction, RAG"),
        ],
    )

    def label(text: str, center: tuple[int, int]) -> None:
        x, y = center
        draw.rounded_rectangle((x - 118, y - 18, x + 118, y + 18), radius=5, fill="#ffffff", outline="#e2e8f0", width=1)
        draw_centered(draw, (x - 115, y - 17, x + 115, y + 17), text, 14, "#334155", True)

    def labelled_arrow(points: list[tuple[int, int]], text: str, label_center: tuple[int, int]) -> None:
        arrow(draw, points, color="#334155", width=3)
        label(text, label_center)

    labelled_arrow([(645, 395), (790, 395)], "identity data", (718, 365))
    labelled_arrow([(1188, 650), (1188, 825)], "ride completed", (1295, 735))
    labelled_arrow([(960, 825), (705, 825), (705, 610), (790, 610)], "payment status", (705, 720))
    labelled_arrow([(1585, 390), (1730, 390)], "notify users", (1658, 360))
    labelled_arrow([(1585, 520), (1660, 520), (1660, 710), (1730, 710)], "AI request", (1660, 610))
    labelled_arrow([(1730, 790), (1640, 790), (1640, 580), (1585, 580)], "AI signal", (1640, 690))
    labelled_arrow([(1585, 1035), (1680, 1035), (1680, 800), (1730, 800)], "finance event", (1680, 920))

    draw_caption(canvas, diagram)
    canvas.convert("RGB").save(path, "PNG", optimize=True)


def custom_usecase_roles(output: Path, diagram: Diagram) -> None:
    """Draw a PlantUML-like use case diagram matching the provided reference."""
    width, height = 2400, 1600
    caption_h = 125
    img = Image.new("RGB", (width, height), WHITE)
    draw = ImageDraw.Draw(img)

    title_font = FONT_PATH and ImageFont.truetype(FONT_PATH, 14) or ImageFont.load_default()
    text_font = FONT_PATH and ImageFont.truetype(FONT_PATH, 24) or ImageFont.load_default()
    small_font = FONT_PATH and ImageFont.truetype(FONT_PATH, 21) or ImageFont.load_default()
    label_font = FONT_PATH and ImageFont.truetype(FONT_PATH, 20) or ImageFont.load_default()

    system = (260, 65, 2140, 1375)
    guide_top = (80, 115, 2265, 865)
    guide_bottom = (80, 865, 2265, 1345)

    draw.rectangle(system, fill="#7ecff0", outline=INK, width=2)
    tw = draw.textbbox((0, 0), "cab_booking", font=title_font)
    draw.text(((system[0] + system[2]) / 2 - (tw[2] - tw[0]) / 2, system[1] + 7), "cab_booking", fill=INK, font=title_font)
    draw.rectangle(guide_top, outline=INK, width=2)
    draw.rectangle(guide_bottom, outline=INK, width=2)

    def oval(cx: int, cy: int, w: int, h: int, label: str, ext: bool = False) -> tuple[int, int, int, int]:
        box = (cx - w // 2, cy - h // 2, cx + w // 2, cy + h // 2)
        draw.ellipse(box, fill="#7ecff0", outline=INK, width=2)
        lines = wrap_label(label, 22)
        total = len(lines) * 25 + (19 if ext else 0)
        y = cy - total / 2
        for line in lines:
            bbox = draw.textbbox((0, 0), line, font=text_font)
            draw.text((cx - (bbox[2] - bbox[0]) / 2, y), line, fill=INK, font=text_font)
            y += 25
        if ext:
            bbox = draw.textbbox((0, 0), "extension points", font=label_font)
            draw.text((cx - (bbox[2] - bbox[0]) / 2, y + 2), "extension points", fill=INK, font=label_font)
        return box

    def center(box: tuple[int, int, int, int]) -> tuple[int, int]:
        return ((box[0] + box[2]) // 2, (box[1] + box[3]) // 2)

    def top(box: tuple[int, int, int, int]) -> tuple[int, int]:
        return ((box[0] + box[2]) // 2, box[1])

    def bottom(box: tuple[int, int, int, int]) -> tuple[int, int]:
        return ((box[0] + box[2]) // 2, box[3])

    def left(box: tuple[int, int, int, int]) -> tuple[int, int]:
        return (box[0], (box[1] + box[3]) // 2)

    def right(box: tuple[int, int, int, int]) -> tuple[int, int]:
        return (box[2], (box[1] + box[3]) // 2)

    def assoc(points: list[tuple[int, int]]) -> None:
        for a, b in zip(points, points[1:]):
            draw.line([a, b], fill=INK, width=2)

    def relation(
        points: list[tuple[int, int]],
        label: str,
        label_at: tuple[int, int] | None = None,
        dashed: bool = True,
    ) -> None:
        if dashed:
            dashed_arrow(draw, points, INK, width=2, dash=12, gap=9)
        else:
            arrow(draw, points, INK, width=2, head=12)
        if label_at:
            bbox = draw.textbbox((0, 0), label, font=label_font)
            pad = 4
            draw.rectangle(
                (label_at[0] - pad, label_at[1] - pad, label_at[0] + bbox[2] - bbox[0] + pad, label_at[1] + bbox[3] - bbox[1] + pad),
                fill="#7ecff0",
            )
            draw.text(label_at, label, fill=INK, font=label_font)

    # Actors stay outside the system boundary, like the reference image.
    draw_actor(draw, 160, 270, "Customer", small_font, INK)
    draw_actor(draw, 160, 1010, "Admin", small_font, INK)
    draw_actor(draw, 2240, 435, "Driver", small_font, INK)

    uc: dict[str, tuple[int, int, int, int]] = {}
    uc["profile"] = oval(1080, 135, 240, 72, "Manage profile")
    uc["login"] = oval(1180, 500, 300, 112, "Login")
    uc["register"] = oval(980, 880, 195, 70, "Register")

    uc["book"] = oval(560, 475, 420, 115, "Book ride", True)
    uc["vehicle"] = oval(390, 280, 310, 92, "Select vehicle and view fare")
    uc["destination"] = oval(660, 245, 210, 72, "Enter destination")
    uc["track"] = oval(815, 330, 260, 92, "Track real-time fare")
    uc["pay"] = oval(865, 645, 235, 90, "Pay trip fare")
    uc["cancel_customer"] = oval(875, 545, 205, 72, "Cancel ride")
    uc["report"] = oval(330, 645, 235, 72, "Report trip")
    uc["rate"] = oval(555, 720, 230, 72, "Rate driver")

    uc["status"] = oval(1620, 270, 235, 72, "Manage status")
    uc["requests"] = oval(1765, 440, 300, 92, "View ride requests")
    uc["accept"] = oval(1835, 610, 270, 92, "Accept ride request")
    uc["manage_ride"] = oval(1855, 735, 365, 108, "Manage ride", True)
    uc["location"] = oval(1585, 535, 220, 72, "View customer location")
    uc["income"] = oval(1515, 655, 240, 84, "View ride income")
    uc["complete"] = oval(1380, 735, 280, 74, "Complete ride")
    uc["navigate"] = oval(1425, 850, 280, 88, "Navigate to pickup")
    uc["driver_cancel"] = oval(1620, 960, 210, 72, "Cancel ride")
    uc["gps"] = oval(1905, 960, 210, 72, "Update GPS")
    uc["wallet"] = oval(1875, 1125, 330, 105, "Manage wallet", True)
    uc["balance"] = oval(1585, 1230, 210, 72, "View balance")
    uc["history"] = oval(1885, 1245, 270, 72, "View income history")

    uc["users"] = oval(385, 1100, 270, 82, "Manage user accounts")
    uc["approve"] = oval(470, 1175, 250, 72, "Approve driver profile")
    uc["reports"] = oval(430, 1300, 230, 72, "Handle reports")
    uc["stats"] = oval(330, 1410, 210, 72, "View statistics")

    # Solid actor associations.
    assoc([(230, 400), left(uc["book"])])
    assoc([(230, 400), (320, 400), left(uc["vehicle"])])
    assoc([(230, 400), (265, 645), left(uc["report"])])
    assoc([(230, 400), (410, 705), left(uc["rate"])])

    assoc([(2170, 500), right(uc["status"])])
    assoc([(2170, 500), right(uc["requests"])])
    assoc([(2170, 500), right(uc["accept"])])
    assoc([(2170, 500), (2125, 735), right(uc["manage_ride"])])
    assoc([(2170, 500), (2140, 1125), right(uc["wallet"])])

    assoc([(230, 1100), left(uc["users"])])
    assoc([(230, 1100), left(uc["approve"])])
    assoc([(230, 1100), left(uc["reports"])])
    assoc([(230, 1100), left(uc["stats"])])

    # Include / extend relationships are routed locally to keep the picture readable.
    relation([top(uc["book"]), bottom(uc["vehicle"])], "<<Include>>", (320, 385))
    relation([top(uc["book"]), bottom(uc["destination"])], "<<Include>>", (600, 350))
    relation([right(uc["book"]), left(uc["login"])], "<<Include>>", (840, 500))
    relation([right(uc["book"]), left(uc["pay"])], "<<Include>>", (650, 600))
    relation([bottom(uc["track"]), (785, 410), (655, 410), top(uc["book"])], "<<Extend>>", (705, 435))
    relation([right(uc["cancel_customer"]), (1015, 575), (1015, 515), right(uc["book"])], "<<Extend>>", (840, 555))
    relation([top(uc["report"]), (330, 560), left(uc["book"])], "<<Extend>>", (235, 545))
    relation([top(uc["rate"]), (555, 605), bottom(uc["book"])], "<<Extend>>", (470, 615))

    relation([bottom(uc["profile"]), (1080, 290), top(uc["login"])], "<<Include>>", (1025, 275))
    relation([right(uc["register"]), (1110, 880), (1110, 560), bottom(uc["login"])], "<<Include>>", (1045, 805))
    relation([bottom(uc["status"]), (1620, 365), (1320, 365), top(uc["login"])], "<<Include>>", (1475, 350))
    relation([left(uc["requests"]), (1420, 440), (1325, 500), right(uc["login"])], "<<Include>>", (1450, 425))

    relation([left(uc["manage_ride"]), right(uc["complete"])], "<<Extend>>", (1535, 725))
    relation([left(uc["manage_ride"]), right(uc["navigate"])], "<<Extend>>", (1550, 825))
    relation([top(uc["driver_cancel"]), (1660, 845), bottom(uc["manage_ride"])], "<<Extend>>", (1640, 870))
    relation([top(uc["gps"]), (1905, 835), bottom(uc["manage_ride"])], "<<Extend>>", (1830, 850))
    relation([right(uc["income"]), left(uc["manage_ride"])], "<<Extend>>", (1660, 660))
    relation([top(uc["balance"]), (1680, 1165), left(uc["wallet"])], "<<Extend>>", (1685, 1175))
    relation([top(uc["history"]), (1885, 1175), bottom(uc["wallet"])], "<<Extend>>", (1970, 1185))

    relation([right(uc["users"]), (885, 1100), (885, 575), left(uc["login"])], "<<Include>>", (860, 1070))
    relation([right(uc["approve"]), (1040, 1175), (1040, 560), bottom(uc["login"])], "<<Include>>", (1030, 1045))
    relation([right(uc["reports"]), (1180, 1300), (1180, 558), bottom(uc["login"])], "<<Include>>", (1115, 1280))
    relation([right(uc["stats"]), (1235, 1410), (1235, 558), bottom(uc["login"])], "<<Include>>", (1175, 1375))

    draw_caption(draw, width, height, caption_h, image_name(diagram.filename), font_size=36)
    output.parent.mkdir(parents=True, exist_ok=True)
    img.save(output)


def custom_activity(output: Path, diagram: Diagram) -> None:
    blueprint = ACTIVITY_BLUEPRINTS[diagram.filename]
    width, height = 2400, 1600
    caption_h = 125
    img = Image.new("RGB", (width, height), WHITE)
    draw = ImageDraw.Draw(img)

    lane_font = FONT_PATH and ImageFont.truetype(FONT_PATH, 28) or ImageFont.load_default()
    text_font = FONT_PATH and ImageFont.truetype(FONT_PATH, 24) or ImageFont.load_default()
    title_font = FONT_PATH and ImageFont.truetype(FONT_PATH, 34) or ImageFont.load_default()
    label_font = FONT_PATH and ImageFont.truetype(FONT_PATH, 20) or ImageFont.load_default()

    left_lane = (220, 145, 1165, 1390)
    right_lane = (1235, 145, 2180, 1390)
    center_gap_x = 1200
    draw.rounded_rectangle(left_lane, radius=0, fill=WHITE, outline=INK, width=2)
    draw.rounded_rectangle(right_lane, radius=0, fill=WHITE, outline=INK, width=2)
    draw.line([(1198, 145), (1198, 1390)], fill=INK, width=2)
    draw.line([(1202, 145), (1202, 1390)], fill=INK, width=2)

    for label, lane in zip(blueprint["lanes"], [left_lane, right_lane]):
        bbox = draw.textbbox((0, 0), label, font=lane_font)
        draw.text(((lane[0] + lane[2]) / 2 - (bbox[2] - bbox[0]) / 2, 103), label, fill=INK, font=lane_font)

    title = blueprint["title"]
    bbox = draw.textbbox((0, 0), title, font=title_font)
    draw.text((width / 2 - (bbox[2] - bbox[0]) / 2, 48), title, fill=INK, font=title_font)

    centers = {
        0: 690,
        1: 1710,
    }
    node_w = 405
    node_h = 82
    diamond_w = 260
    diamond_h = 122
    start_y = 240
    step_y = 150
    node_boxes: list[tuple[int, int, int, int]] = []

    def draw_activity_node(cx: int, cy: int, label: str, kind: str) -> tuple[int, int, int, int]:
        if kind == "start":
            r = 23
            draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=INK, outline=INK, width=2)
            return (cx - r, cy - r, cx + r, cy + r)
        if kind == "end":
            r = 26
            draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=WHITE, outline=INK, width=2)
            draw.ellipse((cx - 14, cy - 14, cx + 14, cy + 14), fill=INK, outline=INK, width=2)
            return (cx - r, cy - r, cx + r, cy + r)
        if kind == "decision":
            box = (cx - diamond_w // 2, cy - diamond_h // 2, cx + diamond_w // 2, cy + diamond_h // 2)
            draw.polygon([(cx, box[1]), (box[2], cy), (cx, box[3]), (box[0], cy)], fill=WHITE, outline=INK)
            draw.line([(cx, box[1]), (box[2], cy), (cx, box[3]), (box[0], cy), (cx, box[1])], fill=INK, width=2)
            lines = wrap_label(label, 18)
            y = cy - len(lines) * 13
            for line in lines:
                tb = draw.textbbox((0, 0), line, font=text_font)
                draw.text((cx - (tb[2] - tb[0]) / 2, y), line, fill=INK, font=text_font)
                y += 26
            return box
        box = (cx - node_w // 2, cy - node_h // 2, cx + node_w // 2, cy + node_h // 2)
        draw.rounded_rectangle(box, radius=12, fill=WHITE, outline=INK, width=2)
        lines = wrap_label(label, 25)
        y = cy - len(lines) * 13
        for line in lines:
            tb = draw.textbbox((0, 0), line, font=text_font)
            draw.text((cx - (tb[2] - tb[0]) / 2, y), line, fill=INK, font=text_font)
            y += 26
        return box

    for idx, node in enumerate(blueprint["nodes"]):
        x = centers[node["lane"]]
        y = start_y + idx * step_y
        node_boxes.append(draw_activity_node(x, y, node["text"], node.get("kind", "step")))

    def top_point(box: tuple[int, int, int, int]) -> tuple[int, int]:
        return ((box[0] + box[2]) // 2, box[1])

    def bottom_point(box: tuple[int, int, int, int]) -> tuple[int, int]:
        return ((box[0] + box[2]) // 2, box[3])

    def lane_of(index: int) -> int:
        return blueprint["nodes"][index]["lane"]

    def draw_path(points: list[tuple[int, int]], text: str | None = None, pos: tuple[int, int] | None = None) -> None:
        arrow(draw, points, INK, width=2, head=12)
        if text and pos:
            tb = draw.textbbox((0, 0), text, font=label_font)
            draw.rectangle((pos[0] - 4, pos[1] - 4, pos[0] + tb[2] - tb[0] + 4, pos[1] + tb[3] - tb[1] + 4), fill=WHITE)
            draw.text(pos, text, fill=INK, font=label_font)

    for idx in range(len(node_boxes) - 1):
        start = bottom_point(node_boxes[idx])
        end = top_point(node_boxes[idx + 1])
        label = None
        if blueprint["nodes"][idx].get("kind") == "decision":
            label = blueprint["nodes"][idx].get("yes", "Yes")
        if lane_of(idx) == lane_of(idx + 1):
            draw_path([start, end], label, (start[0] + 18, (start[1] + end[1]) // 2 - 12) if label else None)
        else:
            turn_y = min(end[1] - 30, start[1] + 38)
            points = [start, (start[0], turn_y), (center_gap_x, turn_y), (center_gap_x, end[1] - 18), end]
            draw_path(points, label, (center_gap_x + 18, turn_y - 12) if label else None)

    # Explicit rejection / retry branch for decisions, kept outside the main downward path.
    decision_indexes = [i for i, node in enumerate(blueprint["nodes"]) if node.get("kind") == "decision"]
    for i in decision_indexes:
        node = blueprint["nodes"][i]
        if "no_to" not in node:
            continue
        start_box = node_boxes[i]
        target_box = node_boxes[node["no_to"]]
        start = (start_box[0], (start_box[1] + start_box[3]) // 2)
        target = (target_box[0], (target_box[1] + target_box[3]) // 2)
        x = min(start_box[0], target_box[0]) - 95
        y = start[1]
        points = [start, (x, y), (x, target[1]), target]
        draw_path(points, node.get("no", "No"), (x + 12, y - 26))

    draw_caption(draw, width, height, caption_h, image_name(diagram.filename), font_size=36)
    output.parent.mkdir(parents=True, exist_ok=True)
    img.save(output)


def custom_usecase_roles(path: Path, diagram: Diagram) -> None:
    canvas = Image.new("RGBA", CANVAS, (255, 255, 255, 255))
    draw = ImageDraw.Draw(canvas)
    blue = "#7ecff0"
    ink = "#111827"

    system = (205, 55, 2195, 1380)
    draw.rectangle(system, fill=blue, outline=ink, width=3)
    draw_centered(draw, (system[0], system[1] + 4, system[2], system[1] + 34), "cab_booking", 18, TEXT, True)

    def dashed_rect(box: tuple[int, int, int, int], label: str) -> None:
        x1, y1, x2, y2 = box
        dashed_line(draw, [(x1, y1), (x2, y1), (x2, y2), (x1, y2), (x1, y1)], color="#475569", width=2, dash=9, gap=9)
        draw_centered(draw, (x1 + 20, y1 + 15, x1 + 390, y1 + 55), label, 22, TEXT, True)

    dashed_rect((260, 120, 950, 780), "Customer use cases")
    dashed_rect((985, 120, 1315, 780), "Shared core")
    dashed_rect((1350, 120, 2140, 935), "Driver use cases")
    dashed_rect((260, 970, 2140, 1330), "Admin dashboard use cases")

    draw_actor(draw, 130, 270, "Customer")
    draw_actor(draw, 130, 1110, "Admin")
    draw_actor(draw, 2280, 520, "Driver")

    usecases: dict[str, tuple[int, int, int, int]] = {}

    def oval(key: str, cx: int, cy: int, w: int, h: int, label: str, extension: bool = False) -> None:
        box = (cx - w // 2, cy - h // 2, cx + w // 2, cy + h // 2)
        usecases[key] = box
        draw.ellipse(box, fill=blue, outline=ink, width=2)
        text = wrap_label(label, 24)
        if extension:
            text = text + "\nextension points"
        draw_centered(draw, box, text, 20, TEXT, bool(extension))

    def left(box: tuple[int, int, int, int]) -> tuple[int, int]:
        return (box[0], (box[1] + box[3]) // 2)

    def right(box: tuple[int, int, int, int]) -> tuple[int, int]:
        return (box[2], (box[1] + box[3]) // 2)

    def top(box: tuple[int, int, int, int]) -> tuple[int, int]:
        return ((box[0] + box[2]) // 2, box[1])

    def bottom(box: tuple[int, int, int, int]) -> tuple[int, int]:
        return ((box[0] + box[2]) // 2, box[3])

    def assoc(points: list[tuple[int, int]]) -> None:
        draw.line(points, fill=ink, width=2, joint="curve")

    def include(points: list[tuple[int, int]], label_at: tuple[int, int]) -> None:
        dashed_arrow(draw, points, color=ink, width=2)
        draw_centered(draw, (label_at[0], label_at[1], label_at[0] + 115, label_at[1] + 28), "<<include>>", 14, TEXT, True)

    def extend(points: list[tuple[int, int]], label_at: tuple[int, int]) -> None:
        dashed_arrow(draw, points, color=ink, width=2)
        draw_centered(draw, (label_at[0], label_at[1], label_at[0] + 115, label_at[1] + 28), "<<extend>>", 14, TEXT, True)

    oval("pickup", 445, 210, 275, 75, "Enter pickup and destination")
    oval("vehicle", 730, 210, 285, 75, "Select vehicle and view fare")
    oval("book", 600, 345, 360, 95, "Book ride", True)
    oval("voucher", 420, 505, 250, 74, "Redeem voucher")
    oval("cancel_customer", 735, 505, 230, 74, "Cancel ride")
    oval("track", 430, 650, 270, 78, "Track ride realtime map")
    oval("pay", 735, 650, 275, 78, "Pay by MoMo VNPay or cash")
    oval("rate", 430, 755, 250, 70, "Rate driver")
    oval("report", 735, 755, 250, 70, "Report trip")

    oval("login", 1150, 220, 250, 76, "Login")
    oval("register", 1150, 350, 250, 76, "Register")
    oval("profile", 1150, 480, 250, 76, "Manage profile")
    oval("ai", 1150, 610, 250, 76, "Chat with AI support")
    oval("notify", 1150, 735, 250, 76, "Receive realtime notifications")

    oval("driver_register", 1545, 210, 285, 75, "Register driver and upload documents")
    oval("online", 1865, 210, 285, 75, "Turn online status on or off")
    oval("request", 1545, 350, 285, 75, "View ride requests")
    oval("accept", 1865, 350, 285, 75, "Accept or reject ride request")
    oval("manage_ride", 1710, 505, 370, 96, "Manage ride", True)
    oval("navigate", 1455, 650, 280, 74, "Navigate to pickup or dropoff")
    oval("status", 1710, 650, 265, 74, "Update ride status")
    oval("gps", 1970, 650, 230, 74, "Update GPS")
    oval("driver_cancel", 1460, 790, 230, 74, "Cancel ride")
    oval("chat", 1710, 790, 230, 74, "Chat or call customer")
    oval("wallet", 1945, 790, 255, 82, "Manage driver wallet", True)
    oval("balance", 1590, 895, 210, 66, "View balance")
    oval("withdraw", 1810, 895, 210, 66, "Withdraw money")
    oval("history", 2030, 895, 210, 66, "View income history")

    oval("users", 405, 1085, 275, 74, "Manage user accounts")
    oval("driver_approval", 705, 1085, 285, 74, "Approve or reject driver profile")
    oval("drivers", 1005, 1085, 235, 74, "Manage drivers")
    oval("rides", 1290, 1085, 250, 74, "Manage rides")
    oval("complaints", 1595, 1085, 285, 74, "Handle reports and complaints")
    oval("payments", 1920, 1085, 285, 74, "Manage payments and refunds")
    oval("admin_wallet", 555, 1235, 250, 72, "Manage merchant wallet")
    oval("stats", 855, 1235, 230, 72, "View statistics")
    oval("logs", 1155, 1235, 230, 72, "View system logs")
    oval("pricing_ai", 1470, 1235, 250, 72, "Configure pricing and AI")
    oval("admin_voucher", 1790, 1235, 230, 72, "Manage vouchers")

    assoc([(205, 360), left(usecases["book"])])
    assoc([(205, 520), left(usecases["voucher"])])
    assoc([(205, 660), left(usecases["track"])])
    assoc([(205, 760), left(usecases["rate"])])
    assoc([(2195, 505), right(usecases["manage_ride"])])
    assoc([(2195, 790), right(usecases["wallet"])])
    assoc([(2195, 350), right(usecases["accept"])])
    assoc([(205, 1090), left(usecases["users"])])
    assoc([(205, 1235), left(usecases["admin_wallet"])])

    include([top(usecases["book"]), bottom(usecases["pickup"])], (455, 270))
    include([top(usecases["book"]), bottom(usecases["vehicle"])], (680, 270))
    include([right(usecases["book"]), left(usecases["login"])], (825, 350))
    extend([right(usecases["voucher"]), left(usecases["pay"])], (540, 560))
    extend([right(usecases["cancel_customer"]), right(usecases["book"])], (780, 430))
    extend([top(usecases["track"]), bottom(usecases["book"])], (430, 560))
    extend([right(usecases["report"]), right(usecases["rate"])], (585, 720))

    include([bottom(usecases["register"]), top(usecases["profile"])], (1185, 400))
    include([bottom(usecases["driver_register"]), top(usecases["request"])], (1510, 270))
    include([bottom(usecases["request"]), top(usecases["manage_ride"])], (1555, 430))
    include([bottom(usecases["accept"]), top(usecases["manage_ride"])], (1815, 430))
    extend([right(usecases["navigate"]), left(usecases["status"])], (1560, 610))
    extend([right(usecases["status"]), left(usecases["gps"])], (1800, 610))
    extend([top(usecases["driver_cancel"]), bottom(usecases["manage_ride"])], (1500, 720))
    extend([top(usecases["chat"]), bottom(usecases["manage_ride"])], (1680, 720))
    include([top(usecases["balance"]), bottom(usecases["wallet"])], (1600, 835))
    include([top(usecases["withdraw"]), bottom(usecases["wallet"])], (1785, 845))
    include([top(usecases["history"]), bottom(usecases["wallet"])], (1940, 845))
    include([bottom(usecases["driver_approval"]), top(usecases["drivers"])], (760, 1155))
    extend([bottom(usecases["rides"]), top(usecases["complaints"])], (1375, 1155))

    draw_caption(canvas, diagram)
    canvas.convert("RGB").save(path, "PNG", optimize=True)


def custom_activity(path: Path, diagram: Diagram) -> None:
    blueprint = ACTIVITY_BLUEPRINTS[diagram.filename]
    canvas = Image.new("RGBA", CANVAS, (255, 255, 255, 255))
    draw = ImageDraw.Draw(canvas)
    ink = "#111827"
    lane_boxes = [(230, 145, 1130, 1370), (1270, 145, 2170, 1370)]

    for idx, box in enumerate(lane_boxes):
        draw.rectangle(box, fill="#ffffff", outline=ink, width=2)
        draw.line((box[0], box[1] + 70, box[2], box[1] + 70), fill=ink, width=2)
        draw_centered(draw, (box[0], box[1] + 10, box[2], box[1] + 58), blueprint["lanes"][idx], 25, TEXT, True)

    nodes = blueprint["nodes"]
    y_start = 260
    y_end = 1260
    step = min(135, max(95, (y_end - y_start) // max(1, len(nodes) - 1)))
    centers: list[tuple[int, int, str, str, tuple[int, int, int, int]]] = []

    def draw_node(cx: int, cy: int, kind: str, label: str) -> tuple[int, int, int, int]:
        if kind in {"start", "end"}:
            r = 26
            box = (cx - r, cy - r, cx + r, cy + r)
            if kind == "start":
                draw.ellipse(box, fill=ink, outline=ink, width=2)
            else:
                draw.ellipse(box, fill="#ffffff", outline=ink, width=2)
                draw.ellipse((cx - 13, cy - 13, cx + 13, cy + 13), fill=ink, outline=ink, width=2)
            draw_centered(draw, (cx - 115, cy + 34, cx + 115, cy + 72), label, 16, TEXT, True)
            return box
        if kind == "diamond":
            box = (cx - 155, cy - 58, cx + 155, cy + 58)
            points = [(cx, box[1]), (box[2], cy), (cx, box[3]), (box[0], cy)]
            draw.polygon(points, fill="#ffffff", outline=ink)
            draw.line(points + [points[0]], fill=ink, width=2)
            draw_centered(draw, box, wrap_label(label, 20), 20, TEXT, True)
            return box
        box = (cx - 240, cy - 42, cx + 240, cy + 42)
        draw.rounded_rectangle(box, radius=10, fill="#ffffff", outline=ink, width=2)
        draw_centered(draw, box, wrap_label(label, 27), 20, TEXT)
        return box

    for idx, (lane, kind, label) in enumerate(nodes):
        lane_box = lane_boxes[lane]
        cx = (lane_box[0] + lane_box[2]) // 2
        cy = y_start + idx * step
        box = draw_node(cx, cy, kind, label)
        centers.append((cx, cy, kind, label, box))

    def top_point(box: tuple[int, int, int, int]) -> tuple[int, int]:
        return ((box[0] + box[2]) // 2, box[1])

    def bottom_point(box: tuple[int, int, int, int]) -> tuple[int, int]:
        return ((box[0] + box[2]) // 2, box[3])

    for idx in range(len(centers) - 1):
        x1, _, _, _, box1 = centers[idx]
        x2, _, _, _, box2 = centers[idx + 1]
        start = bottom_point(box1)
        end = top_point(box2)
        if x1 == x2:
            points = [start, end]
        else:
            turn_y = min(end[1] - 28, start[1] + 34)
            points = [start, (start[0], turn_y), (x2, turn_y), end]
        arrow(draw, points, color=ink, width=2)

    draw_caption(canvas, diagram)
    canvas.convert("RGB").save(path, "PNG", optimize=True)


CUSTOM_RENDERERS = {
    "01_usecase_roles.mmd": custom_usecase_roles,
    "21_bounded_context_map.mmd": custom_bounded_context_map,
    **{name: custom_activity for name in ACTIVITY_BLUEPRINTS},
}


def normalize_with_caption(path: Path, diagram: Diagram) -> None:
    img = Image.open(path).convert("RGBA")
    canvas = Image.new("RGBA", CANVAS, (255, 255, 255, 255))
    max_w = CANVAS[0] - 150
    max_h = CANVAS[1] - 230
    scale = min(max_w / img.width, max_h / img.height, 1.0)
    size = (max(1, int(img.width * scale)), max(1, int(img.height * scale)))
    resized = img.resize(size, Image.Resampling.LANCZOS)
    x = (CANVAS[0] - size[0]) // 2
    y = 55 + max(0, (max_h - size[1]) // 2)
    canvas.alpha_composite(resized, (x, y))

    draw_caption(canvas, diagram)
    canvas.convert("RGB").save(path, "PNG", optimize=True)


def readme() -> str:
    lines = [
        "# FoxGo Diagram Set",
        "",
        "Generated Mermaid and PNG diagrams for the FoxGo cab booking system.",
        "The folder tree is split into two high-level categories:",
        "",
        "- `01_system_architecture`: system overview, service architecture, AI pipelines, CI/CD, AWS, Docker Swarm HA, scaling, and monitoring.",
        "- `02_analysis_design`: use cases, activity diagrams, sequence diagrams, database/event design, DDD design, state machines, and algorithms.",
        "",
        "Each diagram folder keeps the `.mmd` source and rendered `.png` together. PNG files are normalized to a white 2400x1600 canvas with a diagram-type caption at the bottom.",
        "",
        "## Render",
        "",
        "```powershell",
        "python scripts\\build-foxgo-diagram-set.py",
        "```",
        "",
        "## Diagram Index",
        "",
        "| PNG | Type | Title |",
        "|-----|------|-------|",
    ]
    for diagram in sorted(DIAGRAMS, key=lambda item: item.relative_path.as_posix()):
        png = diagram.relative_path.with_suffix(".png").as_posix()
        lines.append(f"| [{png}](./{png}) | {diagram.diagram_type} | {diagram.title} |")
    lines.append("")
    return "\n".join(lines)


def clear_generated_base() -> None:
    root = ROOT.resolve()
    base = BASE.resolve()
    expected_parent = (ROOT / "image_moi").resolve()
    if not str(base).startswith(str(expected_parent)) or base == root:
        raise RuntimeError(f"Refusing to clear unsafe path: {base}")
    if BASE.exists():
        shutil.rmtree(BASE)
    BASE.mkdir(parents=True, exist_ok=True)


def collect_preserved_activity_files() -> dict[Path, bytes]:
    preserved: dict[Path, bytes] = {}
    activity_dir = BASE / "02_analysis_design" / "02_activity"
    if not activity_dir.exists():
        return preserved
    for path in activity_dir.rglob("*"):
        if path.is_file():
            preserved[path.relative_to(BASE)] = path.read_bytes()
    return preserved


def restore_preserved_files(preserved: dict[Path, bytes]) -> None:
    for relative_path, content in preserved.items():
        path = BASE / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)


def is_activity_diagram(diagram: Diagram) -> bool:
    return diagram.group == "02_analysis_design" and diagram.folder == "02_activity"


def write_sources() -> None:
    preserved_activity = collect_preserved_activity_files()
    clear_generated_base()
    (BASE / "mermaid.config.json").write_text(json.dumps(CONFIG, indent=2), encoding="utf-8")
    (BASE / "puppeteer.config.json").write_text(json.dumps(PUPPETEER_CONFIG, indent=2), encoding="utf-8")
    for diagram in DIAGRAMS:
        path = BASE / diagram.relative_path
        if diagram.relative_path in preserved_activity:
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(diagram.source.strip() + "\n", encoding="utf-8")
    restore_preserved_files(preserved_activity)
    (BASE / "README.md").write_text(readme(), encoding="utf-8")


def render_mermaid() -> None:
    config = BASE / "mermaid.config.json"
    puppeteer_config = BASE / "puppeteer.config.json"
    executable = "npx.cmd" if sys.platform.startswith("win") else "npx"
    for diagram in DIAGRAMS:
        mmd = BASE / diagram.relative_path
        png = mmd.with_suffix(".png")
        if is_activity_diagram(diagram) and png.exists():
            print(f"keep {png.relative_to(ROOT)}")
            continue
        if diagram.filename in CUSTOM_RENDERERS:
            print(f"draw {png.relative_to(ROOT)}")
            CUSTOM_RENDERERS[diagram.filename](png, diagram)
            continue
        cmd = [
            executable,
            "mmdc",
            "-i",
            str(mmd),
            "-o",
            str(png),
            "-c",
            str(config),
            "-p",
            str(puppeteer_config),
            "--theme",
            "default",
            "--backgroundColor",
            "white",
            "--width",
            "1800",
            "--height",
            "1100",
            "--scale",
            "2",
        ]
        print(f"render {mmd.relative_to(ROOT)}")
        subprocess.run(cmd, cwd=ROOT, check=True)
        normalize_with_caption(png, diagram)


def main() -> None:
    write_sources()
    render_mermaid()
    print(f"done: {len(DIAGRAMS)} diagrams")


if __name__ == "__main__":
    main()
