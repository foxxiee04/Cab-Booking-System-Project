#!/usr/bin/env bash
# Một lệnh: reset toàn bộ DB (Swarm) + seed — đặt ở root repo, ví dụ ~/cab-booking/reset-and-seed.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${ROOT}/scripts/reset-database-swarm.sh" "$@"
