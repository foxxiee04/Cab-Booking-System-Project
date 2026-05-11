#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# FoxGo Auto-Scaler — Docker Swarm + Prometheus
#
# Chạy như một Swarm service trên Manager node.
# Mỗi SCALE_INTERVAL_SEC giây:
#   - Query Prometheus lấy CPU trung bình toàn cluster
#   - Nếu CPU > SCALE_UP_CPU_PCT  → tăng replicas (tối đa MAX_REPLICAS)
#   - Nếu CPU < SCALE_DOWN_CPU_PCT → giảm replicas (tối thiểu MIN_REPLICAS)
#
# Deploy: đã tích hợp vào docker-stack.thesis.yml (service autoscaler)
# Log:    docker service logs cab-booking_autoscaler -f
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PROMETHEUS="${PROMETHEUS_URL:-http://prometheus:9090}"
STACK="${STACK_NAME:-cab-booking}"
INTERVAL="${SCALE_INTERVAL_SEC:-30}"
CPU_UP="${SCALE_UP_CPU_PCT:-65}"
CPU_DOWN="${SCALE_DOWN_CPU_PCT:-20}"
MAX_REPLICAS="${MAX_REPLICAS:-3}"
MIN_REPLICAS="${MIN_REPLICAS:-1}"

# Services được phép auto-scale (stateless, có thể chạy nhiều replicas)
SCALABLE="api-gateway auth-service ride-service driver-service"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# Query Prometheus → CPU % trung bình toàn cluster (từ node-exporter)
get_cluster_cpu() {
  local query='100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[2m])) * 100)'
  local encoded
  encoded=$(printf '%s' "$query" | jq -sRr @uri)
  curl -sf --max-time 5 "${PROMETHEUS}/api/v1/query?query=${encoded}" \
    | jq -r '.data.result[0].value[1] // "0"' 2>/dev/null \
    | awk '{printf "%.0f", $1}'
}

get_replicas() {
  docker service inspect "${STACK}_$1" \
    --format '{{.Spec.Mode.Replicated.Replicas}}' 2>/dev/null || echo "1"
}

do_scale() {
  local svc=$1 n=$2
  docker service scale "${STACK}_${svc}=${n}" >/dev/null 2>&1 && return 0 || return 1
}

log "━━━ Auto-Scaler started ━━━"
log "  Prometheus : ${PROMETHEUS}"
log "  Stack      : ${STACK}"
log "  Interval   : ${INTERVAL}s"
log "  Scale UP   : CPU > ${CPU_UP}%  → +1 replica (max ${MAX_REPLICAS})"
log "  Scale DOWN : CPU < ${CPU_DOWN}% → -1 replica (min ${MIN_REPLICAS})"
log "  Services   : ${SCALABLE}"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━"

while true; do
  cpu=$(get_cluster_cpu)
  log "Cluster CPU: ${cpu}%  |  $(docker node ls --format '{{.Hostname}}:{{.Status}}' 2>/dev/null | tr '\n' ' ')"

  for svc in $SCALABLE; do
    current=$(get_replicas "$svc")

    if [ "$cpu" -gt "$CPU_UP" ] && [ "$current" -lt "$MAX_REPLICAS" ]; then
      new=$((current + 1))
      if do_scale "$svc" "$new"; then
        log "  ↑ SCALE UP   ${svc}: ${current} → ${new} replicas  (CPU ${cpu}% > ${CPU_UP}%)"
      fi

    elif [ "$cpu" -lt "$CPU_DOWN" ] && [ "$current" -gt "$MIN_REPLICAS" ]; then
      new=$((current - 1))
      if do_scale "$svc" "$new"; then
        log "  ↓ SCALE DOWN ${svc}: ${current} → ${new} replicas  (CPU ${cpu}% < ${CPU_DOWN}%)"
      fi

    else
      log "  = ${svc}: ${current} replicas"
    fi
  done

  sleep "$INTERVAL"
done
