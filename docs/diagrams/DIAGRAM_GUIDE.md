# Technical diagrams (Mermaid → PNG)

**Source files:** `docs/diagrams/mermaid/*.mmd`  
**Rendered images:** `img/01_*.png` … `img/20_*.png`  
**Command:** `python scripts/generate_diagrams.py` (requires Node.js and `npx`)

Design goals: layered left/right or top/down flow, short labels (Grab/Uber-style system-design clarity), minimal line crossings, split complexity across multiple diagrams when needed.

---

## 01 — System architecture (single diagram)

Aligned with **README §3.2** (`graph TB`): Frontend :4000–:4002 → API Gateway :3000 → business services (HTTP + gRPC ports as in README) → AI :8000 → PostgreSQL / MongoDB / Redis / RabbitMQ → optional **External** row (MoMo, VNPay, OSRM, Maps). **Sparse edge captions** only where README calls them out (HTTP proxy, gRPC, publish/consume, adapter).

---

## 02 — AWS deployment (infrastructure)

User → Route 53 → CloudFront → ALB (ACM) → private ECS → RDS / ElastiCache / Amazon MQ / Mongo-compatible DB; S3 · Secrets Manager · CloudWatch attached to compute.

---

## 03 — Realtime communication

| Part | Role |
|------|------|
| **Mobile clients** | Persistent WebSocket to gateway for offers and ride updates. |
| **Socket server** | Room-per-user fan-out; bridges to HTTP microservices. |
| **Services** | Ride/driver/notify consume and publish lifecycle events. |
| **Broker** | Reliable delivery of events across processes. |
| **Redis GEO** | Online drivers and spatial queries for dispatch. |

---

## 04 — Booking & payment sequence

Main path (numbered): create booking → internal quote → async matching → driver offer over WebSocket → completion event → payment and wallet split. Dashed messages are async/event-style steps.

---

## 05 — Data architecture

| Part | Role |
|------|------|
| **Per-service SQL** | Each service owns its PostgreSQL schema (no shared tables). |
| **Document DB** | Notifications and reviews in Mongo-style stores. |
| **Redis & RabbitMQ** | Cross-cutting cache, GEO, and messaging—not business source of truth. |

---

## 06 — AI / ML pipeline

Four independent tracks: (A) fare/surge from tabular features, (B) driver acceptance model, (C) wait-time regression, (D) RAG support chat. Kept as one figure but logically separate pipelines.

---

## 07 — Use case overview (summary)

Intentionally **high level**: customer, driver, and admin journeys roll up to the core platform (auth, matching, payment). For a full UML use-case explosion, add separate Mermaid files per actor later.

---

## 08 — Ride state machine

Lifecycle from requested → matching → assigned → en route → on trip → completed, with cancellation branches. Matches dispatch and ride-service semantics at a glance.

---

## 09 — Wallet state machine

Wallet account states around settlement after rides; simplified (no every edge case).

---

## 10 — Booking activity

Happy-path swimlane-style flow: quote → confirm → match → trip → complete → rate/pay.

---

## 11 — Payment branch

Decision on cash vs wallet vs gateway; IPN/callback path for MoMo/VNPay; ledger events emitted after success.

---

## 12 — Booking lanes (BPMN-lite)

Passenger, driver, and system steps synchronized for one trip—compact substitute for a full BPMN editor.

---

## 13 — RabbitMQ event flow

Producers (booking/ride/payment/wallet) → broker → dedicated consumers (notify, ledger, etc.). Keeps pub/sub topology readable.

---

## 14 — API gateway routing

Path prefix to upstream service ports; single place to document the “front door” API map.

---

## 15 — Driver matching

Primary / bold path: geo candidates → rule score → optional ML layer → WebSocket offer → accept loop.

---

## 16 — RAG chatbot

Gateway forwards to AI service; embeddings + FAISS retrieve snippets; LLM (or template) composes the answer returned to the client.

---

## 17 — Auth OTP sequence

Issue OTP, store with TTL, SMS notify, verify, issue JWT—typical login happy path.

---

## 18 — Core ERD

Aggregate relationships only (user, driver, booking, ride, payment, wallet)—not a full column-level schema.

---

## 19 — Gateway component view

Internal building blocks: HTTP stack, Socket.IO, middleware chain, proxy router, matching helper, Redis adapter.

---

## 20 — Security trust boundaries

Public clients vs edge termination vs application vs data/secrets zones; enforces mental model for threat discussion.
