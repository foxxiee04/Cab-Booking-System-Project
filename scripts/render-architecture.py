#!/usr/bin/env python3
"""Render system architecture diagram → PNG + SVG.

Layout (top → bottom):
    Row 1: Frontend
    Row 2: Gateway + AI
    Row 3: Business services (reordered: publishers near RabbitMQ on left,
                              Mongo users near MongoDB on right)
    Row 4: External APIs (left) + Data and infra (right)
"""
from pathlib import Path
from graphviz import Digraph

REPO = Path(__file__).resolve().parents[1]
OUT_DIR = REPO / "diagrams" / "02_analysis_design" / "03_architecture"
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT_BASE = OUT_DIR / "system-architecture"

# ─── Palette ────────────────────────────────────────────────────────────────
FRONT = {"fill": "#E3F2FD", "line": "#1976D2"}
GW    = {"fill": "#FFF3E0", "line": "#F57C00"}
AI    = {"fill": "#F3E5F5", "line": "#7B1FA2"}
BIZ   = {"fill": "#E8F5E9", "line": "#388E3C"}
EXT   = {"fill": "#FFEBEE", "line": "#C62828"}
DATA  = {"fill": "#FFF8E1", "line": "#5D4037"}

EDGE_HTTP  = {"color": "#888888"}
EDGE_GRPC  = {"color": "#1565C0", "penwidth": "1.4"}
EDGE_PUB   = {"color": "#EF6C00", "style": "dashed"}
EDGE_CONS  = {"color": "#EF6C00", "style": "dashed"}
EDGE_DB    = {"color": "#5D4037"}
EDGE_CACHE = {"color": "#C62828", "style": "dotted"}
EDGE_AI    = {"color": "#7B1FA2", "penwidth": "1.6"}
EDGE_EXT   = {"color": "#AD1457", "penwidth": "1.2"}

# Gateway routing: HTTP→gRPC bridge for most services; forced HTTP for auth,
# wallet, and selected driver routes (not drawn). Notification & review expose
# gRPC (50058 / 50059) like the other bridged services.
GRPC_SERVICES = {"user", "booking", "ride", "driver", "payment", "pricing", "notification", "review"}

# ─── Graph ──────────────────────────────────────────────────────────────────
g = Digraph("System Architecture")
g.attr(
    rankdir="TB",
    splines="ortho",            # right-angle edges (vuông)
    nodesep="0.6",
    ranksep="1.2",
    fontname="Helvetica",
    bgcolor="white",
    compound="true",
    newrank="true",
    pad="0.7",
    ordering="out",
    dpi="150",
    concentrate="true",         # merge parallel edges → less clutter
)
g.attr("node", shape="box", style="rounded,filled",
       fontname="Helvetica", fontsize="11", penwidth="1.4", margin="0.18,0.10")
g.attr("edge", fontname="Helvetica", fontsize="9", arrowsize="0.7", penwidth="1.1")


def styled(sub, nid: str, label: str, palette: dict, shape: str = "box"):
    sub.node(nid, label, fillcolor=palette["fill"], color=palette["line"], shape=shape)


# ─── 1. Frontend ────────────────────────────────────────────────────────────
with g.subgraph(name="cluster_frontend") as c:
    c.attr(label="Frontend — React SPAs", style="dashed,rounded", rank="same",
           color=FRONT["line"], fontcolor=FRONT["line"], fontsize="13", penwidth="1.6")
    styled(c, "customer",   "Customer  :4000", FRONT)
    styled(c, "driver_app", "Driver  :4001",   FRONT)
    styled(c, "admin",      "Admin  :4002",    FRONT)

# ─── 2. Gateway + AI ────────────────────────────────────────────────────────
with g.subgraph(name="cluster_gateway") as c:
    c.attr(label="Gateway layer", style="dashed,rounded", rank="same",
           color=GW["line"], fontcolor=GW["line"], fontsize="13", penwidth="1.6")
    styled(c, "gateway",
           "API Gateway :3000\n"
           "JWT  •  HTTP proxy\n"
           "Socket.IO  •  Matching engine\n"
           "RabbitMQ consumer", GW)

with g.subgraph(name="cluster_ai") as c:
    c.attr(label="AI layer", style="dashed,rounded", rank="same",
           color=AI["line"], fontcolor=AI["line"], fontsize="13", penwidth="1.6")
    styled(
        c,
        "ai",
        "AI :8000\nFastAPI  •  ML  •  RAG\n"
        "(HTTP in: Gateway, Pricing; RAG→LLM APIs)",
        AI,
    )

with g.subgraph() as same_gw:
    same_gw.attr(rank="same")
    same_gw.node("gateway")
    same_gw.node("ai")

