#!/usr/bin/env bash
# ============================================================
# FoxGo Docker Swarm Setup Script
# Chạy script này trên MANAGER NODE sau khi cài Docker.
#
# Usage:
#   chmod +x swarm-setup.sh
#   ./swarm-setup.sh [--init | --join-worker | --deploy | --status]
# ============================================================
set -euo pipefail

# ── Colors ──────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERR]${NC}  $*"; exit 1; }

# ── Config (edit before running) ────────────────────────────
STACK_NAME="cab-booking"
STACK_FILE="docker-stack.thesis.yml"
DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME:-foxxiee04}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
PROJECT_DIR="${HOME}/cab-booking"

# ============================================================
usage() {
  cat <<EOF
Usage: $0 <command>

Commands:
  init          Init swarm on this manager, create secrets, show join token
  join-worker   Print join-token for worker nodes (run on manager)
  deploy        Deploy / update the stack
  status        Show stack services and node list
  promote       Promote a worker to secondary manager (for HA)
  scale         Scale a service  (e.g. $0 scale auth-service 2)
  teardown      Remove stack and leave swarm (destructive!)
EOF
}

# ============================================================
cmd_init() {
  info "Detecting private IP..."
  PRIVATE_IP=$(hostname -I | awk '{print $1}')
  info "Manager private IP: ${PRIVATE_IP}"

  if docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null | grep -q "active"; then
    warn "Swarm already initialized — skipping init."
  else
    docker swarm init --advertise-addr "${PRIVATE_IP}"
    info "Swarm initialized."
  fi

  info "Creating Docker secrets (skip if already exist)..."

  create_secret() {
    local name=$1; local value=$2
    if docker secret inspect "${name}" &>/dev/null; then
      warn "Secret '${name}' already exists — skipping."
    else
      echo "${value}" | docker secret create "${name}" -
      info "Created secret: ${name}"
    fi
  }

  # Prompt for secret values
  read -rsp "PostgreSQL password [postgres123]: " PG_PASS; echo
  PG_PASS="${PG_PASS:-postgres123}"
  read -rsp "MongoDB password [mongo123]: " MONGO_PASS; echo
  MONGO_PASS="${MONGO_PASS:-mongo123}"

  create_secret postgres_user     "postgres"
  create_secret postgres_password "${PG_PASS}"
  create_secret mongo_user        "mongo"
  create_secret mongo_password    "${MONGO_PASS}"

  info "Labelling this manager node (infra=true, nginx=true)..."
  SELF_ID="$(docker info --format '{{.Swarm.NodeID}}')"
  docker node update --label-add infra=true "${SELF_ID}" >/dev/null
  docker node update --label-add nginx=true "${SELF_ID}" >/dev/null
  info "Manager ${SELF_ID} labelled."

  info "Done. Run '$0 join-worker' to get the token for worker nodes."
  info "Then run '$0 deploy' to deploy the stack."
}

# ============================================================
cmd_join_worker() {
  info "Worker join token (run this on each spot worker node):"
  echo ""
  docker swarm join-token worker
  echo ""
  warn "Each worker must have Docker installed first:"
  warn "  curl -fsSL https://get.docker.com | sh"
}

# ============================================================
cmd_deploy() {
  [[ ! -f "${PROJECT_DIR}/${STACK_FILE}" ]] && \
    error "Stack file not found: ${PROJECT_DIR}/${STACK_FILE}"

  info "Pulling latest images..."
  docker pull "${DOCKERHUB_USERNAME}/cab-api-gateway:${IMAGE_TAG}" || true

  cd "${PROJECT_DIR}"

  info "Deploying stack '${STACK_NAME}'..."
  DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME}" \
  IMAGE_TAG="${IMAGE_TAG}" \
  docker stack deploy \
    --with-registry-auth \
    --compose-file "${STACK_FILE}" \
    "${STACK_NAME}"

  info "Stack deployed. Waiting 10s for services to start..."
  sleep 10
  cmd_status
}

# ============================================================
cmd_status() {
  echo ""
  info "═══ Swarm Nodes ═══════════════════════════════"
  docker node ls
  echo ""
  info "═══ Stack Services ════════════════════════════"
  docker stack services "${STACK_NAME}" 2>/dev/null || warn "Stack '${STACK_NAME}' not running."
  echo ""
  info "═══ Service Distribution (which node) ════════"
  docker stack ps "${STACK_NAME}" \
    --filter "desired-state=running" \
    --format "table {{.Name}}\t{{.Node}}\t{{.CurrentState}}" \
    2>/dev/null || true
}

# ============================================================
cmd_promote() {
  echo ""
  docker node ls
  echo ""
  read -rp "Enter node ID or hostname to promote to manager: " NODE_ID
  docker node promote "${NODE_ID}"
  info "Node '${NODE_ID}' promoted to manager (secondary HA manager)."
  info "Raft quorum now has 2 managers — cluster tolerates 1 manager failure."
}

# ============================================================
cmd_scale() {
  local service="${1:-}"
  local replicas="${2:-}"
  [[ -z "$service" || -z "$replicas" ]] && error "Usage: $0 scale <service-name> <replicas>"
  docker service scale "${STACK_NAME}_${service}=${replicas}"
  info "Scaled ${STACK_NAME}_${service} to ${replicas} replicas."
}

# ============================================================
cmd_teardown() {
  warn "This will REMOVE the entire stack and leave the swarm!"
  read -rp "Type 'yes' to confirm: " CONFIRM
  [[ "${CONFIRM}" != "yes" ]] && { info "Aborted."; exit 0; }
  docker stack rm "${STACK_NAME}" || true
  sleep 5
  docker swarm leave --force || true
  info "Stack removed and swarm left."
}

# ============================================================
case "${1:-}" in
  init)          cmd_init ;;
  join-worker)   cmd_join_worker ;;
  deploy)        cmd_deploy ;;
  status)        cmd_status ;;
  promote)       cmd_promote ;;
  scale)         cmd_scale "${2:-}" "${3:-}" ;;
  teardown)      cmd_teardown ;;
  *)             usage; exit 1 ;;
esac
