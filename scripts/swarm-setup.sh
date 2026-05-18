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
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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
  label-nodes   Apply labels from deploy/swarm-labels.conf to all nodes
  preflight     Verify overlay DNS + Postgres reachable from every node
  deploy        Deploy / update the stack
  status        Show stack services and node list
  promote       Promote a worker to secondary manager (for HA)
  scale         Scale a service  (e.g. $0 scale auth-service 2)
  recover       Un-drain nodes, reset labels, pause autoscaler,
                force-redeploy stack, resume autoscaler. Use this when the
                server has been "set lung tung" — config drifted from repo.
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
  warn "When running the join command, add this node's private IP:"
  warn "  PRIVATE_IP=\$(hostname -I | awk '{print \$1}')"
  warn "  docker swarm join --advertise-addr \"\$PRIVATE_IP\" --token <TOKEN> <MANAGER_PRIVATE_IP>:2377"
  echo ""
  warn "Each worker must have Docker installed first:"
  warn "  curl -fsSL https://get.docker.com | sh"
}

# ============================================================
cmd_label_nodes() {
  local repo_root; repo_root="$(cd "${SCRIPT_DIR}/.." && pwd)"
  local conf="${repo_root}/deploy/swarm-labels.conf"
  [[ ! -f "${conf}" ]] && error "Label config not found: ${conf}"

  info "Reading label assignments from: ${conf}"
  echo

  declare -A WANT  # hostname -> "k1=v1 k2=v2"
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"  # strip inline comments
    line="${line#"${line%%[![:space:]]*}"}"  # ltrim
    [[ -z "${line// }" ]] && continue
    local host; host="${line%%:*}"
    local rest; rest="${line#*:}"
    host="${host//[[:space:]]/}"
    rest="${rest// /}"
    WANT["${host}"]="${rest//,/ }"
  done <"${conf}"

  local node_id host current_labels desired_labels
  local applied=0 skipped=0 unknown=0

  while read -r node_id; do
    [[ -z "${node_id}" ]] && continue
    host=$(docker node inspect "${node_id}" --format '{{.Description.Hostname}}')
    current_labels=$(docker node inspect "${node_id}" --format '{{range $k,$v := .Spec.Labels}}{{$k}}={{$v}} {{end}}')

    desired_labels="${WANT[${host}]:-}"
    if [[ -z "${desired_labels}" ]]; then
      warn "  ${host}  → no entry in conf file (skipping; add it before deploy)"
      unknown=$((unknown+1))
      continue
    fi

    # Remove labels NOT in desired set (clean slate per node)
    local k v existing_keys=""
    for kv in ${current_labels}; do
      k="${kv%%=*}"; existing_keys+="${k} "
    done
    for k in ${existing_keys}; do
      local keep=0
      for kv in ${desired_labels}; do
        [[ "${kv%%=*}" == "${k}" ]] && { keep=1; break; }
      done
      [[ "${keep}" == 0 ]] && \
        docker node update --label-rm "${k}" "${node_id}" >/dev/null
    done

    # Apply desired
    local update_args=""
    for kv in ${desired_labels}; do
      update_args+=" --label-add ${kv}"
    done
    # shellcheck disable=SC2086
    docker node update ${update_args} "${node_id}" >/dev/null
    info "  ${host}  ← ${desired_labels}"
    applied=$((applied+1))
  done < <(docker node ls -q)

  echo
  info "Applied: ${applied}, skipped: ${skipped}, unknown: ${unknown}"
  if [[ "${unknown}" -gt 0 ]]; then
    warn "Edit deploy/swarm-labels.conf to add missing hostnames, then re-run."
  fi
  return 0
}

# ============================================================
cmd_preflight() {
  info "Pre-flight check: every node must reach 'postgres' via overlay DNS."
  echo

  # Ensure the backend overlay network exists (created by stack deploy).
  local net="cab-booking_backend"
  if ! docker network inspect "${net}" >/dev/null 2>&1; then
    warn "Overlay '${net}' not found — deploy the stack first, then re-run preflight."
    warn "Skipping DNS test; only checking node reachability."
    docker node ls
    return 0
  fi

  local fail=0
  local node_id host addr
  while read -r node_id; do
    [[ -z "${node_id}" ]] && continue
    host=$(docker node inspect "${node_id}" --format '{{.Description.Hostname}}')
    addr=$(docker node inspect "${node_id}" --format '{{.Status.Addr}}')
    echo -n "  ${host} (${addr}) … "

    # Run busybox in the overlay network on THIS node (constraint) → test DNS
    local out
    out=$(docker run --rm \
      --network "${net}" \
      --constraint "node.hostname==${host}" \
      busybox:latest sh -c 'getent hosts postgres && nc -zvw3 postgres 5432' 2>&1 | tail -3)

    if echo "${out}" | grep -q "open"; then
      echo -e "${GREEN}OK${NC}"
    else
      echo -e "${RED}FAIL${NC}"
      echo "${out}" | sed 's/^/      /'
      fail=$((fail+1))
    fi
  done < <(docker node ls -q)

  echo
  if [[ "${fail}" -gt 0 ]]; then
    error "${fail} node(s) failed overlay DNS check. Fix: restart docker daemon on the failing node — sudo systemctl restart docker"
  fi
  info "All nodes can resolve and connect to postgres via overlay. ✔"
}