# ─── 3. Business services (REORDERED to reduce crossings) ───────────────────
#   left (publishers near RabbitMQ): booking, ride, driver, payment
#   middle: auth, user, pricing, wallet
#   right (Mongo users near MongoDB): notification, review
BUSINESS = [
    ("booking",      "Booking :3008\ngRPC :50053"),
    ("ride",         "Ride :3002\ngRPC :50054"),
    ("driver",       "Driver :3003\ngRPC :50055"),
    ("payment",      "Payment :3004\ngRPC :50056"),
    ("auth",         "Auth :3001\ngRPC :50051"),
    ("user",         "User :3007\ngRPC :50052"),
    ("pricing",      "Pricing :3009\ngRPC :50057"),
    ("wallet",       "Wallet :3006"),
    ("notification", "Notification :3005\ngRPC :50058"),
    ("review",       "Review :3010\ngRPC :50059"),
]
with g.subgraph(name="cluster_business") as c:
    c.attr(label="Business services", style="dashed,rounded", rank="same",
           color=BIZ["line"], fontcolor=BIZ["line"], fontsize="13", penwidth="1.6")
    for sid, label in BUSINESS:
        styled(c, sid, label, BIZ)

# ─── 4. External APIs (left) + Data and infra (right) on bottom row ─────────
with g.subgraph(name="cluster_external") as c:
    c.attr(label="External APIs", style="dashed,rounded", rank="same",
           color=EXT["line"], fontcolor=EXT["line"], fontsize="13", penwidth="1.6")
    for nid, label in [("osrm", "OSRM"), ("maps", "Maps API"),
                       ("momo", "MoMo"), ("vnpay", "VNPay")]:
        styled(c, nid, label, EXT)

with g.subgraph(name="cluster_data") as c:
    c.attr(label="Data and infra", style="dashed,rounded", rank="same",
           color=DATA["line"], fontcolor=DATA["line"], fontsize="13", penwidth="1.6")
    # Order: RabbitMQ (left, near publishers) → Postgres → Redis → Mongo (right)
    styled(c, "rabbitmq", "RabbitMQ :5672\ndomain events",   DATA, shape="cylinder")
    styled(c, "postgres", "PostgreSQL :5433\n7 databases",   DATA, shape="cylinder")
    styled(c, "redis",    "Redis :6379\nGEO cache adapter",  DATA, shape="cylinder")
    styled(c, "mongo",    "MongoDB :27017\n2 databases",     DATA, shape="cylinder")

# Anchor external + data on the same rank
g.edge("vnpay", "rabbitmq", style="invis", weight="1", constraint="true")

# ═══ Edges ═══════════════════════════════════════════════════════════════════

# Frontend → Gateway
for fe in ["customer", "driver_app", "admin"]:
    g.edge(fe, "gateway", **EDGE_HTTP)

# Gateway ↔ AI
g.edge("gateway", "ai", xlabel="HTTP", constraint="false", **EDGE_AI)

# Gateway → business (gRPC bridge for most, forced HTTP for auth/wallet)
for sid, _ in BUSINESS:
    if sid in GRPC_SERVICES:
        g.edge("gateway", sid, xlabel="gRPC", **EDGE_GRPC)
    else:
        g.edge("gateway", sid, xlabel="HTTP", **EDGE_HTTP)

# Pricing → AI
g.edge("pricing", "ai", xlabel="HTTP", constraint="false", **EDGE_AI)

# Business → External
g.edge("ride",    "osrm",  **EDGE_EXT)
g.edge("ride",    "maps",  **EDGE_EXT)
g.edge("payment", "momo",  **EDGE_EXT)
g.edge("payment", "vnpay", **EDGE_EXT)

# Business → RabbitMQ (publish)
for sid in ["booking", "ride", "driver", "payment"]:
    g.edge(sid, "rabbitmq", xlabel="publish", **EDGE_PUB)

# RabbitMQ → consumers
for sid in ["wallet", "notification", "review"]:
    g.edge("rabbitmq", sid, xlabel="consume", constraint="false", **EDGE_CONS)
g.edge("rabbitmq", "gateway", xlabel="consume", constraint="false", **EDGE_CONS)

# Redis
g.edge("gateway", "redis", xlabel="cache", **EDGE_CACHE)
g.edge("ride",    "redis", xlabel="GEO",   **EDGE_CACHE)

# Postgres
for sid in ["auth", "user", "booking", "ride", "driver", "payment", "wallet"]:
    g.edge(sid, "postgres", **EDGE_DB)

# Mongo
g.edge("notification", "mongo", **EDGE_DB)
g.edge("review",       "mongo", **EDGE_DB)

# ─── Render ─────────────────────────────────────────────────────────────────
png = g.render(str(OUT_BASE), format="png", cleanup=True)
svg = g.render(str(OUT_BASE), format="svg", cleanup=True)
print(f"✓ {png}")
print(f"✓ {svg}")