# ============================================================
cmd_deploy() {
  [[ ! -f "${PROJECT_DIR}/${STACK_FILE}" ]] && \
    error "Stack file not found: ${PROJECT_DIR}/${STACK_FILE}"

  cd "${PROJECT_DIR}"

  if [[ -f ".env" ]]; then
    info "Loading environment variables from ${PROJECT_DIR}/.env..."
    # shellcheck source=scripts/load-dotenv.sh
    source "${SCRIPT_DIR}/load-dotenv.sh"
    load_dotenv ".env"
  else
    warn "No .env found at ${PROJECT_DIR}/.env — stack variables will use shell/default values."
  fi

  DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME:-foxxiee04}"
  IMAGE_TAG="${IMAGE_TAG:-latest}"

  info "Pulling latest images..."
  docker pull "${DOCKERHUB_USERNAME}/cab-api-gateway:${IMAGE_TAG}" || true

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
  info "═══ Node Advertised Addresses ════════════════"
  docker node ls -q | xargs -I{} docker node inspect {} --format '{{.Description.Hostname}} status={{.Status.Addr}} manager={{if .ManagerStatus}}{{.ManagerStatus.Addr}}{{end}}' || true
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
# Recover from a "set lung tung" server state: drifted node labels,
# leftover service updates from a broken deploy, autoscaler racing
# rolling updates, drained nodes. Brings everything back in line
# with the repo (deploy/swarm-labels.conf + docker-stack.thesis.yml).
#
# Idempotent — safe to run multiple times. Does NOT touch volumes.
cmd_recover() {
  cd "${PROJECT_DIR}" 2>/dev/null || error "Repo not found at ${PROJECT_DIR}"

  info "═══ STEP 1/7  Show current state ════════════════════════════"
  docker node ls || true
  echo
  docker stack services "${STACK_NAME}" 2>/dev/null | head -30 || true
  echo

  info "═══ STEP 2/7  Un-drain any drained nodes ═══════════════════"
  while read -r node_id; do
    [[ -z "${node_id}" ]] && continue
    avail=$(docker node inspect "${node_id}" --format '{{.Spec.Availability}}')
    host=$(docker node inspect "${node_id}" --format '{{.Description.Hostname}}')
    if [[ "${avail}" != "active" ]]; then
      warn "  ${host} is '${avail}' — setting back to active"
      docker node update --availability active "${node_id}" >/dev/null
    fi
  done < <(docker node ls -q)
  info "All nodes set to availability=active."
  echo

  info "═══ STEP 3/7  Re-apply node labels from swarm-labels.conf ══"
  cmd_label_nodes
  echo

  info "═══ STEP 4/7  Pause autoscaler ═════════════════════════════"
  local autoscaler="${STACK_NAME}_autoscaler"
  local autoscaler_prev=""
  if docker service ls --format '{{.Name}}' | grep -qx "${autoscaler}"; then
    autoscaler_prev=$(docker service inspect "${autoscaler}" \
      --format '{{.Spec.Mode.Replicated.Replicas}}' 2>/dev/null || echo 1)
    info "  Was ${autoscaler_prev} replica → scaling to 0"
    docker service scale "${autoscaler}=0" >/dev/null 2>&1 || true
    sleep 5
  else
    info "  Autoscaler not running — skipping pause"
  fi
  echo

  info "═══ STEP 5/7  Pull latest images (optional) ═══════════════"
  if [[ -f "${PROJECT_DIR}/.env" ]]; then
    # shellcheck source=scripts/load-dotenv.sh
    source "${SCRIPT_DIR}/load-dotenv.sh"
    load_dotenv "${PROJECT_DIR}/.env"
  fi
  DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME:-foxxiee04}"
  IMAGE_TAG="${IMAGE_TAG:-latest}"
  if [[ -n "${DOCKERHUB_TOKEN:-}" ]]; then
    echo "${DOCKERHUB_TOKEN}" | docker login -u "${DOCKERHUB_USERNAME}" --password-stdin >/dev/null 2>&1 || \
      warn "  Docker Hub login failed — will pull anonymously"
  fi
  echo

  info "═══ STEP 6/7  Force-redeploy stack (foreground, single pass) ═"
  info "  This converges every service to the spec in docker-stack.thesis.yml"
  DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME}" \
  IMAGE_TAG="${IMAGE_TAG}" \
  docker stack deploy \
    --with-registry-auth \
    --resolve-image always \
    --prune \
    -c "${STACK_FILE}" \
    "${STACK_NAME}"
  echo

  info "═══ STEP 7/7  Resume autoscaler ════════════════════════════"
  if [[ -n "${autoscaler_prev}" ]] && [[ "${autoscaler_prev}" != "0" ]]; then
    info "  Restoring ${autoscaler} to ${autoscaler_prev} replica"
    docker service scale "${autoscaler}=${autoscaler_prev}" >/dev/null 2>&1 || true
  fi
  echo
  info "Done. To verify: $0 status   |   bash scripts/reset-and-seed.sh"
  warn "If services still show 0/1 after 2 minutes, check: docker service ps ${STACK_NAME}_<svc> --no-trunc"
}

# ============================================================
case "${1:-}" in
  init)          cmd_init ;;
  join-worker)   cmd_join_worker ;;
  label-nodes)   cmd_label_nodes ;;
  preflight)     cmd_preflight ;;
  deploy)        cmd_deploy ;;
  status)        cmd_status ;;
  promote)       cmd_promote ;;
  scale)         cmd_scale "${2:-}" "${3:-}" ;;
  recover)       cmd_recover ;;
  teardown)      cmd_teardown ;;
  *)             usage; exit 1 ;;
esac
